import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';

class CustomerApiService {
  CustomerApiService({http.Client? client, AuthService? authService})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService();

  final http.Client _client;
  final AuthService _authService;

  Future<List<Map<String, dynamic>>> loadCustomers() async {
    final response = await _request('GET', '/api/customers');
    if (response is! List) throw Exception('Unable to load customers.');
    return response
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  Future<Map<String, dynamic>> loadCustomer(String customerId) async {
    final response = await _request('GET', '/api/customers',
        query: {'customerId': customerId});
    if (response is! Map) throw Exception('Unable to load customer history.');
    return Map<String, dynamic>.from(response);
  }

  Future<void> createCustomer({
    required String name,
    String? phone,
    required double initialCreditLimit,
  }) async {
    await _request('POST', '/api/customers', body: {
      'name': name,
      'phone': phone,
      'initialCreditLimit': initialCreditLimit,
    });
  }

  Future<void> recordPayment({
    required String customerId,
    required double amount,
    String paymentMethod = 'CASH',
  }) async {
    final session = await _session();
    await _request('POST', '/api/customers/credit', body: {
      'action': 'RECORD_PAYMENT',
      'customerId': customerId,
      'amount': amount,
      'userId': session.user['id']?.toString(),
      'paymentMethod': paymentMethod,
    });
  }

  Future<Object?> _request(String method, String path,
      {Map<String, String>? query, Map<String, Object?>? body}) async {
    final session = await _session();
    final businessId = session.user['businessId']!.toString();
    final uri = Uri.parse('${ApiConfig.origin}$path').replace(
      queryParameters:
          method == 'GET' ? {'businessId': businessId, ...?query} : null,
    );
    final response = method == 'GET'
        ? await _client
            .get(uri, headers: {'Authorization': 'Bearer ${session.token}'})
        : await _client.post(uri,
            headers: {
              'Authorization': 'Bearer ${session.token}',
              'Content-Type': 'application/json'
            },
            body: jsonEncode({...?body, 'businessId': businessId}));
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(decoded is Map
          ? decoded['error']?.toString() ?? 'Customer request failed.'
          : 'Customer request failed.');
    }
    return decoded;
  }

  Future<AuthSession> _session() async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to manage customers.');
    }
    return session;
  }
}
