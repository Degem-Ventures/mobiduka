import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobiduka_pos/services/auth_service.dart';
import 'package:mobiduka_pos/services/cash_service.dart';
import 'package:mobiduka_pos/services/expense_service.dart';
import 'package:mobiduka_pos/services/sync_service.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

class OfflineClient extends http.BaseClient {
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    throw http.ClientException('offline');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  const businessId = 'expense-cash-test-business';
  const userId = 'cashier-1';
  const session = AuthSession(
    token: 'offline-token',
    user: {'id': userId, 'businessId': businessId},
  );

  setUp(() async {
    final db = await SyncService().database;
    await CashService().ensureSchemaExists();
    await db.delete('sync_queue');
    await db.delete('offline_collection_cache');
    await db.delete('local_cash_drawers');
  });

  test('expenses are immediately cached and queued for replication', () async {
    final service = ExpenseService(
      client: OfflineClient(),
      syncService: SyncService(),
      sessionReader: () async => session,
    );

    final expenseId = await service.createExpense(
      description: 'Delivery fuel',
      amount: 850,
      category: 'Logistics',
      paymentMethod: 'Cash',
      recurring: false,
      date: '2026-09-26',
    );

    final expenses = await service.loadExpenses();
    expect(expenses.single['id'], expenseId);
    expect(expenses.single['isPendingSync'], isTrue);

    final db = await SyncService().database;
    final queued = await db.query('sync_queue');
    expect(queued, hasLength(1));
    expect(queued.single['entityName'], 'Expense');
    expect(jsonDecode(queued.single['payload'] as String)['id'], expenseId);
  });

  test('cash sessions preserve open and close events and local reconciliation',
      () async {
    final service = CashService(syncService: SyncService());
    final id = await service.openSession(
      businessId: businessId,
      userId: userId,
      openingCash: 1000,
      shiftTypeId: 'morning',
    );

    final db = await SyncService().database;
    await SyncService().queueChange(
      id: 'cash-sale',
      entityName: 'Sale',
      operation: 'CREATE',
      payload: {
        'id': 'sale-1',
        'businessId': businessId,
        'paymentMethod': 'CASH',
        'totalAmount': 600,
      },
    );
    await SyncService().queueChange(
      id: 'cash-expense',
      entityName: 'Expense',
      operation: 'CREATE',
      payload: {
        'id': 'expense-1',
        'businessId': businessId,
        'paymentMethod': 'CASH',
        'amount': 150,
      },
    );

    final close = await service.closeSession(
      sessionId: id,
      businessId: businessId,
      userId: userId,
      closingCash: 1450,
    );

    expect(close['expectedBalance'], 1450.0);
    expect(close['variance'], 0.0);
    final local = await service.loadLocalSessions(businessId);
    expect(local.single['closedAt'], isNotNull);
    expect(local.single['isPendingSync'], 1);

    final sessions = await db.query('sync_queue');
    expect(sessions.where((event) => event['entityName'] == 'CashSession'),
        hasLength(2));
  });
}
