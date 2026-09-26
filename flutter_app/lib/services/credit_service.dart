import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';
import 'customer_repository.dart';

class CreditAccount {
  const CreditAccount({
    required this.customerId,
    required this.customer,
    required this.phone,
    required this.balance,
    required this.lastTransactionAt,
    required this.transactionCount,
    required this.initials,
    required this.colorValue,
  });

  final String customerId;
  final String customer;
  final String phone;
  final double balance;
  final String? lastTransactionAt;
  final int transactionCount;
  final String initials;
  final int colorValue;

  CreditAccount copyWith({
    double? balance,
    String? lastTransactionAt,
    int? transactionCount,
  }) =>
      CreditAccount(
        customerId: customerId,
        customer: customer,
        phone: phone,
        balance: balance ?? this.balance,
        lastTransactionAt: lastTransactionAt ?? this.lastTransactionAt,
        transactionCount: transactionCount ?? this.transactionCount,
        initials: initials,
        colorValue: colorValue,
      );
}

class CreditService {
  CreditService({
    http.Client? client,
    AuthService? authService,
    CustomerRepository? customerRepository,
  })  : _client = client ?? http.Client(),
        _authService = authService ?? AuthService(),
        _customerRepository = customerRepository ?? CustomerRepository();

  static final CreditService instance = CreditService();
  static const _avatarColors = <int>[
    0xFF123A8F,
    0xFF2E7D32,
    0xFFD32F2F,
    0xFFD4AF37,
    0xFF7B1FA2,
    0xFFF57C00,
    0xFF00796B,
  ];

  final http.Client _client;
  final AuthService _authService;
  final CustomerRepository _customerRepository;

  Future<List<CreditAccount>> loadCreditAccounts() async {
    final session = await _session();
    final businessId = session.user['businessId']!.toString();
    try {
      final response = await _request('GET', '/api/customers');
      if (response is! List) throw Exception('Unable to load credit accounts.');
      final customers = response
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .toList();
      await _customerRepository.cacheRemoteCustomers(businessId, customers);
      return customers
          .asMap()
          .entries
          .map((entry) => _accountFromCustomer(entry.value, entry.key))
          .where((account) => account.balance > 0)
          .toList();
    } on Object {
      return (await _customerRepository.loadLocalCreditAccounts(businessId))
          .map(_accountFromLocal)
          .where((account) => account.balance > 0)
          .toList();
    }
  }

  Future<CreditAccount> loadCreditAccount(String customerId,
      {int colorIndex = 0}) async {
    final session = await _session();
    try {
      final response = await _request('GET', '/api/customers',
          query: {'customerId': customerId});
      if (response is! Map) throw Exception('Unable to load credit history.');
      return _accountFromCustomer(
          Map<String, dynamic>.from(response), colorIndex);
    } on Object {
      final local = await _customerRepository.loadLocalCreditAccount(
        session.user['businessId']!.toString(),
        customerId,
      );
      if (local == null) rethrow;
      return _accountFromLocal(local);
    }
  }

  Future<List<Map<String, dynamic>>> loadCreditLedger(
      {String? customerId}) async {
    if (customerId == null) return const [];
    final session = await _session();
    Object? response;
    try {
      response = await _request('GET', '/api/customers',
          query: {'customerId': customerId});
    } on Object {
      return _customerRepository.loadLocalCreditLedger(
        session.user['businessId']!.toString(),
        customerId,
      );
    }
    if (response is! Map) throw Exception('Unable to load credit history.');
    final customer = Map<String, dynamic>.from(response);
    final sales = (customer['sales'] as List? ?? const [])
        .whereType<Map>()
        .map((sale) => <String, dynamic>{
              'id': sale['id']?.toString() ?? '',
              'customerId': customerId,
              'type': 'SALE',
              'amount': _number(sale['total']),
              'createdAt': sale['createdAt']?.toString(),
            });
    final entries = (customer['creditEntries'] as List? ?? const [])
        .whereType<Map>()
        .map((entry) => <String, dynamic>{
              'id': entry['id']?.toString() ?? '',
              'customerId': customerId,
              'type': entry['type']?.toString() ?? 'CHARGE',
              'amount': _number(entry['amount']),
              'paymentMethod': entry['paymentMethod']?.toString(),
              'createdAt': entry['createdAt']?.toString(),
            });
    final ledger = [...sales, ...entries];
    ledger.sort((a, b) => (b['createdAt']?.toString() ?? '')
        .compareTo(a['createdAt']?.toString() ?? ''));
    return ledger;
  }

  Future<CreditAccount?> findByCustomerId(String customerId) async {
    try {
      return await loadCreditAccount(customerId);
    } on Object {
      return null;
    }
  }

  Future<void> saveCreditAccount(CreditAccount account) async {
    // CustomerRepository already committed this local profile and queued its
    // Customer event. Do not send a second direct request that breaks offline.
  }

  Future<CreditAccount?> recordOfflinePayment({
    required String customerId,
    required double amount,
    String paymentMethod = 'CASH',
  }) async {
    if (amount <= 0) return null;
    final session = await _session();
    final row = await _customerRepository.recordLocalCredit(
      businessId: session.user['businessId']!.toString(),
      customerId: customerId,
      amount: amount,
      isPayment: true,
      paymentMethod: paymentMethod,
      userId: session.user['id']?.toString() ?? '',
    );
    return row == null ? null : _accountFromLocal(row);
  }

  Future<CreditAccount?> recordOfflineCreditSale({
    required String customerId,
    required double amount,
    required String invoiceNo,
  }) async {
    if (amount <= 0) return null;
    final session = await _session();
    final row = await _customerRepository.recordLocalCredit(
      businessId: session.user['businessId']!.toString(),
      customerId: customerId,
      amount: amount,
      isPayment: false,
      paymentMethod: 'CREDIT',
      userId: session.user['id']?.toString() ?? '',
    );
    return row == null ? null : _accountFromLocal(row);
  }

  CreditAccount _accountFromCustomer(Map<String, dynamic> row, int index) {
    final name = row['name']?.toString().trim();
    final normalizedName = name == null || name.isEmpty ? 'Customer' : name;
    final account = row['creditAccount'];
    final entries = row['creditEntries'] as List? ?? const [];
    final sales = row['sales'] as List? ?? const [];
    final latest = entries.isNotEmpty
        ? entries.first as Map?
        : sales.isNotEmpty
            ? sales.first as Map?
            : null;
    final counts = row['_count'] as Map?;
    return CreditAccount(
      customerId: row['id']?.toString() ?? '',
      customer: normalizedName,
      phone: row['phone']?.toString() ?? '',
      balance: _number(account is Map ? account['balance'] : 0),
      lastTransactionAt: latest?['createdAt']?.toString(),
      transactionCount:
          _integer(counts?['sales']) + _integer(counts?['creditEntries']),
      initials: normalizedName
          .split(RegExp(r'\s+'))
          .where((part) => part.isNotEmpty)
          .take(2)
          .map((part) => part[0])
          .join()
          .toUpperCase(),
      colorValue: _avatarColors[index % _avatarColors.length],
    );
  }

  CreditAccount _accountFromLocal(Map<String, dynamic> row) {
    final name = row['name']?.toString().trim();
    final normalizedName = name == null || name.isEmpty ? 'Customer' : name;
    return CreditAccount(
      customerId: row['id']?.toString() ?? '',
      customer: normalizedName,
      phone: row['phone']?.toString() ?? '',
      balance: _number(row['balance'] ?? row['currentDebt']),
      lastTransactionAt: row['lastTransactionAt']?.toString(),
      transactionCount: _integer(row['transactionCount']),
      initials: row['initials']?.toString() ??
          normalizedName
              .split(RegExp(r'\s+'))
              .where((part) => part.isNotEmpty)
              .take(2)
              .map((part) => part[0])
              .join()
              .toUpperCase(),
      colorValue: _integer(row['colorValue']) == 0
          ? _avatarColors[0]
          : _integer(row['colorValue']),
    );
  }

  Future<AuthSession> _session() async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to manage credit accounts.');
    }
    return session;
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
              'Content-Type': 'application/json',
            },
            body: jsonEncode({...?body, 'businessId': businessId}));
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(decoded is Map
          ? decoded['error']?.toString() ?? 'Credit request failed.'
          : 'Credit request failed.');
    }
    return decoded;
  }

  static double _number(Object? value) => value is num
      ? value.toDouble()
      : double.tryParse(value?.toString() ?? '') ?? 0;
  static int _integer(Object? value) =>
      value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;
}
