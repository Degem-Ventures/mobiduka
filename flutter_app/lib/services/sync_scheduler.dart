import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;
import 'package:sqflite/sqflite.dart';

import 'api_config.dart';
import 'auth_service.dart';
import 'sync_service.dart';
import 'telemetry_http_client.dart';

enum SyncSchedulerState { idle, synchronizing, pausedNoNetwork }

class SyncStatusUpdate {
  const SyncStatusUpdate({
    required this.pendingCount,
    required this.inFlightCount,
    this.lastSuccessfulSync,
    this.lastErrorMessage,
    required this.schedulerState,
  });

  final int pendingCount;
  final int inFlightCount;
  final DateTime? lastSuccessfulSync;
  final String? lastErrorMessage;
  final SyncSchedulerState schedulerState;
}

abstract class SyncNetworkMonitor {
  Stream<List<ConnectivityResult>> get connectivityChanges;
  Future<bool> get isOnline;
}

class ConnectivitySyncNetworkMonitor implements SyncNetworkMonitor {
  ConnectivitySyncNetworkMonitor({Connectivity? connectivity})
      : _connectivity = connectivity ?? Connectivity();

  final Connectivity _connectivity;

  @override
  Stream<List<ConnectivityResult>> get connectivityChanges =>
      _connectivity.onConnectivityChanged;

  @override
  Future<bool> get isOnline async {
    final dynamic rawResult = await _connectivity.checkConnectivity();
    if (rawResult is! List) return false;
    final results = rawResult.whereType<ConnectivityResult>();
    return results.isNotEmpty && !results.contains(ConnectivityResult.none);
  }
}

class SyncScheduler {
  SyncScheduler({
    required Database db,
    required SyncService syncService,
    SyncNetworkMonitor? networkMonitor,
    Future<bool> Function(List<Map<String, dynamic>> records)? sendBatch,
    AuthService? authService,
    http.Client? httpClient,
    String? deviceId,
  })  : _db = db,
        _syncService = syncService,
        _networkMonitor = networkMonitor ?? ConnectivitySyncNetworkMonitor(),
        _authService = authService ?? AuthService(),
        _httpClient = httpClient ?? http.Client(),
        _ownsHttpClient = httpClient == null,
        _deviceId = deviceId,
        _sendBatch = sendBatch,
        _schedulerState = SyncSchedulerState.idle;

  final Database _db;
  final SyncService _syncService;
  final SyncNetworkMonitor _networkMonitor;
  final AuthService _authService;
  final http.Client _httpClient;
  final bool _ownsHttpClient;
  final String? _deviceId;
  final Future<bool> Function(List<Map<String, dynamic>> records)? _sendBatch;

  final StreamController<SyncStatusUpdate> _statusController =
      StreamController<SyncStatusUpdate>.broadcast();
  Timer? _pollingTimer;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;

  bool _disposed = false;
  bool _syncInProgress = false;
  DateTime? _lastSuccessfulSync;
  String? _lastError;
  SyncSchedulerState _schedulerState;

  Stream<SyncStatusUpdate> get statusStream => _statusController.stream;
  SyncSchedulerState get currentState => _schedulerState;

  Future<void> initialize() async {
    if (_disposed) return;

    _connectivitySubscription =
        _networkMonitor.connectivityChanges.listen((results) {
      handleNetworkChange(results);
    });

    _pollingTimer = Timer.periodic(const Duration(seconds: 30), (_) async {
      await triggerSyncCycle();
    });

    final online = await _networkMonitor.isOnline;
    if (!online) {
      _schedulerState = SyncSchedulerState.pausedNoNetwork;
    }
    _broadcastStatus();
  }

  Future<void> handleNetworkChange(List<ConnectivityResult> results) async {
    final dynamic rawResults = results;
    if (rawResults is! List) {
      _schedulerState = SyncSchedulerState.pausedNoNetwork;
      unawaited(_broadcastStatus());
      return;
    }
    final safeResults = rawResults.whereType<ConnectivityResult>();
    final hasConnection = safeResults.isNotEmpty &&
        !safeResults.contains(ConnectivityResult.none);
    if (!hasConnection) {
      _schedulerState = SyncSchedulerState.pausedNoNetwork;
      unawaited(_broadcastStatus());
      return;
    }

    if (_schedulerState == SyncSchedulerState.pausedNoNetwork) {
      _schedulerState = SyncSchedulerState.idle;
      await triggerSyncCycle();
    }
    unawaited(_broadcastStatus());
  }

  Future<void> triggerSyncCycle() async {
    if (_disposed || _syncInProgress) return;

    final online = await _networkMonitor.isOnline;
    if (!online) {
      _schedulerState = SyncSchedulerState.pausedNoNetwork;
      _broadcastStatus();
      return;
    }

    _syncInProgress = true;
    _schedulerState = SyncSchedulerState.synchronizing;
    _broadcastStatus();

    try {
      await _drainQueue();
      _lastError = null;
      _lastSuccessfulSync = DateTime.now();
    } catch (error) {
      _lastError = error.toString();
    } finally {
      _syncInProgress = false;
      _schedulerState = SyncSchedulerState.idle;
      _broadcastStatus();
    }
  }

  Future<void> _drainQueue() async {
    final now = DateTime.now().toIso8601String();
    final pendingRows = await _db.query(
      'sync_queue',
      where:
          "isSynced = 0 AND status != 'FAILED' AND (nextRetryAt IS NULL OR nextRetryAt <= ?)",
      whereArgs: [now],
      orderBy: 'createdAt ASC',
      limit: 25,
    );

    if (pendingRows.isEmpty) {
      return;
    }

    for (final row in pendingRows) {
      final recordId = row['id'] as String;
      final currentAttempts = (row['attemptCount'] as int?) ?? 0;

      await _db.update(
        'sync_queue',
        {'status': 'IN_FLIGHT'},
        where: 'id = ?',
        whereArgs: [recordId],
      );

      try {
        final payload = row['payload'] as String?;
        final decoded = payload == null
            ? <String, dynamic>{}
            : Map<String, dynamic>.from(
                jsonDecode(payload) as Map<String, dynamic>,
              );

        final batch = [
          {
            'id': recordId,
            'entityName': row['entityName'],
            'operation': row['operation'],
            'externalId': row['externalId'],
            'payloadHash': row['payloadHash'],
            'payload': decoded,
            'createdAt': row['createdAt'],
          }
        ];

        final success =
            await (_sendBatch?.call(batch) ?? _executeNetworkPost(batch));
        if (success) {
          await _db.update(
            'sync_queue',
            {'status': 'ACKED', 'isSynced': 1, 'nextRetryAt': null},
            where: 'id = ?',
            whereArgs: [recordId],
          );
          continue;
        }

        await _handleFailure(
            recordId, currentAttempts, 'Server validation rejection.');
      } catch (error) {
        await _handleFailure(recordId, currentAttempts, error.toString());
      }
    }
  }

  Future<void> _handleFailure(
      String id, int attemptCount, String reason) async {
    final nextAttempt = attemptCount + 1;
    if (nextAttempt >= 10) {
      await _db.update(
        'sync_queue',
        {
          'status': 'FAILED',
          'lastError': 'Max retry limit reached: $reason',
          'nextRetryAt': null,
        },
        where: 'id = ?',
        whereArgs: [id],
      );
      return;
    }

    final waitWindow = _computeBackoff(nextAttempt);
    await _db.update(
      'sync_queue',
      {
        'status': 'PENDING',
        'attemptCount': nextAttempt,
        'nextRetryAt': waitWindow.toIso8601String(),
        'lastError': reason,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  DateTime _computeBackoff(int attemptCount) {
    return _syncService.calculateBackoffDelay(attemptCount);
  }

  Future<bool> _executeNetworkPost(List<Map<String, dynamic>> records) async {
    final session = await _authService.readSession();
    if (session == null || session.token.trim().isEmpty) {
      throw StateError('Cannot synchronize without an authenticated session.');
    }

    final businessId = session.user['businessId']?.toString().trim();
    final userId = session.user['id']?.toString().trim();
    final deviceId = _deviceId?.trim();
    if (businessId == null ||
        businessId.isEmpty ||
        userId == null ||
        userId.isEmpty) {
      throw StateError(
          'Authenticated sync session is missing business or user identity.');
    }
    if (deviceId == null || deviceId.isEmpty) {
      throw StateError('Sync scheduler requires a registered device identity.');
    }

    final request =
        http.Request('POST', Uri.parse('${ApiConfig.apiBase}/sync'));
    request.headers.addAll({
      'Authorization': 'Bearer ${session.token}',
      'Content-Type': 'application/json',
    });
    request.body = jsonEncode({
      'businessId': businessId,
      'deviceId': deviceId,
      'userId': userId,
      'records': records,
    });

    final response = await TelemetryHttpClient(
      _httpClient,
      businessId: businessId,
    ).send(request);
    final body = await response.stream.bytesToString();
    Map<String, dynamic>? responseData;
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) responseData = decoded;
    } on FormatException {
      responseData = null;
    }

    if (response.statusCode == 200 && responseData?['success'] == true) {
      return true;
    }

    final detail = responseData?['details'] ?? responseData?['error'] ?? body;
    throw http.ClientException(
      'Sync request failed with HTTP ${response.statusCode}: $detail',
      request.url,
    );
  }

  Future<void> _broadcastStatus() async {
    if (_disposed || !_db.isOpen) return;

    try {
      final pendingCount = Sqflite.firstIntValue(await _db.rawQuery(
            "SELECT COUNT(*) FROM sync_queue WHERE isSynced = 0 AND status != 'FAILED'",
          )) ??
          0;

      final inFlightCount = Sqflite.firstIntValue(await _db.rawQuery(
            "SELECT COUNT(*) FROM sync_queue WHERE status = 'IN_FLIGHT'",
          )) ??
          0;

      _statusController.add(
        SyncStatusUpdate(
          pendingCount: pendingCount,
          inFlightCount: inFlightCount,
          lastSuccessfulSync: _lastSuccessfulSync,
          lastErrorMessage: _lastError,
          schedulerState: _schedulerState,
        ),
      );
    } catch (_) {
      // Ignore late events after teardown or database closure.
    }
  }

  void dispose() {
    _disposed = true;
    _pollingTimer?.cancel();
    _connectivitySubscription?.cancel();
    _statusController.close();
    if (_ownsHttpClient) _httpClient.close();
  }
}
