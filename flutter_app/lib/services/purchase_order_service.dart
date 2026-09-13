import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

class PurchaseOrderService {
  PurchaseOrderService._();

  static final PurchaseOrderService instance = PurchaseOrderService._();

  static Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    String documentsPath;
    try {
      final documentsDirectory = await getApplicationDocumentsDirectory();
      documentsPath = documentsDirectory.path;
    } on Object {
      documentsPath = Directory.systemTemp.path;
    }

    final path = join(documentsPath, 'mobiduka_purchase_orders.db');

    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE local_purchase_orders (
            id TEXT PRIMARY KEY,
            supplierName TEXT,
            supplierId TEXT,
            status TEXT,
            action TEXT,
            notes TEXT,
            expectedDeliveryDate TEXT,
            items TEXT,
            total INTEGER,
            createdAt TEXT,
            updatedAt TEXT,
            receivedAt TEXT
          )
        ''');
      },
    );
  }

  Future<List<Map<String, dynamic>>> loadPurchaseOrders() async {
    final db = await database;
    final rows = await db.query(
      'local_purchase_orders',
      orderBy: 'createdAt DESC',
    );

    return rows.map((row) => Map<String, dynamic>.from(row)).toList();
  }

  Future<Map<String, dynamic>> createOfflinePurchaseOrder({
    required String supplierName,
    String? supplierId,
    required List<Map<String, dynamic>> items,
    String? notes,
    String? expectedDeliveryDate,
  }) async {
    final db = await database;
    final now = DateTime.now().toIso8601String();
    final orderId = 'PO-${DateTime.now().millisecondsSinceEpoch}';
    final total = items.fold<int>(0, (sum, item) {
      final qty = item['qty'] is num
          ? (item['qty'] as num).toInt()
          : int.tryParse(item['qty']?.toString() ?? '') ?? 0;
      final cost = item['cost'] is num
          ? (item['cost'] as num).toInt()
          : int.tryParse(item['cost']?.toString() ?? '') ?? 0;
      return sum + (qty * cost);
    });

    final record = {
      'id': orderId,
      'supplierName': supplierName,
      'supplierId': supplierId ?? 'supplier-${DateTime.now().millisecondsSinceEpoch}',
      'status': 'REQUESTED',
      'action': 'CREATE',
      'notes': notes ?? '',
      'expectedDeliveryDate': expectedDeliveryDate ?? DateTime.now().add(const Duration(days: 5)).toIso8601String(),
      'items': jsonEncode(items),
      'total': total,
      'createdAt': now,
      'updatedAt': now,
      'receivedAt': null,
    };

    await db.insert(
      'local_purchase_orders',
      record,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );

    return record;
  }

  Future<Map<String, dynamic>> markPurchaseOrderReceived(String orderId) async {
    final db = await database;
    final rows = await db.query(
      'local_purchase_orders',
      where: 'id = ?',
      whereArgs: [orderId],
    );

    if (rows.isEmpty) {
      return {};
    }

    final now = DateTime.now().toIso8601String();
    final record = Map<String, dynamic>.from(rows.first);
    record['status'] = 'RECEIVED';
    record['action'] = 'RECEIVE';
    record['updatedAt'] = now;
    record['receivedAt'] = now;

    await db.update(
      'local_purchase_orders',
      record,
      where: 'id = ?',
      whereArgs: [orderId],
    );

    return record;
  }
}
