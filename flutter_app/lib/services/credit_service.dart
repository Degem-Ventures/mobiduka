import 'dart:io';

import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

class CreditAccount {
  const CreditAccount({
    required this.customerId,
    required this.customer,
    required this.phone,
    required this.balance,
    required this.lastTransactionAt,
    required this.transactionCount,
    required this.initials,
    required this.colorValue,
  });

  final String customerId;
  final String customer;
  final String phone;
  final double balance;
  final String? lastTransactionAt;
  final int transactionCount;
  final String initials;
  final int colorValue;

  CreditAccount copyWith({double? balance, String? lastTransactionAt, int? transactionCount}) {
    return CreditAccount(
      customerId: customerId,
      customer: customer,
      phone: phone,
      balance: balance ?? this.balance,
      lastTransactionAt: lastTransactionAt ?? this.lastTransactionAt,
      transactionCount: transactionCount ?? this.transactionCount,
      initials: initials,
      colorValue: colorValue,
    );
  }
}

class CreditService {
  CreditService._();

  static final CreditService instance = CreditService._();
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

    return openDatabase(
      join(documentsPath, 'mobiduka_credit.db'),
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE local_credit_accounts (
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
          CREATE TABLE local_credit_ledger (
            id TEXT PRIMARY KEY,
            customerId TEXT NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            createdAt TEXT NOT NULL
          )
        ''');
      },
    );
  }

  Future<List<CreditAccount>> loadCreditAccounts() async {
    final db = await database;
    final rows = await db.query('local_credit_accounts', orderBy: 'balance DESC');
    return rows.map((row) => CreditAccount(
      customerId: row['customerId'] as String,
      customer: row['customer'] as String,
      phone: row['phone'] as String? ?? '',
      balance: (row['balance'] as num?)?.toDouble() ?? 0,
      lastTransactionAt: row['lastTransactionAt'] as String?,
      transactionCount: row['transactionCount'] as int? ?? 0,
      initials: row['initials'] as String? ?? 'CU',
      colorValue: row['colorValue'] as int? ?? 0xFF123A8F,
    )).toList();
  }

  Future<void> saveCreditAccount(CreditAccount account) async {
    final db = await database;
    await db.insert(
      'local_credit_accounts',
      {
        'customerId': account.customerId,
        'customer': account.customer,
        'phone': account.phone,
        'balance': account.balance,
        'lastTransactionAt': account.lastTransactionAt,
        'transactionCount': account.transactionCount,
        'initials': account.initials,
        'colorValue': account.colorValue,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<CreditAccount?> recordOfflinePayment({
    required String customerId,
    required double amount,
  }) async {
    if (amount <= 0) return null;

    final db = await database;
    final rows = await db.query(
      'local_credit_accounts',
      where: 'customerId = ?',
      whereArgs: [customerId],
      limit: 1,
    );
    if (rows.isEmpty) return null;

    final account = _accountFromRow(rows.first);
    if (amount > account.balance) return null;

    final now = DateTime.now().toIso8601String();
    final updated = account.copyWith(
      balance: account.balance - amount,
      lastTransactionAt: now,
      transactionCount: account.transactionCount + 1,
    );

    await db.transaction((transaction) async {
      await transaction.update(
        'local_credit_accounts',
        {
          'balance': updated.balance,
          'lastTransactionAt': now,
          'transactionCount': updated.transactionCount,
        },
        where: 'customerId = ?',
        whereArgs: [customerId],
      );
      await transaction.insert('local_credit_ledger', {
        'id': 'credit-payment-${DateTime.now().microsecondsSinceEpoch}',
        'customerId': customerId,
        'type': 'PAYMENT',
        'amount': amount,
        'createdAt': now,
      });
    });

    return updated;
  }

  CreditAccount _accountFromRow(Map<String, dynamic> row) => CreditAccount(
    customerId: row['customerId'] as String,
    customer: row['customer'] as String,
    phone: row['phone'] as String? ?? '',
    balance: (row['balance'] as num?)?.toDouble() ?? 0,
    lastTransactionAt: row['lastTransactionAt'] as String?,
    transactionCount: row['transactionCount'] as int? ?? 0,
    initials: row['initials'] as String? ?? 'CU',
    colorValue: row['colorValue'] as int? ?? 0xFF123A8F,
  );
}
