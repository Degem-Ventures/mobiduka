import 'dart:convert';

import 'package:bcrypt/bcrypt.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'sync_service.dart';

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
  final SyncService _syncService = SyncService();

  Future<Map<String, dynamic>> loginWithPIN({
    required String pin,
    required String activeBusinessId,
    required String deviceToken,
    String identifier = 'cashier1',
  }) async {
    try {
      final db = await _syncService.database;
      final roster = await db.query(
        'local_auth_roster',
        where: 'businessId = ? AND status = ?',
        whereArgs: [activeBusinessId, 'ACTIVE'],
      );
      for (final employee in roster) {
        final cachedHash = employee['pinHash'];
        if (cachedHash is String && cachedHash.isNotEmpty && BCrypt.checkpw(pin, cachedHash)) {
          final user = <String, dynamic>{
            'id': employee['id'],
            'name': employee['fullName'],
            'role': employee['role'] ?? 'CASHIER',
            'businessId': activeBusinessId,
          };
          await _storage.write(key: _userKey, value: jsonEncode(user));
          return <String, dynamic>{
            'success': true,
            'offline': true,
            'user': user,
          };
        }
      }
    } on Object {
      // Cache failures fall through to authoritative online authentication.
    }

    final session = await _authenticate(
      identifier: identifier,
      pin: pin,
      activeBusinessId: activeBusinessId,
      deviceToken: deviceToken,
    );
    return <String, dynamic>{'offline': false, 'session': session};
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
    String? activeBusinessId,
    String? password,
    String? pin,
  }) async {
    final response = await _client.post(
      Uri.parse(baseUrl),
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': deviceToken,
        if (activeBusinessId != null) 'X-Business-Id': activeBusinessId,
      },
      body: jsonEncode({
        'identifier': identifier,
        if (password != null) 'password': password,
        if (pin != null) 'pin': pin,
        if (activeBusinessId != null) 'businessId': activeBusinessId,
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

  Future<AuthSession?> readSession() async {
    final token = await readToken();
    final encodedUser = await _storage.read(key: _userKey);
    if (token == null || encodedUser == null) return null;
    try {
      final user = jsonDecode(encodedUser);
      if (user is! Map<String, dynamic>) return null;
      return AuthSession(token: token, user: user);
    } on Object {
      return null;
    }
  }

  Future<String> getActiveUserRole() async {
    final encodedUser = await _storage.read(key: _userKey);
    if (encodedUser == null) return 'CASHIER';
    try {
      final user = jsonDecode(encodedUser) as Map<String, dynamic>;
      final role = user['role']?.toString().trim().toUpperCase();
        final normalizedRole = role == 'MANAGER' ? 'SUPERVISOR' : role;
        return normalizedRole == 'ADMIN' || normalizedRole == 'OWNER' || normalizedRole == 'SUPERVISOR' || normalizedRole == 'ACCOUNTANT'
          ? normalizedRole!
          : 'CASHIER';
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

  Future<String?> getActiveBusinessId() async {
    final encodedUser = await _storage.read(key: _userKey);
    if (encodedUser == null) return null;
    try {
      return (jsonDecode(encodedUser) as Map<String, dynamic>)['businessId']?.toString();
    } on Object {
      return null;
    }
  }

  Future<void> clearSession() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
  }
}