import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';
import 'auxiliary_directory_service.dart';

class SettingsService {
  SettingsService(
      {http.Client? client,
      AuthService? authService,
      AuxiliaryDirectoryService? directory})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService(),
        _directory = directory ?? AuxiliaryDirectoryService();

  final http.Client _client;
  final AuthService _authService;
  final AuxiliaryDirectoryService _directory;

  Future<Map<String, dynamic>> load() async {
    final businessId = await _businessId();
    try {
      final response = await _request('GET');
      if (response is! Map) throw Exception('Unable to load settings.');
      final settings = Map<String, dynamic>.from(response);
      // sqflite uses native file-system APIs and is not available in Flutter
      // web. The browser should use the API response directly instead.
      if (!kIsWeb) await _directory.cacheSettings(businessId, settings);
      return settings;
    } on Object {
      if (kIsWeb) rethrow;
      final cached = await _directory.loadSettings(businessId);
      if (cached != null) return cached;
      rethrow;
    }
  }

  Future<Map<String, dynamic>> save(Map<String, Object?> patch) async {
    if (kIsWeb) {
      final response = await _request('PATCH', body: patch);
      if (response is! Map) throw Exception('Unable to save settings.');
      return Map<String, dynamic>.from(response);
    }
    return _directory.saveSettings(
        businessId: await _businessId(), patch: patch);
  }

  Future<String> _businessId() async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to manage settings.');
    }
    return businessId;
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
