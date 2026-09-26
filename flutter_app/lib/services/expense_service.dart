import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';
import 'sync_service.dart';

class ExpenseService {
  ExpenseService({
    http.Client? client,
    AuthService? authService,
    SyncService? syncService,
    Future<AuthSession?> Function()? sessionReader,
  })  : _client = client ?? http.Client(),
        _authService = authService ?? AuthService(),
        _syncService = syncService ?? SyncService(),
        _sessionReader = sessionReader;

  final http.Client _client;
  final AuthService _authService;
  final SyncService _syncService;
  final Future<AuthSession?> Function()? _sessionReader;

  Future<List<Map<String, dynamic>>> loadExpenses() async {
    final session = await _session();
    final businessId = session.user['businessId']!.toString();
    try {
      final response = await _request('GET', '/api/expenses');
      if (response is! List) throw Exception('Unable to load expenses.');
      final expenses = response
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList();
      await _syncService.cacheCollection(
        businessId: businessId,
        cacheKey: 'expenses',
        payload: expenses,
      );
      return expenses;
    } on Object {
      return _loadCachedExpenses(businessId);
    }
  }

  Future<String> createExpense({
    required String description,
    required num amount,
    required String category,
    required String paymentMethod,
    required bool recurring,
    required String date,
  }) async {
    final session = await _session();
    final businessId = session.user['businessId']!.toString();
    final timestamp = DateTime.now().toIso8601String();
    final expenseId = 'expense-${DateTime.now().microsecondsSinceEpoch}';
    final expense = <String, dynamic>{
      'id': expenseId,
      'businessId': businessId,
      'userId': session.user['id']?.toString(),
      'description': description,
      'amount': amount,
      'category': category,
      'paymentMethod': paymentMethod,
      'recurring': recurring,
      'date': date,
      'createdAt': timestamp,
      'isPendingSync': true,
    };

    final cached = await _loadCachedExpenses(businessId);
    await _syncService.cacheCollection(
      businessId: businessId,
      cacheKey: 'expenses',
      payload: [expense, ...cached],
    );
    await _syncService.queueChange(
      id: 'sync-$expenseId',
      entityName: 'Expense',
      operation: 'CREATE',
      payload: expense,
    );
    return expenseId;
  }

  Future<List<Map<String, dynamic>>> _loadCachedExpenses(
      String businessId) async {
    final cached = await _syncService.readCachedCollection(
      businessId: businessId,
      cacheKey: 'expenses',
    );
    if (cached is! List) return const [];
    return cached
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  Future<AuthSession> _session() async {
    final session =
        await (_sessionReader?.call() ?? _authService.readSession());
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
