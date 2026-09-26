import 'dart:math';

import 'package:sqflite/sqflite.dart';

import 'sync_service.dart';

class CustomerRepository {
  CustomerRepository({SyncService? syncService})
      : _syncService = syncService ?? SyncService();

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
        currentDebt REAL NOT NULL DEFAULT 0,
        isPendingSync INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL DEFAULT ''
      )
    ''');
    final columns = await db.rawQuery('PRAGMA table_info(local_customers)');
    final names = columns.map((column) => column['name'] as String).toSet();
    final additions = {
      'currentDebt':
          'ALTER TABLE local_customers ADD COLUMN currentDebt REAL NOT NULL DEFAULT 0',
      'isPendingSync':
          'ALTER TABLE local_customers ADD COLUMN isPendingSync INTEGER NOT NULL DEFAULT 0',
      'updatedAt':
          "ALTER TABLE local_customers ADD COLUMN updatedAt TEXT NOT NULL DEFAULT ''",
    };
    for (final entry in additions.entries) {
      if (!names.contains(entry.key)) await db.execute(entry.value);
    }
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
    await db.execute('''
      CREATE TABLE IF NOT EXISTS local_credit_ledger (
        id TEXT PRIMARY KEY,
        businessId TEXT NOT NULL,
        customerId TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        paymentMethod TEXT,
        createdAt TEXT NOT NULL,
        isPendingSync INTEGER NOT NULL DEFAULT 0
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
    final id = _uuidV4();
    final timestamp = DateTime.now().toIso8601String();
    final normalizedPhone = phone?.trim() ?? '';

    await db.transaction((transaction) async {
      await transaction.insert(
          'local_customers',
          {
            'id': id,
            'businessId': businessId,
            'name': name.trim(),
            'phone': normalizedPhone,
            'creditLimit': initialCreditLimit,
            'currentDebt': 0.0,
            'isPendingSync': 1,
            'createdAt': timestamp,
            'updatedAt': timestamp,
          },
          conflictAlgorithm: ConflictAlgorithm.replace);

      await transaction.insert(
          'local_credit_accounts',
          {
            'customerId': id,
            'customer': name.trim(),
            'phone': normalizedPhone,
            'balance': 0.0,
            'lastTransactionAt': null,
            'transactionCount': 0,
            'initials': _initials(name),
            'colorValue': 0xFF123A8F,
          },
          conflictAlgorithm: ConflictAlgorithm.ignore);
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
        'currentDebt': 0.0,
        'createdAt': timestamp,
        'updatedAt': timestamp,
      },
    );

    return id;
  }

  Future<List<Map<String, dynamic>>> searchLocalCustomers(String query,
      {String businessId = 'demo-business'}) async {
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

  /// Returns a debtor only when the payer phone maps to exactly one local
  /// customer. SMS confirmations must never guess between shared numbers.
  Future<Map<String, dynamic>?> findUnambiguousLocalDebtorByPhone({
    required String businessId,
    required String phone,
  }) async {
    await ensureCustomerSchema();
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    final national = digits.startsWith('254') ? digits.substring(3) : digits;
    if (national.length < 9) return null;
    final suffix = national.substring(national.length - 9);
    final db = await _syncService.database;
    final rows = await db.rawQuery('''
      SELECT * FROM local_customers
      WHERE businessId = ?
        AND currentDebt > 0
        AND REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', ''), '(', '') LIKE ?
    ''', [businessId, '%$suffix%']);
    return rows.length == 1 ? rows.single : null;
  }

  Future<void> cacheRemoteCustomers(
    String businessId,
    List<Map<String, dynamic>> customers,
  ) async {
    await ensureCustomerSchema();
    final db = await _syncService.database;
    final batch = db.batch();
    for (final customer in customers) {
      final id = customer['id']?.toString();
      final name = customer['name']?.toString().trim();
      if (id == null || id.isEmpty || name == null || name.isEmpty) continue;
      final account = customer['creditAccount'] as Map?;
      batch.insert(
          'local_customers',
          {
            'id': id,
            'businessId': businessId,
            'name': name,
            'phone': customer['phone']?.toString() ?? '',
            'creditLimit': _number(customer['creditLimit']),
            'currentDebt': _number(account?['balance']),
            'isPendingSync': 0,
            'createdAt': customer['createdAt']?.toString() ??
                DateTime.now().toIso8601String(),
            'updatedAt': customer['updatedAt']?.toString() ??
                DateTime.now().toIso8601String(),
          },
          conflictAlgorithm: ConflictAlgorithm.replace);
      batch.insert(
          'local_credit_accounts',
          {
            'customerId': id,
            'customer': name,
            'phone': customer['phone']?.toString() ?? '',
            'balance': _number(account?['balance']),
            'lastTransactionAt': account?['lastPayment']?.toString(),
            'transactionCount': 0,
            'initials': _initials(name),
            'colorValue': 0xFF123A8F,
          },
          conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<List<Map<String, dynamic>>> loadLocalCreditAccounts(
      String businessId) async {
    await ensureCustomerSchema();
    final db = await _syncService.database;
    return db.rawQuery('''
      SELECT c.id, c.name, c.phone, c.creditLimit, c.currentDebt,
             c.isPendingSync, a.balance, a.lastTransactionAt,
             a.transactionCount, a.initials, a.colorValue
      FROM local_customers c
      LEFT JOIN local_credit_accounts a ON a.customerId = c.id
      WHERE c.businessId = ?
      ORDER BY c.name ASC
    ''', [businessId]);
  }

  Future<Map<String, dynamic>?> recordLocalCredit({
    required String businessId,
    required String customerId,
    required double amount,
    required bool isPayment,
    required String paymentMethod,
    required String userId,
  }) async {
    await ensureCustomerSchema();
    final db = await _syncService.database;
    if (amount <= 0) return null;
    final entryId = _uuidV4();
    final timestamp = DateTime.now().toIso8601String();
    Map<String, dynamic>? result;
    await db.transaction((transaction) async {
      final customers = await transaction.query('local_customers',
          where: 'id = ? AND businessId = ?',
          whereArgs: [customerId, businessId],
          limit: 1);
      if (customers.isEmpty) return;
      final customer = customers.first;
      final existingBalance = _number(customer['currentDebt']);
      if (isPayment && amount > existingBalance) return;
      final balance =
          isPayment ? existingBalance - amount : existingBalance + amount;
      await transaction.update(
          'local_customers',
          {
            'currentDebt': balance,
            'isPendingSync': 1,
            'updatedAt': timestamp,
          },
          where: 'id = ?',
          whereArgs: [customerId]);
      final accounts = await transaction.query('local_credit_accounts',
          where: 'customerId = ?', whereArgs: [customerId], limit: 1);
      final transactionCount = (accounts.isEmpty
              ? 0
              : _integer(accounts.first['transactionCount'])) +
          1;
      await transaction.insert(
          'local_credit_accounts',
          {
            'customerId': customerId,
            'customer': customer['name'],
            'phone': customer['phone'],
            'balance': balance,
            'lastTransactionAt': timestamp,
            'transactionCount': transactionCount,
            'initials': _initials(customer['name'] as String),
            'colorValue': 0xFF123A8F,
          },
          conflictAlgorithm: ConflictAlgorithm.replace);
      await transaction.insert('local_credit_ledger', {
        'id': entryId,
        'businessId': businessId,
        'customerId': customerId,
        'type': isPayment ? 'PAYMENT' : 'SALE',
        'amount': amount,
        'paymentMethod': paymentMethod,
        'createdAt': timestamp,
        'isPendingSync': 1,
      });
      result = {
        ...customer,
        'balance': balance,
        'lastTransactionAt': timestamp,
        'transactionCount': transactionCount,
      };
    });
    if (result == null) return null;
    await _syncService.queueChange(
      id: _uuidV4(),
      entityName: 'Credit',
      operation: 'CREATE',
      payload: {
        'id': entryId,
        'businessId': businessId,
        'customerId': customerId,
        'action': isPayment ? 'RECORD_PAYMENT' : 'RECORD_SALE',
        'amount': amount,
        'paymentMethod': paymentMethod,
        'userId': userId,
        'createdAt': timestamp,
      },
    );
    return result;
  }

  Future<Map<String, dynamic>?> loadLocalCreditAccount(
    String businessId,
    String customerId,
  ) async {
    final accounts = await loadLocalCreditAccounts(businessId);
    for (final account in accounts) {
      if (account['id']?.toString() == customerId) return account;
    }
    return null;
  }

  Future<List<Map<String, dynamic>>> loadLocalCreditLedger(
    String businessId,
    String customerId,
  ) async {
    await ensureCustomerSchema();
    final db = await _syncService.database;
    return db.query('local_credit_ledger',
        where: 'businessId = ? AND customerId = ?',
        whereArgs: [businessId, customerId],
        orderBy: 'createdAt DESC');
  }

  static double _number(Object? value) => value is num
      ? value.toDouble()
      : double.tryParse(value?.toString() ?? '') ?? 0;

  static int _integer(Object? value) =>
      value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;

  static String _uuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    String hex(int value) => value.toRadixString(16).padLeft(2, '0');
    final raw = bytes.map(hex).join();
    return '${raw.substring(0, 8)}-${raw.substring(8, 12)}-${raw.substring(12, 16)}-${raw.substring(16, 20)}-${raw.substring(20)}';
  }

  String _initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return 'CU';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
}
