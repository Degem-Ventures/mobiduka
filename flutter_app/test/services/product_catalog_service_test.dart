import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobiduka_pos/services/auth_service.dart';
import 'package:mobiduka_pos/services/offline_snapshot_cache.dart';
import 'package:mobiduka_pos/services/product_catalog_service.dart';

class CatalogFakeAuthService extends AuthService {
  CatalogFakeAuthService(this.session);

  final AuthSession? session;

  @override
  Future<AuthSession?> readSession() async => session;
}

class MemorySnapshotCache implements OfflineSnapshotCache {
  final Map<String, Object> _values = {};

  String _key(String businessId, String key) => '$businessId:$key';

  @override
  Future<Object?> readJson(
          {required String businessId, required String key}) async =>
      _values[_key(businessId, key)];

  @override
  Future<void> writeJson({
    required String businessId,
    required String key,
    required Object value,
  }) async {
    _values[_key(businessId, key)] = value;
  }
}

class CatalogResponseClient extends http.BaseClient {
  CatalogResponseClient(this.handler);

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

  test('uses the persisted catalogue when the products request is offline',
      () async {
    final cache = MemorySnapshotCache();
    final onlineService = ProductCatalogService(
      authService: CatalogFakeAuthService(session),
      cache: cache,
      client: CatalogResponseClient((_) async => http.Response(
            jsonEncode([
              {
                'name': 'Unga',
                'costPrice': 100,
                'sellingPrice': 130,
                'minimumStock': 5,
                'barcode': '12345',
                'category': {'name': 'Flour'},
                'inventory': {'quantity': 12},
              }
            ]),
            200,
          )),
    );

    await onlineService.load();

    final offlineService = ProductCatalogService(
      authService: CatalogFakeAuthService(session),
      cache: cache,
      client: CatalogResponseClient((_) => Future<http.Response>.error(
            http.ClientException('host lookup failed'),
          )),
    );
    final products = await offlineService.load();

    expect(products, hasLength(1));
    expect(products.single.name, 'Unga');
    expect(products.single.stock, 12);
    expect(products.single.barcode, '12345');
  });
}
