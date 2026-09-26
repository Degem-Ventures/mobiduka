import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';
import 'auxiliary_directory_service.dart';

class SupplierService {
  SupplierService(
      {http.Client? client,
      AuthService? authService,
      AuxiliaryDirectoryService? directory})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService(),
        _directory = directory ?? AuxiliaryDirectoryService();

  final http.Client _client;
  final AuthService _authService;
  final AuxiliaryDirectoryService _directory;

  Future<List<Map<String, dynamic>>> loadSuppliers() async {
    final businessId = await _businessId();
    try {
      final response = await _request('GET', '/api/suppliers');
      if (response is! List) throw Exception('Unable to load suppliers.');
      final suppliers = response
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList();
      await _directory.cacheSuppliers(businessId, suppliers);
      return suppliers;
    } on Object {
      return _directory.loadSuppliers(businessId);
    }
  }

  Future<Map<String, dynamic>> createSupplier({
    required String name,
    required String category,
    required String contact,
    required String phone,
    required String email,
  }) async {
    return _directory.createSupplier(
        businessId: await _businessId(),
        name: name,
        category: category,
        contact: contact,
        phone: phone,
        email: email);
  }

  Future<String> _businessId() async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to manage suppliers.');
    }
    return businessId;
  }

  Future<Object?> _request(String method, String path,
      {Map<String, Object?>? body}) async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to manage suppliers.');
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
          ? decoded['error']?.toString() ?? 'Supplier request failed.'
          : 'Supplier request failed.');
    }
    return decoded;
  }
}
