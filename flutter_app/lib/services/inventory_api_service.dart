import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';
import 'catalog_mutation_service.dart';
import 'offline_snapshot_cache.dart';

class InventoryCategory {
  const InventoryCategory({required this.id, required this.name, this.emoji});
  final String id;
  final String name;
  final String? emoji;
}

/// Category and product mutations shared with the web Inventory screen.
class InventoryApiService {
  InventoryApiService({
    http.Client? client,
    AuthService? authService,
    OfflineSnapshotCache? cache,
    CatalogMutationService? catalogMutations,
  })  : _client = client ?? http.Client(),
        _authService = authService ?? AuthService(),
        _cache = cache ?? SecureOfflineSnapshotCache(),
        _catalogMutations = catalogMutations ?? CatalogMutationService();
  final http.Client _client;
  final AuthService _authService;
  final OfflineSnapshotCache _cache;
  final CatalogMutationService _catalogMutations;

  Future<List<InventoryCategory>> loadCategories() async {
    final session = await _session();
    try {
      final response =
          await _request('GET', '/api/categories', session: session);
      if (response is! List) throw Exception('Unable to load categories.');
      try {
        await _cache.writeJson(
          businessId: session.user['businessId']!.toString(),
          key: 'catalog.categories.v1',
          value: response,
        );
      } on Object {
        // Live category data remains usable when local storage is unavailable.
      }
      return _categoriesFromJson(response);
    } on http.ClientException {
      return _loadCachedCategories(session);
    } on TimeoutException {
      return _loadCachedCategories(session);
    }
  }

  List<InventoryCategory> _categoriesFromJson(List response) {
    return response
        .whereType<Map>()
        .map((item) {
          final category = Map<String, dynamic>.from(item);
          return InventoryCategory(
            id: category['id']?.toString() ?? '',
            name: category['name']?.toString() ?? '',
            emoji: category['emoji']?.toString(),
          );
        })
        .where((category) => category.id.isNotEmpty && category.name.isNotEmpty)
        .toList();
  }

  Future<List<InventoryCategory>> _loadCachedCategories(
      AuthSession session) async {
    try {
      final response = await _cache.readJson(
        businessId: session.user['businessId']!.toString(),
        key: 'catalog.categories.v1',
      );
      if (response is List) return _categoriesFromJson(response);
    } on Object {
      // Fall through to the user-safe no-cache message.
    }
    throw Exception(
        'Categories are unavailable offline. Connect once to refresh the catalogue.');
  }

  Future<InventoryCategory> createCategory(
      {required String name, required String emoji}) async {
    final response = await _request('POST', '/api/categories',
        body: {'name': name, 'emoji': emoji});
    if (response is! Map) throw Exception('Unable to save category.');
    return InventoryCategory(
        id: response['id']?.toString() ?? '',
        name: response['name']?.toString() ?? name,
        emoji: response['emoji']?.toString() ?? emoji);
  }

  Future<String> createProduct(Map<String, Object?> product) async {
    final session = await _session();
    final businessId = session.user['businessId']!.toString();
    final userId = session.user['id']?.toString();
    final categoryId = product['categoryId']?.toString();
    final name = product['name']?.toString().trim() ?? '';
    if (userId == null ||
        userId.isEmpty ||
        categoryId == null ||
        categoryId.isEmpty ||
        name.isEmpty) {
      throw Exception(
          'A signed-in user, product name, and category are required.');
    }
    final created = await _catalogMutations.createProduct(
      businessId: businessId,
      userId: userId,
      name: name,
      categoryId: categoryId,
      categoryName: product['categoryName']?.toString() ?? 'Uncategorized',
      cost: _number(product['costPrice']).toInt(),
      price: _number(product['sellingPrice'] ?? product['price']).toInt(),
      stock: _number(product['stock']).toInt(),
      reorder: _number(product['minimumStock']).toInt(),
      emoji: product['emoji']?.toString() ?? '📦',
      barcode: product['barcode']?.toString(),
    );
    return created.id!;
  }

  Future<Object?> _request(String method, String path,
      {Map<String, Object?>? body, AuthSession? session}) async {
    session ??= await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to manage inventory.');
    }
    final uri = Uri.parse(
        '${ApiConfig.origin}$path${method == 'GET' ? '?businessId=${Uri.encodeQueryComponent(businessId)}' : ''}');
    final requestBody =
        body == null ? null : jsonEncode({...body, 'businessId': businessId});
    final response = switch (method) {
      'GET' => await _client
          .get(uri, headers: {'Authorization': 'Bearer ${session.token}'}),
      _ => await _client.post(uri,
          headers: {
            'Authorization': 'Bearer ${session.token}',
            'Content-Type': 'application/json'
          },
          body: requestBody),
    };
    final decoded = jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(decoded is Map
          ? decoded['error']?.toString() ?? 'Inventory request failed.'
          : 'Inventory request failed.');
    }
    return decoded;
  }

  Future<AuthSession> _session() async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to manage inventory.');
    }
    return session;
  }

  static num _number(Object? value) =>
      value is num ? value : num.tryParse(value?.toString() ?? '') ?? 0;
}
