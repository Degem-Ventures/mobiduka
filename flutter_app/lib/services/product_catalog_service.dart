import 'dart:convert';

import 'package:http/http.dart' as http;

import '../main.dart' show Product;
import 'api_config.dart';
import 'auth_service.dart';

/// Loads the POS catalogue from the same products endpoint as the web POS.
class ProductCatalogService {
  ProductCatalogService({http.Client? client, AuthService? authService})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService();

  final http.Client _client;
  final AuthService _authService;

  Future<List<Product>> load() async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to load products.');
    }

    final response = await _client.get(
      Uri.parse(
          '${ApiConfig.origin}/api/products?businessId=${Uri.encodeQueryComponent(businessId)}'),
      headers: {
        'Authorization': 'Bearer ${session.token}',
        'Content-Type': 'application/json',
      },
    ).timeout(const Duration(seconds: 10));
    final decoded = jsonDecode(response.body);
    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        decoded is! List) {
      final message = decoded is Map ? decoded['error']?.toString() : null;
      throw Exception(message ?? 'Unable to load products.');
    }

    return decoded.whereType<Map>().map((row) {
      final product = Map<String, dynamic>.from(row);
      final category = product['category'] as Map?;
      final inventory = product['inventory'] as Map?;
      final stock = _number(inventory?['quantity']).toInt();
      final reorder = _number(product['minimumStock']).toInt();
      return Product(
        product['name']?.toString() ?? 'Product',
        category?['name']?.toString() ?? 'Uncategorized',
        _number(product['costPrice']).toInt(),
        _number(product['sellingPrice']).toInt(),
        stock,
        reorder,
        product['emoji']?.toString() ?? category?['emoji']?.toString() ?? '📦',
        status: stock == 0
            ? 'critical'
            : reorder > 0 && stock <= reorder
                ? 'low'
                : 'good',
        barcode: product['barcode']?.toString(),
      );
    }).toList();
  }

  num _number(Object? value) =>
      value is num ? value : num.tryParse(value?.toString() ?? '') ?? 0;
}
