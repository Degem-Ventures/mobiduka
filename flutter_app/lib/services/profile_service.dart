import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';

class ProfileService {
  ProfileService({http.Client? client, AuthService? authService})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService();

  final http.Client _client;
  final AuthService _authService;

  Future<Map<String, dynamic>> load() async => _profile(await _request('GET'));

  Future<Map<String, dynamic>> update(
          {required String name, String? phone, String? email}) async =>
      _profile(await _request('PATCH',
          body: {'name': name, 'phone': phone, 'email': email}));

  Future<Map<String, dynamic>> updatePin(
          {String? currentPin, required String newPin}) async =>
      _profile(await _request('PATCH', body: {
        if (currentPin != null) 'currentPin': currentPin,
        'newPin': newPin
      }));

  Map<String, dynamic> _profile(Object? response) {
    if (response is! Map || response['profile'] is! Map)
      throw Exception('Unable to load profile.');
    return Map<String, dynamic>.from(response['profile'] as Map);
  }

  Future<Object?> _request(String method, {Map<String, Object?>? body}) async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty)
      throw Exception('Please sign in to manage your profile.');
    final uri = Uri.parse('${ApiConfig.origin}/api/profile').replace(
        queryParameters: method == 'GET' ? {'businessId': businessId} : null);
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
    if (response.statusCode < 200 || response.statusCode >= 300)
      throw Exception(decoded is Map
          ? decoded['error']?.toString() ?? 'Profile request failed.'
          : 'Profile request failed.');
    return decoded;
  }
}
