import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';

/// Authenticated API client for the shared web/mobile staff and shift flows.
class EmployeeRepository {
  EmployeeRepository({http.Client? client, AuthService? authService})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService();

  final http.Client _client;
  final AuthService _authService;

  Future<List<Map<String, dynamic>>> loadEmployees() async {
    final response = await _request('GET', '/api/employees');
    if (response is! Map || response['employees'] is! List) {
      throw Exception('Unable to load employees.');
    }
    return (response['employees'] as List)
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  Future<void> saveEmployee({
    String? id,
    required String fullName,
    required String email,
    required String phone,
    required String role,
    required String shift,
    required num salary,
    String? pin,
    required bool active,
    String? startDate,
  }) =>
      _request('POST', '/api/employees', body: {
        if (id != null) 'id': id,
        'name': fullName,
        'email': email,
        'phone': phone,
        'role': role,
        'shift': shift,
        'salary': salary,
        'isActive': active,
        if (pin != null && pin.isNotEmpty) 'pin': pin,
        if (startDate != null && startDate.isNotEmpty) 'startDate': startDate,
      });

  Future<List<Map<String, dynamic>>> loadShiftTypes() async {
    final response = await _request('GET', '/api/shift-types');
    if (response is! Map || response['shiftTypes'] is! List) return const [];
    return (response['shiftTypes'] as List)
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  Future<List<Map<String, dynamic>>> loadCashSessions() async {
    final response = await _request('GET', '/api/cash/session');
    if (response is! Map || response['sessions'] is! List) return const [];
    return (response['sessions'] as List)
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  Future<void> openShift(
          {required String employeeId, required String shiftTypeId}) =>
      _request('POST', '/api/cash/session', body: {
        'action': 'OPEN',
        'userId': employeeId,
        'shiftTypeId': shiftTypeId,
        'openingCash': 0,
      });

  Future<void> closeShift(
          {required String employeeId, required String sessionId}) =>
      _request('POST', '/api/cash/session', body: {
        'action': 'CLOSE',
        'userId': employeeId,
        'sessionId': sessionId,
        'closingCash': 0,
      });

  Future<dynamic> _request(String method, String path,
      {Map<String, Object?>? body}) async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to manage employees.');
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
          ? decoded['error']?.toString() ?? 'Employee request failed.'
          : 'Employee request failed.');
    }
    return decoded;
  }
}
