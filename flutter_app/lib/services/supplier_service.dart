import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';

class SupplierService {
  SupplierService({http.Client? client, AuthService? authService})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService();

  final http.Client _client;
  final AuthService _authService;

  Future<List<Map<String, dynamic>>> loadSuppliers() async {
    final response = await _request('GET', '/api/suppliers');
    if (response is! List) throw Exception('Unable to load suppliers.');
    return response
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  Future<Map<String, dynamic>> createSupplier({
    required String name,
    required String category,
    required String contact,
    required String phone,
    required String email,
  }) async {
    final response = await _request('POST', '/api/suppliers', body: {
      'name': name,
      'category': category,
      'contactPerson': contact,
      'phone': phone,
      'email': email,
    });
    if (response is! Map) throw Exception('Unable to save supplier.');
    return Map<String, dynamic>.from(response);
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
