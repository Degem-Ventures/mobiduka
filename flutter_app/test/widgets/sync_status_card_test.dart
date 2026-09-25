import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobiduka_pos/services/sync_scheduler.dart';
import 'package:mobiduka_pos/services/sync_service.dart';
import 'package:mobiduka_pos/widgets/sync_status_card.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

class FakeSyncScheduler extends SyncScheduler {
  FakeSyncScheduler(Database db)
      : super(
          db: db,
          syncService: SyncService(),
          sendBatch: (_) async => true,
        );

  final StreamController<SyncStatusUpdate> _updates =
      StreamController<SyncStatusUpdate>.broadcast();
  int triggerCount = 0;

  @override
  Stream<SyncStatusUpdate> get statusStream => _updates.stream;

  @override
  Future<void> triggerSyncCycle() async {
    triggerCount++;
  }

  void emit(SyncStatusUpdate update) => _updates.add(update);

  @override
  void dispose() {
    _updates.close();
    super.dispose();
  }
}

void main() {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  late Database db;
  late FakeSyncScheduler scheduler;

  setUp(() async {
    db = await openDatabase(inMemoryDatabasePath);
    scheduler = FakeSyncScheduler(db);
  });

  tearDown(() async {
    scheduler.dispose();
    await db.close();
  });

  Widget buildSubject() {
    return MaterialApp(
      home: Scaffold(
        body: SyncStatusCard(scheduler: scheduler),
      ),
    );
  }

  testWidgets('hides the card when the queue is clean', (tester) async {
    await tester.pumpWidget(buildSubject());
    scheduler.emit(const SyncStatusUpdate(
      pendingCount: 0,
      inFlightCount: 0,
      schedulerState: SyncSchedulerState.idle,
    ));
    await tester.pump();

    expect(find.byType(AnimatedContainer), findsNothing);
  });

  testWidgets('shows offline queue state', (tester) async {
    await tester.pumpWidget(buildSubject());
    scheduler.emit(const SyncStatusUpdate(
      pendingCount: 3,
      inFlightCount: 0,
      schedulerState: SyncSchedulerState.pausedNoNetwork,
    ));
    await tester.pump();

    expect(find.text('Sync paused - offline mode'), findsOneWidget);
    expect(find.text('3 changes remain in the local queue.'), findsOneWidget);
    expect(find.byIcon(Icons.cloud_off), findsOneWidget);
  });

  testWidgets('shows active transfer progress', (tester) async {
    await tester.pumpWidget(buildSubject());
    scheduler.emit(const SyncStatusUpdate(
      pendingCount: 5,
      inFlightCount: 2,
      schedulerState: SyncSchedulerState.synchronizing,
    ));
    await tester.pump();

    expect(find.text('Synchronizing changes'), findsOneWidget);
    expect(find.text('Uploading 2 items. 5 changes remain in the local queue.'),
        findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('exposes a manual retry action after an error', (tester) async {
    await tester.pumpWidget(buildSubject());
    scheduler.emit(const SyncStatusUpdate(
      pendingCount: 1,
      inFlightCount: 0,
      schedulerState: SyncSchedulerState.idle,
      lastErrorMessage: 'Server rejected payload.',
    ));
    await tester.pump();

    expect(find.text('Sync needs attention'), findsOneWidget);
    expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    await tester.tap(find.byIcon(Icons.refresh));
    expect(scheduler.triggerCount, 1);
  });
}
