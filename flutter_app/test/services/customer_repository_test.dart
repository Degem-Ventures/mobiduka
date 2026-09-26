import 'package:flutter_test/flutter_test.dart';
import 'package:mobiduka_pos/services/customer_repository.dart';
import 'package:mobiduka_pos/services/sync_service.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  group('CustomerRepository offline ledger', () {
    late SyncService syncService;
    late CustomerRepository repository;

    setUp(() async {
      syncService = SyncService();
      repository = CustomerRepository(syncService: syncService);
      await repository.ensureCustomerSchema();
      final db = await syncService.database;
      await db.delete('local_credit_ledger');
      await db.delete('local_credit_accounts');
      await db.delete('local_customers');
      await db.delete('sync_queue');
    });

    test('creates a customer and records charge and repayment locally',
        () async {
      const businessId = 'customer-test-business';
      final customerId = await repository.createOfflineCustomer(
        businessId: businessId,
        name: 'Jane Doe',
        phone: '0712345678',
        initialCreditLimit: 5000,
      );

      final afterCharge = await repository.recordLocalCredit(
        businessId: businessId,
        customerId: customerId,
        amount: 1200,
        isPayment: false,
        paymentMethod: 'CREDIT',
        userId: 'user-1',
      );
      expect(afterCharge?['balance'], 1200.0);

      final afterPayment = await repository.recordLocalCredit(
        businessId: businessId,
        customerId: customerId,
        amount: 200,
        isPayment: true,
        paymentMethod: 'CASH',
        userId: 'user-1',
      );
      expect(afterPayment?['balance'], 1000.0);

      final customers =
          await repository.searchLocalCustomers('', businessId: businessId);
      expect(customers, hasLength(1));
      expect(customers.single['currentDebt'], 1000.0);
      expect(customers.single['isPendingSync'], 1);

      final ledger =
          await repository.loadLocalCreditLedger(businessId, customerId);
      expect(ledger, hasLength(2));

      final db = await syncService.database;
      final events = await db.query('sync_queue', orderBy: 'createdAt ASC');
      expect(events.where((event) => event['entityName'] == 'Customer'),
          hasLength(1));
      expect(events.where((event) => event['entityName'] == 'Credit'),
          hasLength(2));
    });
  });
}
