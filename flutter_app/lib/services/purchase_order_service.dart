import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';
import 'auxiliary_directory_service.dart';
import 'supplier_service.dart';

class PurchaseOrderSupplier {
  const PurchaseOrderSupplier({required this.id, required this.name});
  final String id;
  final String name;
}

class PurchaseOrderProduct {
  const PurchaseOrderProduct({
    required this.id,
    required this.name,
    required this.unit,
    required this.costPrice,
  });
  final String id;
  final String name;
  final String unit;
  final num costPrice;
}

/// API client shared by the mobile and web purchase-order workflows.
class PurchaseOrderService {
  PurchaseOrderService(
      {http.Client? client,
      AuthService? authService,
      AuxiliaryDirectoryService? directory})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService(),
        _directory = directory ?? AuxiliaryDirectoryService();

  final http.Client _client;
  final AuthService _authService;
  final AuxiliaryDirectoryService _directory;

  Future<List<Map<String, dynamic>>> loadPurchaseOrders() async {
    final businessId = await _businessId();
    try {
      final data = await _request('GET', '/api/purchase-orders');
      if (data is! List) throw Exception('Unable to load purchase orders.');
      final orders = data
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList();
      await _directory.cachePurchaseOrders(businessId, orders);
      return orders;
    } on Object {
      return _directory.loadPurchaseOrders(businessId);
    }
  }

  Future<List<PurchaseOrderSupplier>> loadSuppliers() async {
    final data =
        await SupplierService(authService: _authService).loadSuppliers();
    return data
        .map((row) {
          final supplier = Map<String, dynamic>.from(row);
          return PurchaseOrderSupplier(
            id: supplier['id']?.toString() ?? '',
            name: supplier['name']?.toString() ?? '',
          );
        })
        .where((supplier) => supplier.id.isNotEmpty && supplier.name.isNotEmpty)
        .toList();
  }

  Future<List<PurchaseOrderProduct>> loadProducts() async {
    final data = await _request('GET', '/api/products');
    if (data is! List) throw Exception('Unable to load products.');
    return data
        .whereType<Map>()
        .map((row) {
          final product = Map<String, dynamic>.from(row);
          return PurchaseOrderProduct(
            id: product['id']?.toString() ?? '',
            name: product['name']?.toString() ?? '',
            unit: product['unit']?.toString() ?? 'units',
            costPrice: _number(product['costPrice']),
          );
        })
        .where((product) => product.id.isNotEmpty && product.name.isNotEmpty)
        .toList();
  }

  Future<void> createPurchaseOrder({
    required String supplierId,
    required String dueDate,
    required List<Map<String, Object?>> items,
  }) async {
    await _directory.createPurchaseOrder(
        businessId: await _businessId(),
        supplierId: supplierId,
        dueDate: dueDate,
        items: items);
  }

  Future<void> markPurchaseOrderReceived(String orderId) async {
    final order = await _directory.receivePurchaseOrder(
        businessId: await _businessId(), orderId: orderId);
    if (order == null) {
      throw Exception(
          'Purchase order is not cached locally. Connect once to refresh it.');
    }
  }

  Future<String> _businessId() async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to manage purchase orders.');
    }
    return businessId;
  }

  Future<Object?> _request(String method, String path,
      {Map<String, Object?>? body}) async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to manage purchase orders.');
    }
    final uri = Uri.parse('${ApiConfig.origin}$path').replace(
      queryParameters: method == 'GET' ? {'businessId': businessId} : null,
    );
    final response = method == 'GET'
        ? await _client
            .get(uri, headers: {'Authorization': 'Bearer ${session.token}'})
        : await _client.post(uri,
            headers: {
              'Authorization': 'Bearer ${session.token}',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({...?body, 'businessId': businessId}));
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(decoded is Map
          ? decoded['error']?.toString() ?? 'Purchase order request failed.'
          : 'Purchase order request failed.');
    }
    return decoded;
  }

  static num _number(Object? value) =>
      value is num ? value : num.tryParse(value?.toString() ?? '') ?? 0;
}
