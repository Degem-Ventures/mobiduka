import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';
import 'cash_service.dart';

/// Authenticated API client for the shared web/mobile staff and shift flows.
class EmployeeRepository {
  EmployeeRepository({
    http.Client? client,
    AuthService? authService,
    CashService? cashService,
  })  : _client = client ?? http.Client(),
        _authService = authService ?? AuthService(),
        _cashService = cashService ?? CashService();

  final http.Client _client;
  final AuthService _authService;
  final CashService _cashService;

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
    final session = await _session();
    final businessId = session.user['businessId']!.toString();
    try {
      final response = await _request('GET', '/api/cash/session');
      if (response is! Map || response['sessions'] is! List) return const [];
      final sessions = (response['sessions'] as List)
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList();
      await _cashService.cacheRemoteSessions(
        businessId: businessId,
        sessions: sessions,
      );
      return sessions;
    } on Object {
      return _cashService.loadLocalSessions(businessId);
    }
  }

  Future<void> openShift({
    required String employeeId,
    required String shiftTypeId,
  }) async {
    final session = await _session();
    await _cashService.openSession(
      businessId: session.user['businessId']!.toString(),
      userId: employeeId,
      openingCash: 0,
      shiftTypeId: shiftTypeId,
    );
  }

  Future<void> closeShift({
    required String employeeId,
    required String sessionId,
  }) async {
    final session = await _session();
    await _cashService.closeSession(
      sessionId: sessionId,
      businessId: session.user['businessId']!.toString(),
      userId: employeeId,
      closingCash: 0,
    );
  }

  Future<AuthSession> _session() async {
    final session = await _authService.readSession();
    if (session == null ||
        session.user['businessId']?.toString().isEmpty != false) {
      throw Exception('Please sign in to manage employees.');
    }
    return session;
  }

  Future<dynamic> _request(String method, String path,
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
