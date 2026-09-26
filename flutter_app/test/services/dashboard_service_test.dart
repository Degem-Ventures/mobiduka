import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobiduka_pos/services/auth_service.dart';
import 'package:mobiduka_pos/services/dashboard_service.dart';

class FakeAuthService extends AuthService {
  FakeAuthService(this.session);

  final AuthSession? session;

  @override
  Future<AuthSession?> readSession() async => session;
}

class MemoryDashboardCache implements DashboardSnapshotCache {
  final Map<String, CachedDashboardSnapshot> _values = {};

  @override
  Future<CachedDashboardSnapshot?> read(String businessId) async =>
      _values[businessId];

  @override
  Future<void> write(String businessId, String payload) async {
    _values[businessId] = CachedDashboardSnapshot(
      payload: payload,
      cachedAt: DateTime.utc(2026, 1, 1),
    );
  }
}

class ResponseClient extends http.BaseClient {
  ResponseClient(this.handler);

  final Future<http.Response> Function(http.BaseRequest request) handler;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final response = await handler(request);
    return http.StreamedResponse(
      Stream.value(utf8.encode(response.body)),
      response.statusCode,
      request: request,
      headers: response.headers,
    );
  }
}

void main() {
  const session = AuthSession(
    token: 'test-token',
    user: {'businessId': 'business-1'},
  );

  test('uses a cached dashboard snapshot when the network request fails',
      () async {
    final cache = MemoryDashboardCache();
    final service = DashboardService(
      authService: FakeAuthService(session),
      cache: cache,
      client: ResponseClient((_) async => http.Response(
          jsonEncode({
            'metadata': {'name': 'Test Shop'},
            'summary': {'todayRevenue': 400},
            'paymentBreakdown': {},
            'topProducts': [],
            'recentTransactions': [],
            'lowStockItems': [],
            'scanActivity': {},
          }),
          200)),
    );

    await service.load();

    final offlineService = DashboardService(
      authService: FakeAuthService(session),
      cache: cache,
      client: ResponseClient((_) => Future<http.Response>.error(
            http.ClientException('host lookup failed'),
          )),
    );
    final snapshot = await offlineService.load();

    expect(snapshot.isOfflineSnapshot, isTrue);
    expect(snapshot.summary['todayRevenue'], 400);
    expect(snapshot.metadata['name'], 'Test Shop');
  });

  test('returns a clean error when offline data has never been cached',
      () async {
    final service = DashboardService(
      authService: FakeAuthService(session),
      cache: MemoryDashboardCache(),
      client: ResponseClient((_) => Future<http.Response>.error(
            http.ClientException('host lookup failed'),
          )),
    );

    expect(service.load(), throwsA(isA<DashboardUnavailableException>()));
  });
}
