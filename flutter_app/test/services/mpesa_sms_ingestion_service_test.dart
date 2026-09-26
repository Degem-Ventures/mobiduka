import 'package:flutter_test/flutter_test.dart';
import 'package:mobiduka_pos/services/customer_repository.dart';
import 'package:mobiduka_pos/services/mpesa_sms_ingestion_service.dart';
import 'package:mobiduka_pos/services/sync_service.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  group('M-Pesa SMS ingestion', () {
    late SyncService syncService;
    late CustomerRepository customers;
    late MpesaSmsIngestionService service;

    setUp(() async {
      syncService = SyncService();
      customers = CustomerRepository(syncService: syncService);
      service = MpesaSmsIngestionService(
        syncService: syncService,
        customerRepository: customers,
      );
      await customers.ensureCustomerSchema();
      final db = await syncService.database;
      await db.delete('sync_queue');
      await db.delete('mpesa_sms_cache');
      await db.delete('local_credit_ledger');
      await db.delete('local_credit_accounts');
      await db.delete('local_customers');
    });

    test('deduplicates a Till confirmation and clears one matching debtor',
        () async {
      const businessId = 'mpesa-sms-business';
      const userId = 'cashier-1';
      final customerId = await customers.createOfflineCustomer(
        businessId: businessId,
        name: 'Jane Wanjiku',
        phone: '+254711223344',
        initialCreditLimit: 5000,
      );
      await customers.recordLocalCredit(
        businessId: businessId,
        customerId: customerId,
        amount: 1500,
        isPayment: false,
        paymentMethod: 'CREDIT',
        userId: userId,
      );

      const message =
          'SJK71X99ZZ Confirmed. Ksh1,500.00 received from Jane Wanjiku 0711223344 on 26/09/2026 at 10:00 AM.';
      final first = await service.ingestRawMessage(
        businessId: businessId,
        userId: userId,
        message: message,
      );
      final duplicate = await service.ingestRawMessage(
        businessId: businessId,
        userId: userId,
        message: message,
      );

      expect(first?.wasNew, isTrue);
      expect(first?.wasMatched, isTrue);
      expect(duplicate?.wasNew, isFalse);
      final account =
          await customers.loadLocalCreditAccount(businessId, customerId);
      expect(account?['balance'], 0.0);

      final db = await syncService.database;
      final receipts = await db.query('mpesa_sms_cache');
      expect(receipts, hasLength(1));
      expect(receipts.single['isMatched'], 1);
      final events = await db.query('sync_queue');
      expect(
          events.where((row) => row['entityName'] == 'Credit'), hasLength(2));
      expect(events.where((row) => row['entityName'] == 'MpesaSmsReceipt'),
          hasLength(1));
    });
  });
}
