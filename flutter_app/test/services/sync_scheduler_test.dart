import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobiduka_pos/services/sync_service.dart';
import 'package:mobiduka_pos/services/sync_scheduler.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

class FakeNetworkMonitor implements SyncNetworkMonitor {
  FakeNetworkMonitor({this.online = true});

  bool online;
  final StreamController<List<ConnectivityResult>> _controller =
      StreamController<List<ConnectivityResult>>.broadcast();

  @override
  Stream<List<ConnectivityResult>> get connectivityChanges =>
      _controller.stream;

  @override
  Future<bool> get isOnline async => online;

  void emit(List<ConnectivityResult> results) => _controller.add(results);
}

void main() {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  group('SyncScheduler', () {
    late Database db;

    setUp(() async {
      db = await openDatabase(inMemoryDatabasePath);
      await db.execute('''
        CREATE TABLE sync_queue (
          id TEXT PRIMARY KEY,
          businessId TEXT,
          entityName TEXT,
          operation TEXT,
          payload TEXT,
          status TEXT,
          attemptCount INTEGER,
          nextRetryAt TEXT,
          lastError TEXT,
          isSynced INTEGER,
          createdAt TEXT,
          externalId TEXT,
          payloadHash TEXT
        )
      ''');
    });

    tearDown(() async {
      await db.close();
    });

    test('marks sync queue as paused when the network is unavailable',
        () async {
      final monitor = FakeNetworkMonitor(online: false);
      final scheduler = SyncScheduler(
        db: db,
        syncService: SyncService(),
        networkMonitor: monitor,
        sendBatch: (_) async => true,
      );

      expect(scheduler.currentState, SyncSchedulerState.idle);

      await scheduler.handleNetworkChange([ConnectivityResult.none]);

      expect(scheduler.currentState, SyncSchedulerState.pausedNoNetwork);
      scheduler.dispose();
    });
  });
}
