import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';

class DashboardSnapshot {
  const DashboardSnapshot({
    required this.metadata,
    required this.summary,
    required this.paymentBreakdown,
    required this.topProducts,
    required this.recentTransactions,
    required this.lowStockItems,
    required this.scanActivity,
    this.isOfflineSnapshot = false,
    this.cachedAt,
  });

  final Map<String, dynamic> metadata;
  final Map<String, dynamic> summary;
  final Map<String, dynamic> paymentBreakdown;
  final List<Map<String, dynamic>> topProducts;
  final List<Map<String, dynamic>> recentTransactions;
  final List<Map<String, dynamic>> lowStockItems;
  final Map<String, dynamic> scanActivity;

  /// True when the dashboard is showing the last successfully fetched data.
  final bool isOfflineSnapshot;
  final DateTime? cachedAt;

  factory DashboardSnapshot.fromJson(
    Map<String, dynamic> json, {
    bool isOfflineSnapshot = false,
    DateTime? cachedAt,
  }) {
    List<Map<String, dynamic>> list(String key) {
      final value = json[key];
      if (value is! List) return const [];
      return value
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }

    return DashboardSnapshot(
      metadata: Map<String, dynamic>.from(json['metadata'] as Map? ?? const {}),
      summary: Map<String, dynamic>.from(json['summary'] as Map? ?? const {}),
      paymentBreakdown: Map<String, dynamic>.from(
          json['paymentBreakdown'] as Map? ?? const {}),
      topProducts: list('topProducts'),
      recentTransactions: list('recentTransactions'),
      lowStockItems: list('lowStockItems'),
      scanActivity:
          Map<String, dynamic>.from(json['scanActivity'] as Map? ?? const {}),
      isOfflineSnapshot: isOfflineSnapshot,
      cachedAt: cachedAt,
    );
  }

  static const empty = DashboardSnapshot(
    metadata: {},
    summary: {},
    paymentBreakdown: {},
    topProducts: [],
    recentTransactions: [],
    lowStockItems: [],
    scanActivity: {},
  );
}

/// Persistence boundary for dashboard snapshots. Keeping this separate makes
/// the network fallback testable and lets web use browser-backed storage too.
abstract class DashboardSnapshotCache {
  Future<void> write(String businessId, String payload);
  Future<CachedDashboardSnapshot?> read(String businessId);
}

class CachedDashboardSnapshot {
  const CachedDashboardSnapshot(
      {required this.payload, required this.cachedAt});

  final String payload;
  final DateTime cachedAt;
}

class SecureDashboardSnapshotCache implements DashboardSnapshotCache {
  SecureDashboardSnapshotCache({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  String _payloadKey(String businessId) =>
      'mobiduka.dashboard.$businessId.payload';
  String _timestampKey(String businessId) =>
      'mobiduka.dashboard.$businessId.cachedAt';

  @override
  Future<void> write(String businessId, String payload) async {
    await _storage.write(key: _payloadKey(businessId), value: payload);
    await _storage.write(
      key: _timestampKey(businessId),
      value: DateTime.now().toUtc().toIso8601String(),
    );
  }

  @override
  Future<CachedDashboardSnapshot?> read(String businessId) async {
    final values = await Future.wait([
      _storage.read(key: _payloadKey(businessId)),
      _storage.read(key: _timestampKey(businessId)),
    ]);
    final payload = values[0];
    if (payload == null || payload.isEmpty) return null;
    return CachedDashboardSnapshot(
      payload: payload,
      cachedAt: DateTime.tryParse(values[1] ?? '')?.toLocal() ?? DateTime.now(),
    );
  }
}

class DashboardUnavailableException implements Exception {
  const DashboardUnavailableException();

  @override
  String toString() =>
      'Dashboard data is unavailable offline. Connect once to load it.';
}

class DashboardService {
  DashboardService({
    http.Client? client,
    AuthService? authService,
    DashboardSnapshotCache? cache,
  })  : _client = client ?? http.Client(),
        _authService = authService ?? AuthService(),
        _cache = cache ?? SecureDashboardSnapshotCache();

  final http.Client _client;
  final AuthService _authService;
  final DashboardSnapshotCache _cache;

  Future<DashboardSnapshot> load() async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to load dashboard data.');
    }

    try {
      final response = await _client.get(
        Uri.parse(
            '${ApiConfig.origin}/api/dashboard/summary?businessId=${Uri.encodeQueryComponent(businessId)}'),
        headers: {
          'Authorization': 'Bearer ${session.token}',
          'Content-Type': 'application/json'
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode >= 500) return _loadCachedSnapshot(businessId);

      final decoded = jsonDecode(response.body);
      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          decoded is! Map<String, dynamic>) {
        final message = decoded is Map<String, dynamic>
            ? decoded['error']?.toString()
            : null;
        throw Exception(message ?? 'Unable to load dashboard data.');
      }

      // A storage failure must never turn a successful dashboard response into
      // an error. The live response is still safe to render.
      try {
        await _cache.write(businessId, response.body);
      } on Object {
        // Browser storage can be disabled or full; use the live response only.
      }
      return DashboardSnapshot.fromJson(decoded);
    } on http.ClientException {
      return _loadCachedSnapshot(businessId);
    } on TimeoutException {
      return _loadCachedSnapshot(businessId);
    }
  }

  Future<DashboardSnapshot> _loadCachedSnapshot(String businessId) async {
    try {
      final cached = await _cache.read(businessId);
      if (cached == null) throw const DashboardUnavailableException();
      final decoded = jsonDecode(cached.payload);
      if (decoded is! Map<String, dynamic>)
        throw const DashboardUnavailableException();
      return DashboardSnapshot.fromJson(
        decoded,
        isOfflineSnapshot: true,
        cachedAt: cached.cachedAt,
      );
    } on DashboardUnavailableException {
      rethrow;
    } on Object {
      throw const DashboardUnavailableException();
    }
  }
}
