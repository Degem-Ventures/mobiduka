import 'dart:convert';

import 'package:http/http.dart' as http;

import '../main.dart';
import 'api_config.dart';
import 'auth_service.dart';

/// Resolves barcodes against the same server endpoint used by web SmartScan.
class ScanLookupResult {
  const ScanLookupResult({required this.product, required this.supplier});

  final Product? product;
  final String? supplier;
}

class ScanLookupService {
  ScanLookupService({http.Client? client, AuthService? authService})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService();

  final http.Client _client;
  final AuthService _authService;

  Future<ScanLookupResult> lookup(String barcode,
      {required bool manual}) async {
    final session = await _authService.readSession();
    if (session == null) throw Exception('Please sign in to use SmartScan.');

    final response = await _client
        .post(
          Uri.parse('${ApiConfig.origin}/api/scans'),
          headers: {
            'Authorization': 'Bearer ${session.token}',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'businessId': session.user['businessId'],
            'barcode': barcode,
            'statusOverride': manual ? 'MANUAL' : 'AUTO',
            'action': 'LOOKUP',
          }),
        )
        .timeout(const Duration(seconds: 10));

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw Exception('SmartScan returned an invalid response.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
          decoded['error']?.toString() ?? 'Unable to look up barcode.');
    }
    return _resultFromProduct(decoded['product'], barcode);
  }

  Future<ScanLookupResult> restock(Product product, int quantity) async {
    final session = await _authService.readSession();
    if (session == null) throw Exception('Please sign in to restock products.');
    final response = await _client
        .post(
          Uri.parse('${ApiConfig.origin}/api/scans'),
          headers: {
            'Authorization': 'Bearer ${session.token}',
            'Content-Type': 'application/json'
          },
          body: jsonEncode({
            'businessId': session.user['businessId'],
            'userId': session.user['id'],
            'barcode': product.barcode,
            'action': 'RESTOCK',
            'quantity': quantity,
          }),
        )
        .timeout(const Duration(seconds: 10));
    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic> ||
        response.statusCode < 200 ||
        response.statusCode >= 300) {
      throw Exception(decoded is Map
          ? decoded['error']?.toString() ?? 'Unable to restock product.'
          : 'Unable to restock product.');
    }
    return _resultFromProduct(decoded['product'], product.barcode ?? '');
  }

  ScanLookupResult _resultFromProduct(Object? product, String fallbackBarcode) {
    if (product is! Map)
      return const ScanLookupResult(product: null, supplier: null);
    final value = Map<String, dynamic>.from(product);
    final stock = _number(value['stock']).toInt();
    final minimumStock = _number(value['minimumStock']).toInt();
    final status = stock <= minimumStock ? 'low' : 'good';
    return ScanLookupResult(
      supplier: (value['supplier'] as Map?)?['name']?.toString(),
      product: Product(
        value['name']?.toString() ?? 'Product',
        value['category']?.toString() ?? 'Uncategorized',
        _number(value['costPrice']).toInt(),
        _number(value['price']).toInt(),
        stock,
        minimumStock,
        '📦',
        status: status,
        barcode: value['barcode']?.toString() ?? fallbackBarcode,
      ),
    );
  }

  num _number(Object? value) =>
      value is num ? value : num.tryParse(value?.toString() ?? '') ?? 0;
}
