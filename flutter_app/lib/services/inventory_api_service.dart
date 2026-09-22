import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';

class InventoryCategory {
  const InventoryCategory({required this.id, required this.name, this.emoji});
  final String id;
  final String name;
  final String? emoji;
}

/// Category and product mutations shared with the web Inventory screen.
class InventoryApiService {
  InventoryApiService({http.Client? client, AuthService? authService})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService();
  final http.Client _client;
  final AuthService _authService;

  Future<List<InventoryCategory>> loadCategories() async {
    final response = await _request('GET', '/api/categories');
    if (response is! List) throw Exception('Unable to load categories.');
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

  Future<void> createProduct(Map<String, Object?> product) async {
    await _request('POST', '/api/products', body: product);
  }

  Future<Object?> _request(String method, String path,
      {Map<String, Object?>? body}) async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty)
      throw Exception('Please sign in to manage inventory.');
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
    if (response.statusCode < 200 || response.statusCode >= 300)
      throw Exception(decoded is Map
          ? decoded['error']?.toString() ?? 'Inventory request failed.'
          : 'Inventory request failed.');
    return decoded;
  }
}
