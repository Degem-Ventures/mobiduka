import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import 'sync_service.dart';

class CashService {
  CashService({SyncService? syncService})
      : _syncService = syncService ?? SyncService();

  final SyncService _syncService;

  Future<void> ensureSchemaExists() async {
    final db = await _syncService.database;
    await db.execute('''
      CREATE TABLE IF NOT EXISTS local_cash_drawers (
        id TEXT PRIMARY KEY,
        businessId TEXT,
        userId TEXT,
        openingCash REAL,
        closingCash REAL,
        status TEXT,
        openedAt TEXT,
        closedAt TEXT,
        shiftTypeId TEXT,
        expectedBalance REAL,
        variance REAL,
        isPendingSync INTEGER NOT NULL DEFAULT 0
      )
    ''');
    final columns = await db.rawQuery('PRAGMA table_info(local_cash_drawers)');
    final names = columns.map((column) => column['name']).toSet();
    for (final entry in <String, String>{
      'shiftTypeId':
          'ALTER TABLE local_cash_drawers ADD COLUMN shiftTypeId TEXT',
      'expectedBalance':
          'ALTER TABLE local_cash_drawers ADD COLUMN expectedBalance REAL',
      'variance': 'ALTER TABLE local_cash_drawers ADD COLUMN variance REAL',
      'isPendingSync':
          'ALTER TABLE local_cash_drawers ADD COLUMN isPendingSync INTEGER NOT NULL DEFAULT 0',
    }.entries) {
      if (!names.contains(entry.key)) await db.execute(entry.value);
    }
  }

  Future<List<Map<String, dynamic>>> loadLocalSessions(
      String businessId) async {
    await ensureSchemaExists();
    final db = await _syncService.database;
    final rows = await db.query(
      'local_cash_drawers',
      where: 'businessId = ?',
      whereArgs: [businessId],
      orderBy: 'openedAt DESC',
    );
    return rows.map((row) {
      final closedAt = row['closedAt']?.toString();
      return <String, dynamic>{
        ...row,
        'cashierId': row['userId'],
        'openingBalance': row['openingCash'],
        'closingBalance': row['closingCash'],
        'closedAt': closedAt == null || closedAt.isEmpty ? null : closedAt,
        'cashier': {'id': row['userId'], 'fullName': 'Offline cashier'},
      };
    }).toList();
  }

  Future<void> cacheRemoteSessions({
    required String businessId,
    required List<Map<String, dynamic>> sessions,
  }) async {
    await ensureSchemaExists();
    final db = await _syncService.database;
    final batch = db.batch();
    for (final session in sessions) {
      final id = session['id']?.toString();
      if (id == null || id.isEmpty) continue;
      batch.insert(
          'local_cash_drawers',
          {
            'id': id,
            'businessId': businessId,
            'userId': session['cashierId']?.toString() ?? '',
            'openingCash':
                _number(session['openingBalance'] ?? session['openingCash']),
            'closingCash':
                _number(session['closingBalance'] ?? session['closingCash']),
            'status': session['closedAt'] == null ? 'OPEN' : 'CLOSED',
            'openedAt': session['openedAt']?.toString() ?? '',
            'closedAt': session['closedAt']?.toString() ?? '',
            'shiftTypeId': session['shiftTypeId']?.toString() ?? '',
            'expectedBalance': _number(session['expectedBalance']),
            'variance': _number(session['variance']),
            'isPendingSync': 0,
          },
          conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit(noResult: true);
  }

  Future<Map<String, dynamic>?> getActiveSession({
    required String businessId,
    required String userId,
  }) async {
    await ensureSchemaExists();
    final db = await _syncService.database;

    final rows = await db.query(
      'local_cash_drawers',
      where: 'businessId = ? AND userId = ? AND status = ?',
      whereArgs: [businessId, userId, 'OPEN'],
      orderBy: 'openedAt DESC',
      limit: 1,
    );

    if (rows.isEmpty) {
      return null;
    }

    return rows.first;
  }

  Future<String> openSession({
    required String businessId,
    required String userId,
    required double openingCash,
    String? shiftTypeId,
  }) async {
    await ensureSchemaExists();
    final db = await _syncService.database;

    final sessionId =
        'session-${DateTime.now().millisecondsSinceEpoch}-$userId';
    final timestamp = DateTime.now().toIso8601String();

    final sessionData = {
      'id': sessionId,
      'businessId': businessId,
      'userId': userId,
      'openingCash': openingCash,
      'closingCash': 0.0,
      'status': 'OPEN',
      'openedAt': timestamp,
      'closedAt': '',
      'shiftTypeId': shiftTypeId ?? '',
      'expectedBalance': openingCash,
      'variance': 0.0,
      'isPendingSync': 1,
    };

    await db.insert(
      'local_cash_drawers',
      sessionData,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );

    await _syncService.queueChange(
      id: 'sync-$sessionId',
      entityName: 'CashSession',
      operation: 'CREATE',
      payload: {
        'action': 'OPEN',
        'id': sessionId,
        'businessId': businessId,
        'userId': userId,
        'openingCash': openingCash,
        if (shiftTypeId != null && shiftTypeId.isNotEmpty)
          'shiftTypeId': shiftTypeId,
        'openedAt': timestamp,
      },
    );

    return sessionId;
  }

  Future<Map<String, dynamic>> closeSession({
    required String sessionId,
    required String businessId,
    required String userId,
    required double closingCash,
  }) async {
    await ensureSchemaExists();
    final db = await _syncService.database;
    final timestamp = DateTime.now().toIso8601String();

    final maps = await db.query(
      'local_cash_drawers',
      where: 'id = ?',
      whereArgs: [sessionId],
      limit: 1,
    );

    if (maps.isEmpty) {
      throw Exception('Target local session not found.');
    }

    final openingCash = (maps.first['openingCash'] as num).toDouble();
    final openedAt = maps.first['openedAt'] as String;

    final queueRows = await db.query('sync_queue');
    double totalCashSales = 0.0;
    double totalCashExpenses = 0.0;

    for (final row in queueRows) {
      final entityName = row['entityName'] as String? ?? '';
      final payloadText = row['payload'] as String? ?? '';
      if (payloadText.isEmpty) continue;

      try {
        final payload = jsonDecode(payloadText) as Map<String, dynamic>;
        final createdAt = DateTime.tryParse(row['createdAt'] as String? ?? '');
        if (createdAt == null ||
            createdAt.isBefore(DateTime.tryParse(openedAt) ?? createdAt)) {
          continue;
        }
        final businessMatches = payload['businessId'] == businessId;
        if (!businessMatches) {
          continue;
        }
        final paymentMode =
            (payload['paymentMode'] ?? payload['paymentMethod'] ?? '')
                .toString()
                .toUpperCase();
        if (entityName == 'Sale' && paymentMode == 'CASH') {
          final amount = payload['totalAmount'] ?? payload['total'] ?? 0;
          totalCashSales += (amount as num).toDouble();
        }
        if (entityName == 'Expense' && paymentMode == 'CASH') {
          final amount = payload['amount'];
          totalCashExpenses += amount is num
              ? amount.toDouble()
              : double.tryParse(amount?.toString() ?? '') ?? 0;
        }
      } catch (_) {
        continue;
      }
    }

    final expectedBalance = openingCash + totalCashSales - totalCashExpenses;
    final variance = closingCash - expectedBalance;

    await db.update(
      'local_cash_drawers',
      {
        'closingCash': closingCash,
        'status': 'CLOSED',
        'closedAt': timestamp,
        'expectedBalance': expectedBalance,
        'variance': variance,
        'isPendingSync': 1,
      },
      where: 'id = ?',
      whereArgs: [sessionId],
    );

    await _syncService.queueChange(
      id: 'sync-close-$sessionId',
      entityName: 'CashSession',
      operation: 'UPDATE',
      payload: {
        'action': 'CLOSE',
        'sessionId': sessionId,
        'businessId': businessId,
        'userId': userId,
        'closingCash': closingCash,
        'expectedBalance': expectedBalance,
        'variance': variance,
        'closedAt': timestamp,
      },
    );

    return {
      'sessionId': sessionId,
      'openingCash': openingCash,
      'totalCashSales': totalCashSales,
      'totalCashExpenses': totalCashExpenses,
      'expectedBalance': expectedBalance,
      'actualCounted': closingCash,
      'variance': variance,
      'openedAt': openedAt,
      'closedAt': timestamp,
    };
  }

  double _number(Object? value) => value is num
      ? value.toDouble()
      : double.tryParse(value?.toString() ?? '') ?? 0;
}
