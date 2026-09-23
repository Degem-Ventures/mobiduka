import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';

class SettingsService {
  SettingsService({http.Client? client, AuthService? authService})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService();

  final http.Client _client;
  final AuthService _authService;

  Future<Map<String, dynamic>> load() async {
    final response = await _request('GET');
    if (response is! Map) throw Exception('Unable to load settings.');
    return Map<String, dynamic>.from(response);
  }

  Future<Map<String, dynamic>> save(Map<String, Object?> patch) async {
    final response = await _request('PATCH', body: patch);
    if (response is! Map) throw Exception('Unable to save settings.');
    return Map<String, dynamic>.from(response);
  }

  Future<Object?> _request(String method, {Map<String, Object?>? body}) async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to manage settings.');
    }
    final uri = Uri.parse('${ApiConfig.origin}/api/settings').replace(
      queryParameters: method == 'GET' ? {'businessId': businessId} : null,
    );
    final response = method == 'GET'
        ? await _client
            .get(uri, headers: {'Authorization': 'Bearer ${session.token}'})
        : await _client.patch(uri,
            headers: {
              'Authorization': 'Bearer ${session.token}',
              'Content-Type': 'application/json'
            },
            body: jsonEncode({...?body, 'businessId': businessId}));
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(decoded is Map
          ? decoded['error']?.toString() ?? 'Settings request failed.'
          : 'Settings request failed.');
    }
    return decoded;
  }
}
