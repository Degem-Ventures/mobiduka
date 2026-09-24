import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';

class ExpenseService {
  ExpenseService({http.Client? client, AuthService? authService})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService();

  final http.Client _client;
  final AuthService _authService;

  Future<List<Map<String, dynamic>>> loadExpenses() async {
    final response = await _request('GET', '/api/expenses');
    if (response is! List) throw Exception('Unable to load expenses.');
    return response
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  Future<void> createExpense({
    required String description,
    required num amount,
    required String category,
    required String paymentMethod,
    required bool recurring,
    required String date,
  }) async {
    final session = await _session();
    await _request('POST', '/api/expenses', body: {
      'userId': session.user['id']?.toString(),
      'description': description,
      'amount': amount,
      'category': category,
      'paymentMethod': paymentMethod,
      'recurring': recurring,
      'date': date,
    });
  }

  Future<AuthSession> _session() async {
    final session = await _authService.readSession();
    if (session == null ||
        session.user['businessId']?.toString().isEmpty != false) {
      throw Exception('Please sign in to manage expenses.');
    }
    return session;
  }

  Future<Object?> _request(String method, String path,
      {Map<String, Object?>? body}) async {
    final session = await _session();
    final businessId = session.user['businessId']!.toString();
    final uri = Uri.parse('${ApiConfig.origin}$path').replace(
      queryParameters: method == 'GET' ? {'businessId': businessId} : null,
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
          ? decoded['error']?.toString() ?? 'Expense request failed.'
          : 'Expense request failed.');
    }
    return decoded;
  }
}
