import 'package:flutter_test/flutter_test.dart';
import 'package:mobiduka_pos/services/auxiliary_directory_service.dart';
import 'package:mobiduka_pos/services/cash_service.dart';
import 'package:mobiduka_pos/services/customer_repository.dart';
import 'package:mobiduka_pos/services/observability_dashboard_service.dart';
import 'package:mobiduka_pos/services/sync_service.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  const businessId = 'auxiliary-test-business';
  late SyncService sync;
  late AuxiliaryDirectoryService auxiliary;

  setUp(() async {
    sync = SyncService();
    auxiliary = AuxiliaryDirectoryService(syncService: sync);
    await CashService(syncService: sync).ensureSchemaExists();
    await CustomerRepository(syncService: sync).ensureCustomerSchema();
    final db = await sync.database;
    for (final table in [
      'sync_queue',
      'local_supplier_directory',
      'local_purchase_orders',
      'offline_collection_cache',
      'local_cash_drawers',
      'local_customers',
      'local_credit_accounts',
      'local_credit_ledger',
      'mpesa_sms_cache',
    ]) {
      await db.delete(table);
    }
  });

  test('supplier, purchase order, and settings persist and queue offline',
      () async {
    final supplier = await auxiliary.createSupplier(
        businessId: businessId,
        name: 'Millers Ltd',
        category: 'Food',
        contact: 'Amina',
        phone: '0711223344',
        email: 'orders@millers.test');
    final order = await auxiliary.createPurchaseOrder(
        businessId: businessId,
        supplierId: supplier['id'] as String,
        dueDate: '2026-10-01',
        items: [
          {'productId': 'product-1', 'quantity': 3, 'costPrice': 120},
        ]);
    await auxiliary.receivePurchaseOrder(
        businessId: businessId, orderId: order['id'] as String);
    final settings = await auxiliary.saveSettings(
        businessId: businessId,
        patch: {'currency': 'KES', 'mpesaEnabled': false});

    expect((await auxiliary.loadSuppliers(businessId)).single['name'],
        'Millers Ltd');
    expect((await auxiliary.loadPurchaseOrders(businessId)).single['status'],
        'RECEIVED');
    expect((settings['preferences'] as Map)['mpesaEnabled'], isFalse);
    final events = await (await sync.database).query('sync_queue');
    expect(
        events.where((row) => row['entityName'] == 'Supplier'), hasLength(1));
    expect(events.where((row) => row['entityName'] == 'PurchaseOrder'),
        hasLength(2));
    expect(events.where((row) => row['entityName'] == 'SettingsProfile'),
        hasLength(1));
  });

  test('observability aggregates local cash, queue, and debt', () async {
    await CashService(syncService: sync).openSession(
        businessId: businessId, userId: 'cashier-1', openingCash: 1000);
    await sync.queueChange(
        id: 'sale-event',
        entityName: 'Sale',
        operation: 'CREATE',
        payload: {
          'id': 'sale-1',
          'businessId': businessId,
          'total': 600,
        });
    await sync.queueChange(
        id: 'expense-event',
        entityName: 'Expense',
        operation: 'CREATE',
        payload: {
          'id': 'expense-1',
          'businessId': businessId,
          'amount': 100,
        });
    final customer = await CustomerRepository(syncService: sync)
        .createOfflineCustomer(businessId: businessId, name: 'Debt customer');
    await CustomerRepository(syncService: sync).recordLocalCredit(
        businessId: businessId,
        customerId: customer,
        amount: 250,
        isPayment: false,
        paymentMethod: 'CREDIT',
        userId: 'cashier-1');
    final snapshot = await ObservabilityDashboardService(syncService: sync)
        .refresh(businessId);
    expect(snapshot.cashInDrawer, 1500);
    expect(snapshot.pendingSales, 600);
    expect(snapshot.pendingExpenses, 100);
    expect(snapshot.outstandingDebt, 250);
    expect(snapshot.pendingEvents, greaterThanOrEqualTo(5));
  });
}
