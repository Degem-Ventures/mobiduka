import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:mobiduka_pos/services/sync_service.dart';

void main() {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  group('SyncService schema migration and ordered events', () {
    late Database db;

    setUp(() async {
      db = await openDatabase(inMemoryDatabasePath);
    });

    tearDown(() async {
      await db.close();
    });

    test(
      'normalizes legacy NULL values without removing chronological events',
      () async {
        await db.execute('''
          CREATE TABLE sync_queue (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            createdAt TEXT NOT NULL
          )
        ''');

        await db.execute("ALTER TABLE sync_queue ADD COLUMN businessId TEXT;");
        await db.execute("ALTER TABLE sync_queue ADD COLUMN entityName TEXT;");
        await db.execute("ALTER TABLE sync_queue ADD COLUMN externalId TEXT;");

        final String olderTime =
            DateTime.now().subtract(const Duration(hours: 2)).toIso8601String();
        final String intermediateTime =
            DateTime.now().subtract(const Duration(hours: 1)).toIso8601String();
        final String newestTime = DateTime.now().toIso8601String();

        await db.insert('sync_queue', {
          'id': 'rec_a1',
          'payload': '{"sale":"legacy_old"}',
          'createdAt': olderTime,
          'businessId': 'biz_01',
          'entityName': 'Sale',
          'externalId': 'ext_999',
        });

        await db.insert('sync_queue', {
          'id': 'rec_a2',
          'payload': '{"sale":"legacy_newest"}',
          'createdAt': newestTime,
          'businessId': 'biz_01',
          'entityName': 'Sale',
          'externalId': 'ext_999',
        });

        await db.insert('sync_queue', {
          'id': 'rec_a3',
          'payload': '{"sale":"legacy_mid"}',
          'createdAt': intermediateTime,
          'businessId': 'biz_01',
          'entityName': 'Sale',
          'externalId': 'ext_999',
        });

        await db.insert('sync_queue', {
          'id': 'rec_b1',
          'payload': '{"data":"null_fields"}',
          'createdAt': newestTime,
          'businessId': null,
          'entityName': null,
          'externalId': null,
        });

        await db.insert('sync_queue', {
          'id': 'rec_c1',
          'payload': '{"data":"mixed_fields"}',
          'createdAt': newestTime,
          'businessId': '',
          'entityName': null,
          'externalId': 'ext_unique',
        });

        final int initialCount = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) AS count FROM sync_queue'),
        )!;
        expect(initialCount, 5);

        await SyncService.migrateAndEvolveSchema(db);

        final int migratedCount = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) AS count FROM sync_queue'),
        )!;
        expect(migratedCount, 5);

        final List<Map<String, dynamic>> cleanCheck = await db.query(
          'sync_queue',
          where:
              "businessId = 'biz_01' AND entityName = 'Sale' AND externalId = 'ext_999'",
        );
        expect(cleanCheck.length, 3);
        expect(cleanCheck.map((row) => row['id']),
            containsAll(<String>['rec_a1', 'rec_a2', 'rec_a3']));

        final List<Map<String, dynamic>> nullCheck = await db.query(
          'sync_queue',
          where: "id = 'rec_b1'",
        );
        expect(nullCheck, isNotEmpty);
        expect(nullCheck.first['businessId'], '');
        expect(nullCheck.first['entityName'], '');
        expect(nullCheck.first['externalId'], '');
        expect(nullCheck.first['status'], 'PENDING');

        // The queue preserves separate events for the same entity. Server-side
        // receipts deduplicate immutable event IDs, while this local queue
        // keeps chronologically distinct updates (for example a restock after
        // an earlier sale) available to the scheduler.
        await db.insert('sync_queue', {
          'id': 'rec_later_event',
          'payload': '{}',
          'createdAt': DateTime.now().toIso8601String(),
          'businessId': 'biz_01',
          'entityName': 'Sale',
          'externalId': 'ext_999',
        });
        final eventCount = Sqflite.firstIntValue(await db.rawQuery(
          "SELECT COUNT(*) FROM sync_queue WHERE businessId = 'biz_01' AND entityName = 'Sale' AND externalId = 'ext_999'",
        ));
        expect(eventCount, 4);
      },
    );
  });
}
