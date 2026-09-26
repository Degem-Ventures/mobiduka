import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';
import 'customer_repository.dart';

class CustomerApiService {
  CustomerApiService({
    http.Client? client,
    AuthService? authService,
    CustomerRepository? customerRepository,
  })  : _client = client ?? http.Client(),
        _authService = authService ?? AuthService(),
        _customerRepository = customerRepository ?? CustomerRepository();

  final http.Client _client;
  final AuthService _authService;
  final CustomerRepository _customerRepository;

  Future<List<Map<String, dynamic>>> loadCustomers() async {
    final session = await _session();
    final businessId = session.user['businessId']!.toString();
    try {
      final response = await _request('GET', '/api/customers');
      if (response is! List) throw Exception('Unable to load customers.');
      final customers = response
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList();
      await _customerRepository.cacheRemoteCustomers(businessId, customers);
      return customers;
    } on Object {
      return _customerRepository.searchLocalCustomers('',
          businessId: businessId);
    }
  }

  Future<Map<String, dynamic>> loadCustomer(String customerId) async {
    final session = await _session();
    try {
      final response = await _request('GET', '/api/customers',
          query: {'customerId': customerId});
      if (response is! Map) throw Exception('Unable to load customer history.');
      return Map<String, dynamic>.from(response);
    } on Object {
      final customers = await _customerRepository.searchLocalCustomers('',
          businessId: session.user['businessId']!.toString());
      Map<String, dynamic>? customer;
      for (final candidate in customers) {
        if (candidate['id']?.toString() == customerId) {
          customer = candidate;
          break;
        }
      }
      if (customer == null) rethrow;
      return customer;
    }
  }

  Future<void> createCustomer({
    required String name,
    String? phone,
    required double initialCreditLimit,
  }) async {
    final session = await _session();
    await _customerRepository.createOfflineCustomer(
      businessId: session.user['businessId']!.toString(),
      name: name,
      phone: phone,
      initialCreditLimit: initialCreditLimit,
    );
  }

  Future<void> recordPayment({
    required String customerId,
    required double amount,
    String paymentMethod = 'CASH',
  }) async {
    final session = await _session();
    final result = await _customerRepository.recordLocalCredit(
      businessId: session.user['businessId']!.toString(),
      customerId: customerId,
      amount: amount,
      isPayment: true,
      paymentMethod: paymentMethod,
      userId: session.user['id']?.toString() ?? '',
    );
    if (result == null) {
      throw Exception('Repayment exceeds the outstanding balance.');
    }
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
