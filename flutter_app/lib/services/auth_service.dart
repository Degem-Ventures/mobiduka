import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';

class AuthSession {
  const AuthSession({required this.token, required this.user});

  final String token;
  final Map<String, dynamic> user;
}

class AuthService {
  AuthService({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        baseUrl = baseUrl ?? '${ApiConfig.apiBase}/auth/login';

  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  static const String _tokenKey = 'mobiduka.auth.jwt';
  static const String _userKey = 'mobiduka.auth.user';

  final http.Client _client;
  final String baseUrl;

  Future<AuthSession> loginWithPIN({
    required String pin,
    required String deviceToken,
  }) async {
    return _authenticate(
      identifier: 'admin@mobiduka.co.ke',
      pin: pin,
      deviceToken: deviceToken,
    );
  }

  Future<AuthSession> loginWithPassword({
    required String identifier,
    required String password,
    required String deviceToken,
  }) async {
    return _authenticate(
      identifier: identifier,
      password: password,
      deviceToken: deviceToken,
    );
  }

  Future<AuthSession> _authenticate({
    required String identifier,
    required String deviceToken,
    String? password,
    String? pin,
  }) async {
    final response = await _client.post(
      Uri.parse(baseUrl),
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': deviceToken,
      },
      body: jsonEncode({
        'identifier': identifier,
        if (password != null) 'password': password,
        if (pin != null) 'pin': pin,
      }),
    );

    Map<String, dynamic> responseBody;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) throw const FormatException();
      responseBody = decoded;
    } on Object {
      throw Exception('Authentication service returned HTTP ${response.statusCode} from $baseUrl. Check the API origin.');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(responseBody['error'] as String? ?? 'Authentication failed.');
    }

    final token = responseBody['token'] as String?;
    final user = responseBody['user'] as Map<String, dynamic>?;
    if (token == null || user == null) {
      throw Exception('Authentication service returned an incomplete session.');
    }

    await _storage.write(key: _tokenKey, value: token);
    await _storage.write(key: _userKey, value: jsonEncode(user));
    return AuthSession(token: token, user: user);
  }

  Future<String?> readToken() => _storage.read(key: _tokenKey);

  Future<String> getActiveUserRole() async {
    final encodedUser = await _storage.read(key: _userKey);
    if (encodedUser == null) return 'CASHIER';
    try {
      final user = jsonDecode(encodedUser) as Map<String, dynamic>;
      final role = user['role']?.toString().trim().toUpperCase();
      return role == 'OWNER' || role == 'MANAGER' ? role! : 'CASHIER';
    } on Object {
      return 'CASHIER';
    }
  }

  Future<String?> getActiveUserId() async {
    final encodedUser = await _storage.read(key: _userKey);
    if (encodedUser == null) return null;
    try {
      return (jsonDecode(encodedUser) as Map<String, dynamic>)['id']?.toString();
    } on Object {
      return null;
    }
  }

  Future<void> clearSession() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
  }
}