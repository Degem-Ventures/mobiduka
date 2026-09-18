import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:sqflite/sqflite.dart';

import 'package:mobiduka_pos/services/sync_service.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('MobiDuka sync queue network-drop E2E coverage', () {
    late SyncService syncService;
    late Database database;

    setUp(() async {
      syncService = SyncService();
      database = await syncService.database;
      await database.delete('sync_queue');
    });

    tearDown(() async {
      await database.delete('sync_queue');
    });

    testWidgets(
      'retains all queued records when cloud sync cannot connect',
      (tester) async {
        const businessId = 'test-business-network-drop';
        const deviceId = 'test-device-network-drop';
        const userId = 'test-user-network-drop';

        for (var index = 1; index <= 5; index++) {
          await syncService.queueChange(
            id: 'offline-sale-$index',
            entityName: 'Sale',
            operation: 'CREATE',
            payload: {
              'businessId': businessId,
              'invoiceNo': 'OFFLINE-$index',
              'total': index * 100,
              'paymentMethod': 'CASH',
            },
          );
        }

        expect(
          await database.rawQuery('SELECT COUNT(*) AS count FROM sync_queue'),
          hasLength(1),
        );
        expect(
          (await database.rawQuery(
            'SELECT COUNT(*) AS count FROM sync_queue',
          )).single['count'],
          5,
        );

        // The API origin is overrideable with --dart-define. For this test,
        // point it at an unavailable endpoint to simulate a network drop.
        final syncCompleted = await syncService.processCloudSync(
          businessId: businessId,
          deviceId: deviceId,
          userId: userId,
        );

        expect(syncCompleted, isFalse);
        expect(
          (await database.rawQuery(
            'SELECT COUNT(*) AS count FROM sync_queue',
          )).single['count'],
          5,
          reason: 'Network failure must not delete queued transactions.',
        );
      },
    );
  });
}
