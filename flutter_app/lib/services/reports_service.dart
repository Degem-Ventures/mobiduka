import 'dart:convert';

import 'package:http/http.dart' as http;

import 'sync_service.dart';
import 'api_config.dart';
import 'auth_service.dart';

class ReportTrend {
  const ReportTrend({
    required this.date,
    required this.day,
    required this.revenue,
    required this.profit,
    required this.future,
    required this.isToday,
  });

  final DateTime date;
  final String day;
  final double revenue;
  final double profit;
  final bool future;
  final bool isToday;
}

class ReportMonth {
  const ReportMonth({
    required this.month,
    required this.sales,
    required this.profit,
    required this.future,
    required this.isNow,
  });

  final String month;
  final double sales;
  final double profit;
  final bool future;
  final bool isNow;
}

class ReportCategory {
  const ReportCategory(
      {required this.name, required this.percent, required this.revenue});

  final String name;
  final double percent;
  final double revenue;
}

class ReportsData {
  const ReportsData({
    required this.totalRevenue,
    required this.totalCostOfGoods,
    required this.totalExpenses,
    required this.netProfit,
    required this.profitMarginPercentage,
    required this.trends,
    required this.monthly,
    required this.categories,
    required this.todaySales,
    required this.weekSales,
    required this.weekProfit,
    required this.weekExpenses,
    required this.avgMargin,
    required this.currentMonth,
    required this.year,
    required this.daysInMonth,
    required this.currentDay,
    required this.bestMonth,
    required this.isOffline,
  });

  final double totalRevenue;
  final double totalCostOfGoods;
  final double totalExpenses;
  final double netProfit;
  final double profitMarginPercentage;
  final List<ReportTrend> trends;
  final List<ReportMonth> monthly;
  final List<ReportCategory> categories;
  final double todaySales;
  final double weekSales;
  final double weekProfit;
  final double weekExpenses;
  final double avgMargin;
  final String currentMonth;
  final int year;
  final int daysInMonth;
  final int currentDay;
  final String bestMonth;
  final bool isOffline;
}

class ReportsService {
  ReportsService(
      {http.Client? client,
      String? baseUrl,
      SyncService? syncService,
      AuthService? authService})
      : _client = client ?? http.Client(),
        baseUrl = baseUrl ?? ApiConfig.origin,
        _syncService = syncService ?? SyncService(),
        _authService = authService ?? AuthService();

  final http.Client _client;
  final String baseUrl;
  final SyncService _syncService;
  final AuthService _authService;

  Future<ReportsData> load({required String businessId, int days = 7}) async {
    try {
      final session = await _authService.readSession();
      final response = await _client
          .get(
              Uri.parse(
                  '$baseUrl/api/reports/summary?businessId=${Uri.encodeQueryComponent(businessId)}&days=$days'),
              headers: session == null
                  ? const {}
                  : {'Authorization': 'Bearer ${session.token}'})
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
    final summary = (body['summary'] as Map?) ?? const {};
    final trends = ((body['trends'] as List<dynamic>?) ?? const []).map((raw) {
      final item = raw as Map;
      return ReportTrend(
        date:
            DateTime.tryParse(item['date']?.toString() ?? '') ?? DateTime.now(),
        day: item['day']?.toString() ?? '',
        revenue: _number(item['sales'] ?? item['revenue']),
        profit: _number(item['profit']),
        future: item['future'] == true,
        isToday: item['isToday'] == true,
      );
    }).toList();
    final monthly = ((body['monthly'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => ReportMonth(
              month: item['month']?.toString() ?? '',
              sales: _number(item['sales']),
              profit: _number(item['profit']),
              future: item['future'] == true,
              isNow: item['isNow'] == true,
            ))
        .toList();
    final categories = ((body['categories'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => ReportCategory(
              name: item['name']?.toString() ?? 'Other',
              percent: _number(item['value']),
              revenue: _number(item['revenue']),
            ))
        .toList();
    return ReportsData(
      totalRevenue: _number(summary['totalRevenue']),
      totalCostOfGoods: _number(summary['totalCostOfGoods']),
      totalExpenses: _number(summary['totalExpenses']),
      netProfit: _number(summary['netProfit']),
      profitMarginPercentage: _number(summary['profitMarginPercentage']),
      trends: trends,
      monthly: monthly,
      categories: categories,
      todaySales: _number(summary['todaySales']),
      weekSales: _number(summary['weekSales']),
      weekProfit: _number(summary['weekProfit']),
      weekExpenses: _number(summary['weekExpenses']),
      avgMargin: _number(summary['avgMargin']),
      currentMonth: summary['currentMonth']?.toString() ?? '',
      year: (_number(summary['year'])).round(),
      daysInMonth: (_number(summary['daysInMonth'])).round(),
      currentDay: (_number(summary['currentDay'])).round(),
      bestMonth: summary['bestMonth']?.toString() ?? '-',
      isOffline: false,
    );
  }

  Future<ReportsData> _fromLocalQueue(
      {required String businessId, required int days}) async {
    final db = await _syncService.database;
    final rows = await db.query(
      'sync_queue',
      where: 'createdAt >= ?',
      whereArgs: [
        DateTime.now().subtract(Duration(days: days)).toIso8601String()
      ],
      orderBy: 'createdAt ASC',
    );
    final byDate = <String, ReportTrend>{};
    var totalRevenue = 0.0;
    var totalCost = 0.0;
    var totalExpenses = 0.0;
    final start = DateTime.now().subtract(Duration(days: days - 1));
    for (var index = 0; index < days; index += 1) {
      final date = DateTime(start.year, start.month, start.day + index);
      byDate[_dateKey(date)] = ReportTrend(
          date: date,
          day: _weekDay(date),
          revenue: 0,
          profit: 0,
          future: date.isAfter(DateTime.now()),
          isToday: _dateKey(date) == _dateKey(DateTime.now()));
    }

    for (final row in rows) {
      final payload =
          jsonDecode(row['payload'] as String) as Map<String, dynamic>;
      if (payload['businessId'] != null && payload['businessId'] != businessId)
        continue;
      if (row['entityName'] == 'Sale') {
        final revenue = _number(payload['total'] ?? payload['totalAmount']);
        final items = payload['items'] as List<dynamic>? ?? const [];
        final cost = items.fold<double>(0, (sum, raw) {
          final item = raw as Map<String, dynamic>;
          return sum +
              _number(item['cost'] ?? item['unitCost'] ?? item['price']) *
                  _number(item['qty'] ?? item['quantity']) *
                  0.6;
        });
        final date =
            DateTime.tryParse(row['createdAt'] as String) ?? DateTime.now();
        final key = _dateKey(date);
        totalRevenue += revenue;
        totalCost += cost;
        if (byDate.containsKey(key))
          byDate[key] = ReportTrend(
              date: byDate[key]!.date,
              day: byDate[key]!.day,
              revenue: byDate[key]!.revenue + revenue,
              profit: byDate[key]!.profit + revenue - cost,
              future: byDate[key]!.future,
              isToday: byDate[key]!.isToday);
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
      profitMarginPercentage:
          totalRevenue == 0 ? 0 : netProfit / totalRevenue * 100,
      trends: byDate.values.toList(),
      monthly: const [],
      categories: const [],
      todaySales: byDate.values
          .where((item) => item.isToday)
          .fold(0, (sum, item) => sum + item.revenue),
      weekSales: totalRevenue,
      weekProfit: totalRevenue - totalCost,
      weekExpenses: totalExpenses,
      avgMargin: totalRevenue == 0
          ? 0
          : (totalRevenue - totalCost) / totalRevenue * 100,
      currentMonth: _monthShort(DateTime.now().month),
      year: DateTime.now().year,
      daysInMonth:
          DateTime(DateTime.now().year, DateTime.now().month + 1, 0).day,
      currentDay: DateTime.now().day,
      bestMonth: '-',
      isOffline: true,
    );
  }

  static double _number(Object? value) => value is num
      ? value.toDouble()
      : double.tryParse(value?.toString() ?? '') ?? 0;

  static String _dateKey(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  static String _weekDay(DateTime date) =>
      const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][date.weekday - 1];
  static String _monthShort(int month) => const [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ][month - 1];
}
