import 'dart:convert';
import 'dart:math';

import 'package:sqflite/sqflite.dart';

import 'sync_service.dart';

/// Local-first store for supplier, purchase-order, and settings snapshots.
class AuxiliaryDirectoryService {
  AuxiliaryDirectoryService({SyncService? syncService})
      : _syncService = syncService ?? SyncService();

  final SyncService _syncService;

  Future<List<Map<String, dynamic>>> loadSuppliers(String businessId) =>
      _loadRows('local_supplier_directory', businessId);

  Future<void> cacheSuppliers(
      String businessId, List<Map<String, dynamic>> suppliers) async {
    await _replaceRows('local_supplier_directory', businessId, suppliers);
  }

  Future<Map<String, dynamic>> createSupplier({
    required String businessId,
    required String name,
    required String category,
    required String contact,
    required String phone,
    required String email,
  }) async {
    final timestamp = DateTime.now().toIso8601String();
    final supplier = <String, dynamic>{
      'id': _uuid(),
      'businessId': businessId,
      'name': name.trim(),
      'category': category.trim(),
      'contactPerson': contact.trim(),
      'phone': phone.trim(),
      'email': email.trim(),
      'createdAt': timestamp,
      'updatedAt': timestamp,
      'isPendingSync': true,
      '_count': {'products': 0, 'purchaseOrders': 0},
    };
    await _saveRow('local_supplier_directory', supplier, pending: true);
    await _syncService.queueChange(
      id: 'supplier-event-${_uuid()}',
      entityName: 'Supplier',
      operation: 'CREATE',
      payload: supplier,
    );
    return supplier;
  }

  Future<List<Map<String, dynamic>>> loadPurchaseOrders(String businessId) =>
      _loadRows('local_purchase_orders', businessId);

  Future<void> cachePurchaseOrders(
      String businessId, List<Map<String, dynamic>> orders) async {
    await _replaceRows('local_purchase_orders', businessId, orders);
  }

  Future<Map<String, dynamic>> createPurchaseOrder({
    required String businessId,
    required String supplierId,
    required String dueDate,
    required List<Map<String, Object?>> items,
  }) async {
    final timestamp = DateTime.now().toIso8601String();
    final id = _uuid();
    final total = items.fold<num>(
        0,
        (sum, item) =>
            sum + _number(item['quantity']) * _number(item['costPrice']));
    final order = <String, dynamic>{
      'id': id,
      'businessId': businessId,
      'supplierId': supplierId,
      'orderNo':
          'PO-${DateTime.now().year}-${id.substring(0, 6).toUpperCase()}',
      'status': 'REQUESTED',
      'totalCost': total,
      'dueDate': dueDate.isEmpty ? null : dueDate,
      'items': items.map((item) => Map<String, Object?>.from(item)).toList(),
      'createdAt': timestamp,
      'updatedAt': timestamp,
      'isPendingSync': true,
    };
    await _saveRow('local_purchase_orders', order, pending: true);
    await _syncService.queueChange(
      id: 'purchase-order-event-${_uuid()}',
      entityName: 'PurchaseOrder',
      operation: 'CREATE',
      payload: order,
    );
    return order;
  }

  Future<Map<String, dynamic>?> receivePurchaseOrder({
    required String businessId,
    required String orderId,
  }) async {
    final db = await _syncService.database;
    final rows = await db.query('local_purchase_orders',
        where: 'id = ? AND businessId = ?', whereArgs: [orderId, businessId]);
    if (rows.isEmpty) return null;
    final order = _decode(rows.single['payload']);
    if (order == null ||
        order['status']?.toString().toUpperCase() == 'RECEIVED') {
      return order;
    }
    final updated = <String, dynamic>{
      ...order,
      'status': 'RECEIVED',
      'action': 'RECEIVE',
      'updatedAt': DateTime.now().toIso8601String(),
      'isPendingSync': true,
    };
    await _saveRow('local_purchase_orders', updated, pending: true);
    await _syncService.queueChange(
      id: 'purchase-order-receive-${_uuid()}',
      entityName: 'PurchaseOrder',
      operation: 'UPDATE',
      payload: updated,
    );
    return updated;
  }

  Future<void> cacheSettings(
          String businessId, Map<String, dynamic> settings) =>
      _syncService.cacheCollection(
          businessId: businessId,
          cacheKey: 'settings.profile',
          payload: settings);

  Future<Map<String, dynamic>?> loadSettings(String businessId) async {
    final raw = await _syncService.readCachedCollection(
        businessId: businessId, cacheKey: 'settings.profile');
    return raw is Map ? Map<String, dynamic>.from(raw) : null;
  }

  Future<Map<String, dynamic>> saveSettings({
    required String businessId,
    required Map<String, Object?> patch,
  }) async {
    final previous =
        await loadSettings(businessId) ?? const <String, dynamic>{};
    final preferences =
        Map<String, dynamic>.from(previous['preferences'] as Map? ?? const {});
    final business =
        Map<String, dynamic>.from(previous['business'] as Map? ?? const {});
    for (final entry in patch.entries) {
      if (entry.key == 'currency' || entry.key == 'taxPin') {
        business[entry.key] = entry.value;
      } else {
        preferences[entry.key] = entry.value;
      }
    }
    final merged = <String, dynamic>{
      ...previous,
      'business': business,
      'preferences': preferences,
    };
    await cacheSettings(businessId, merged);
    await _syncService.queueChange(
      id: 'settings-event-${_uuid()}',
      entityName: 'SettingsProfile',
      operation: 'UPDATE',
      payload: {'id': businessId, 'businessId': businessId, ...patch},
    );
    return merged;
  }

  Future<List<Map<String, dynamic>>> _loadRows(
      String table, String businessId) async {
    final db = await _syncService.database;
    final rows = await db.query(table,
        where: 'businessId = ?',
        whereArgs: [businessId],
        orderBy: 'updatedAt DESC');
    return rows
        .map((row) => _decode(row['payload']) ?? const <String, dynamic>{})
        .where((row) => row.isNotEmpty)
        .toList();
  }

  Future<void> _replaceRows(
      String table, String businessId, List<Map<String, dynamic>> rows) async {
    final db = await _syncService.database;
    final batch = db.batch()
      ..delete(table, where: 'businessId = ?', whereArgs: [businessId]);
    for (final row in rows) {
      if (row['id']?.toString().isEmpty != false) continue;
      batch.insert(table, {
        'id': row['id'],
        'businessId': businessId,
        'payload': jsonEncode(row),
        'isPendingSync': 0,
        'updatedAt':
            row['updatedAt']?.toString() ?? DateTime.now().toIso8601String(),
      });
    }
    await batch.commit(noResult: true);
  }

  Future<void> _saveRow(String table, Map<String, dynamic> row,
      {required bool pending}) async {
    final db = await _syncService.database;
    await db.insert(
        table,
        {
          'id': row['id'],
          'businessId': row['businessId'],
          'payload': jsonEncode(row),
          'isPendingSync': pending ? 1 : 0,
          'updatedAt': row['updatedAt'] ?? DateTime.now().toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  static Map<String, dynamic>? _decode(Object? raw) {
    try {
      final value = jsonDecode(raw?.toString() ?? '');
      return value is Map ? Map<String, dynamic>.from(value) : null;
    } on FormatException {
      return null;
    }
  }

  static num _number(Object? value) =>
      value is num ? value : num.tryParse(value?.toString() ?? '') ?? 0;

  static String _uuid() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final raw =
        bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
    return '${raw.substring(0, 8)}-${raw.substring(8, 12)}-${raw.substring(12, 16)}-${raw.substring(16, 20)}-${raw.substring(20)}';
  }
}
