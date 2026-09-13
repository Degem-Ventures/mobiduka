import 'package:sqflite/sqflite.dart';

import 'sync_service.dart';

class CustomerRepository {
  CustomerRepository({SyncService? syncService}) : _syncService = syncService ?? SyncService();

  final SyncService _syncService;

  Future<void> ensureCustomerSchema() async {
    final db = await _syncService.database;
    await db.execute('''
      CREATE TABLE IF NOT EXISTS local_customers (
        id TEXT PRIMARY KEY,
        businessId TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        creditLimit REAL NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS local_credit_accounts (
        customerId TEXT PRIMARY KEY,
        customer TEXT NOT NULL,
        phone TEXT,
        balance REAL NOT NULL DEFAULT 0,
        lastTransactionAt TEXT,
        transactionCount INTEGER NOT NULL DEFAULT 0,
        initials TEXT NOT NULL,
        colorValue INTEGER NOT NULL
      )
    ''');
  }

  Future<String> createOfflineCustomer({
    required String businessId,
    required String name,
    String? phone,
    double initialCreditLimit = 0,
  }) async {
    await ensureCustomerSchema();
    final db = await _syncService.database;
    final id = 'cust-${DateTime.now().millisecondsSinceEpoch}';
    final timestamp = DateTime.now().toIso8601String();
    final normalizedPhone = phone?.trim() ?? '';

    await db.transaction((transaction) async {
      await transaction.insert('local_customers', {
        'id': id,
        'businessId': businessId,
        'name': name.trim(),
        'phone': normalizedPhone,
        'creditLimit': initialCreditLimit,
        'createdAt': timestamp,
      }, conflictAlgorithm: ConflictAlgorithm.replace);

      await transaction.insert('local_credit_accounts', {
        'customerId': id,
        'customer': name.trim(),
        'phone': normalizedPhone,
        'balance': 0.0,
        'lastTransactionAt': null,
        'transactionCount': 0,
        'initials': _initials(name),
        'colorValue': 0xFF123A8F,
      }, conflictAlgorithm: ConflictAlgorithm.ignore);
    });

    await _syncService.queueChange(
      id: 'sync-$id',
      entityName: 'Customer',
      operation: 'CREATE',
      payload: {
        'id': id,
        'businessId': businessId,
        'name': name.trim(),
        'phone': normalizedPhone.isEmpty ? null : normalizedPhone,
        'creditLimit': initialCreditLimit,
      },
    );

    return id;
  }

  Future<List<Map<String, dynamic>>> searchLocalCustomers(String query, {String businessId = 'demo-business'}) async {
    await ensureCustomerSchema();
    final db = await _syncService.database;
    final trimmed = query.trim();
    return db.rawQuery(
      trimmed.isEmpty
          ? '''SELECT c.*, COALESCE(a.balance, 0) AS balance, COALESCE(a.transactionCount, 0) AS transactionCount
              FROM local_customers c LEFT JOIN local_credit_accounts a ON a.customerId = c.id
              WHERE c.businessId = ? ORDER BY c.name ASC'''
          : '''SELECT c.*, COALESCE(a.balance, 0) AS balance, COALESCE(a.transactionCount, 0) AS transactionCount
              FROM local_customers c LEFT JOIN local_credit_accounts a ON a.customerId = c.id
              WHERE c.businessId = ? AND (c.name LIKE ? OR c.phone LIKE ?) ORDER BY c.name ASC''',
      trimmed.isEmpty ? [businessId] : [businessId, '%$trimmed%', '%$trimmed%'],
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((part) => part.isNotEmpty).toList();
    if (parts.isEmpty) return 'CU';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}
