import 'dart:async';
import 'dart:convert';

import 'sync_service.dart';

class StoreFinancialSnapshot {
  const StoreFinancialSnapshot({
    required this.cashInDrawer,
    required this.pendingSales,
    required this.pendingExpenses,
    required this.outstandingDebt,
    required this.pendingEvents,
    required this.mpesaReceiptsAwaitingReview,
    required this.activeSessionId,
  });

  final double cashInDrawer;
  final double pendingSales;
  final double pendingExpenses;
  final double outstandingDebt;
  final int pendingEvents;
  final int mpesaReceiptsAwaitingReview;
  final String? activeSessionId;
}

/// Read-only financial diagnostics computed from the durable local state.
class ObservabilityDashboardService {
  ObservabilityDashboardService({SyncService? syncService})
      : _syncService = syncService ?? SyncService();

  final SyncService _syncService;
  final _controller = StreamController<StoreFinancialSnapshot>.broadcast();
  Timer? _timer;

  Stream<StoreFinancialSnapshot> get snapshots => _controller.stream;

  Future<StoreFinancialSnapshot> refresh(String businessId) async {
    final db = await _syncService.database;
    final queue = await db
        .query('sync_queue', where: 'businessId = ?', whereArgs: [businessId]);
    double pendingSales = 0;
    double pendingExpenses = 0;
    for (final event in queue) {
      final payload = _payload(event['payload']);
      final name = event['entityName']?.toString();
      if (name == 'Sale') {
        pendingSales += _number(payload['total'] ?? payload['totalAmount']);
      }
      if (name == 'Expense') {
        pendingExpenses += _number(payload['amount']);
      }
    }
    final drawers = await db.query('local_cash_drawers',
        where: 'businessId = ? AND status = ?',
        whereArgs: [businessId, 'OPEN'],
        orderBy: 'openedAt DESC',
        limit: 1);
    final drawer = drawers.isEmpty ? null : drawers.single;
    final opening = drawer == null ? 0 : _number(drawer['openingCash']);
    final debtRows = await db.rawQuery(
        'SELECT COALESCE(SUM(currentDebt), 0) AS total FROM local_customers WHERE businessId = ?',
        [businessId]);
    final unmatchedRows = await db.rawQuery(
        'SELECT COUNT(*) AS total FROM mpesa_sms_cache WHERE businessId = ? AND isMatched = 0',
        [businessId]);
    final snapshot = StoreFinancialSnapshot(
      cashInDrawer: opening + pendingSales - pendingExpenses,
      pendingSales: pendingSales,
      pendingExpenses: pendingExpenses,
      outstandingDebt: _number(debtRows.single['total']),
      pendingEvents: queue.length,
      mpesaReceiptsAwaitingReview: _integer(unmatchedRows.single['total']),
      activeSessionId: drawer?['id']?.toString(),
    );
    if (!_controller.isClosed) _controller.add(snapshot);
    return snapshot;
  }

  void start(String businessId,
      {Duration interval = const Duration(seconds: 15)}) {
    _timer?.cancel();
    refresh(businessId);
    _timer = Timer.periodic(interval, (_) => refresh(businessId));
  }

  void dispose() {
    _timer?.cancel();
    _controller.close();
  }

  static Map<String, dynamic> _payload(Object? value) {
    try {
      final decoded = jsonDecode(value?.toString() ?? '');
      return decoded is Map ? Map<String, dynamic>.from(decoded) : const {};
    } on FormatException {
      return const {};
    }
  }

  static double _number(Object? value) => value is num
      ? value.toDouble()
      : double.tryParse(value?.toString() ?? '') ?? 0;
  static int _integer(Object? value) =>
      value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;
}
