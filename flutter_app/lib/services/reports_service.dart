import 'dart:convert';

import 'package:http/http.dart' as http;

import 'sync_service.dart';
import 'api_config.dart';

class ReportTrend {
  const ReportTrend({required this.date, required this.revenue, required this.profit});

  final DateTime date;
  final double revenue;
  final double profit;
}

class ReportsData {
  const ReportsData({
    required this.totalRevenue,
    required this.totalCostOfGoods,
    required this.totalExpenses,
    required this.netProfit,
    required this.profitMarginPercentage,
    required this.trends,
    required this.isOffline,
  });

  final double totalRevenue;
  final double totalCostOfGoods;
  final double totalExpenses;
  final double netProfit;
  final double profitMarginPercentage;
  final List<ReportTrend> trends;
  final bool isOffline;
}

class ReportsService {
  ReportsService({http.Client? client, String? baseUrl, SyncService? syncService})
      : _client = client ?? http.Client(),
        baseUrl = baseUrl ?? ApiConfig.origin,
        _syncService = syncService ?? SyncService();

  final http.Client _client;
  final String baseUrl;
  final SyncService _syncService;

  Future<ReportsData> load({required String businessId, int days = 7}) async {
    try {
      final response = await _client
          .get(Uri.parse('$baseUrl/api/reports/summary?businessId=${Uri.encodeQueryComponent(businessId)}&days=$days'))
          .timeout(const Duration(seconds: 10));
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return _fromRemote(jsonDecode(response.body) as Map<String, dynamic>);
      }
    } on Object {
      // The local queue remains the source of truth when the network is unavailable.
    }
    return _fromLocalQueue(businessId: businessId, days: days);
  }

  ReportsData _fromRemote(Map<String, dynamic> body) {
    final summary = (body['summary'] as Map<String, dynamic>?) ?? const {};
    final trends = ((body['trends'] as List<dynamic>?) ?? const []).map((raw) {
      final item = raw as Map<String, dynamic>;
      return ReportTrend(
        date: DateTime.tryParse(item['date']?.toString() ?? '') ?? DateTime.now(),
        revenue: _number(item['revenue']),
        profit: _number(item['profit']),
      );
    }).toList();
    return ReportsData(
      totalRevenue: _number(summary['totalRevenue']),
      totalCostOfGoods: _number(summary['totalCostOfGoods']),
      totalExpenses: _number(summary['totalExpenses']),
      netProfit: _number(summary['netProfit']),
      profitMarginPercentage: _number(summary['profitMarginPercentage']),
      trends: trends,
      isOffline: false,
    );
  }

  Future<ReportsData> _fromLocalQueue({required String businessId, required int days}) async {
    final db = await _syncService.database;
    final rows = await db.query(
      'sync_queue',
      where: 'createdAt >= ?',
      whereArgs: [DateTime.now().subtract(Duration(days: days)).toIso8601String()],
      orderBy: 'createdAt ASC',
    );
    final byDate = <String, ReportTrend>{};
    var totalRevenue = 0.0;
    var totalCost = 0.0;
    var totalExpenses = 0.0;
    final start = DateTime.now().subtract(Duration(days: days - 1));
    for (var index = 0; index < days; index += 1) {
      final date = DateTime(start.year, start.month, start.day + index);
      byDate[_dateKey(date)] = ReportTrend(date: date, revenue: 0, profit: 0);
    }

    for (final row in rows) {
      final payload = jsonDecode(row['payload'] as String) as Map<String, dynamic>;
      if (payload['businessId'] != null && payload['businessId'] != businessId) continue;
      if (row['entityName'] == 'Sale') {
        final revenue = _number(payload['total'] ?? payload['totalAmount']);
        final items = payload['items'] as List<dynamic>? ?? const [];
        final cost = items.fold<double>(0, (sum, raw) {
          final item = raw as Map<String, dynamic>;
          return sum + _number(item['cost'] ?? item['unitCost'] ?? item['price']) * _number(item['qty'] ?? item['quantity']) * 0.6;
        });
        final date = DateTime.tryParse(row['createdAt'] as String) ?? DateTime.now();
        final key = _dateKey(date);
        totalRevenue += revenue;
        totalCost += cost;
        if (byDate.containsKey(key)) byDate[key] = ReportTrend(date: byDate[key]!.date, revenue: byDate[key]!.revenue + revenue, profit: byDate[key]!.profit + revenue - cost);
      } else if (row['entityName'] == 'Expense') {
        totalExpenses += _number(payload['amount']);
      }
    }

    final netProfit = totalRevenue - totalCost - totalExpenses;
    return ReportsData(
      totalRevenue: totalRevenue,
      totalCostOfGoods: totalCost,
      totalExpenses: totalExpenses,
      netProfit: netProfit,
      profitMarginPercentage: totalRevenue == 0 ? 0 : netProfit / totalRevenue * 100,
      trends: byDate.values.toList(),
      isOffline: true,
    );
  }

  static double _number(Object? value) => value is num ? value.toDouble() : double.tryParse(value?.toString() ?? '') ?? 0;

  static String _dateKey(DateTime date) => '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
}
