import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';

class DashboardSnapshot {
  const DashboardSnapshot({
    required this.metadata,
    required this.summary,
    required this.paymentBreakdown,
    required this.topProducts,
    required this.recentTransactions,
    required this.lowStockItems,
    required this.scanActivity,
  });

  final Map<String, dynamic> metadata;
  final Map<String, dynamic> summary;
  final Map<String, dynamic> paymentBreakdown;
  final List<Map<String, dynamic>> topProducts;
  final List<Map<String, dynamic>> recentTransactions;
  final List<Map<String, dynamic>> lowStockItems;
  final Map<String, dynamic> scanActivity;

  factory DashboardSnapshot.fromJson(Map<String, dynamic> json) {
    List<Map<String, dynamic>> list(String key) {
      final value = json[key];
      if (value is! List) return const [];
      return value.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList();
    }

    return DashboardSnapshot(
      metadata: Map<String, dynamic>.from(json['metadata'] as Map? ?? const {}),
      summary: Map<String, dynamic>.from(json['summary'] as Map? ?? const {}),
      paymentBreakdown: Map<String, dynamic>.from(json['paymentBreakdown'] as Map? ?? const {}),
      topProducts: list('topProducts'),
      recentTransactions: list('recentTransactions'),
      lowStockItems: list('lowStockItems'),
      scanActivity: Map<String, dynamic>.from(json['scanActivity'] as Map? ?? const {}),
    );
  }

  static const empty = DashboardSnapshot(
    metadata: {},
    summary: {},
    paymentBreakdown: {},
    topProducts: [],
    recentTransactions: [],
    lowStockItems: [],
    scanActivity: {},
  );
}

class DashboardService {
  DashboardService({http.Client? client, AuthService? authService})
      : _client = client ?? http.Client(),
        _authService = authService ?? AuthService();

  final http.Client _client;
  final AuthService _authService;

  Future<DashboardSnapshot> load() async {
    final session = await _authService.readSession();
    final businessId = session?.user['businessId']?.toString();
    if (session == null || businessId == null || businessId.isEmpty) {
      throw Exception('Please sign in to load dashboard data.');
    }

    final response = await _client
        .get(
          Uri.parse('${ApiConfig.origin}/api/dashboard/summary?businessId=${Uri.encodeQueryComponent(businessId)}'),
          headers: {'Authorization': 'Bearer ${session.token}', 'Content-Type': 'application/json'},
        )
        .timeout(const Duration(seconds: 10));

    final decoded = jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300 || decoded is! Map<String, dynamic>) {
      final message = decoded is Map<String, dynamic> ? decoded['error']?.toString() : null;
      throw Exception(message ?? 'Unable to load dashboard data.');
    }
    return DashboardSnapshot.fromJson(decoded);
  }
}
