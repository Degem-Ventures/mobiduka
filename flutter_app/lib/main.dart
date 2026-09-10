import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

void main() => runApp(const MobiDukaApp());

const navy = Color(0xFF123A8F);
const ink = Color(0xFF0D1B3D);
const gold = Color(0xFFD4AF37);
const muted = Color(0xFF6B7A99);

class Product {
  const Product(this.name, this.category, this.price, this.stock, this.emoji);
  final String name;
  final String category;
  final int price;
  final int stock;
  final String emoji;
}

const products = <Product>[
  Product('Unga Jogoo 2kg', 'Flour', 200, 45, '🌾'),
  Product('Cooking Oil 1L', 'Oils', 190, 32, '🫙'),
  Product('Sugar 1kg', 'Sugar', 140, 28, '🍬'),
  Product('Blue Band 500g', 'Spreads', 150, 18, '🧈'),
  Product('Milk 500ml', 'Dairy', 100, 60, '🥛'),
  Product('Royco 75g', 'Spices', 45, 5, '🌶️'),
  Product('Panadol 500mg', 'Pharma', 30, 3, '💊'),
  Product('Omo 400g', 'Detergent', 180, 8, '🧺'),
  Product('Colgate 100ml', 'Personal', 85, 22, '🪥'),
  Product('Bread White', 'Bakery', 55, 15, '🍞'),
  Product('Eggs (tray)', 'Dairy', 480, 12, '🥚'),
  Product('Nescafé 100g', 'Beverages', 320, 9, '☕'),
];

class MobiDukaApp extends StatefulWidget {
  const MobiDukaApp({super.key});
  @override
  State<MobiDukaApp> createState() => _MobiDukaAppState();
}

class _MobiDukaAppState extends State<MobiDukaApp> {
  int tab = 0;
  bool loggedIn = false;
  String? detail;

  void open(String value) => setState(() => detail = value);

  @override
  Widget build(BuildContext context) {
    final body = !loggedIn
        ? LoginScreen(onLogin: () => setState(() => loggedIn = true))
        : detail != null
            ? DetailScreen(title: detail!, onBack: () => setState(() => detail = null))
            : <Widget>[
                const DashboardScreen(),
                const ProductScreen(title: 'Point of Sale'),
                const ProductScreen(title: 'Inventory & Stock'),
                const CustomerScreen(),
                MoreScreen(onOpen: open, onLogout: () => setState(() => loggedIn = false)),
              ][tab];

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: navy)),
      home: Scaffold(
        body: DecoratedBox(
          decoration: const BoxDecoration(gradient: LinearGradient(colors: [ink, navy])),
          child: Center(
            child: Container(
              constraints: const BoxConstraints(maxWidth: 430, maxHeight: 860),
              margin: const EdgeInsets.all(18),
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(34)),
              child: Column(children: [
                Expanded(child: body),
                if (loggedIn && detail == null)
                  NavigationBar(
                    selectedIndex: tab,
                    onDestinationSelected: (value) => setState(() => tab = value),
                    destinations: const [
                      NavigationDestination(icon: Icon(Icons.dashboard_outlined), label: 'Dashboard'),
                      NavigationDestination(icon: Icon(Icons.point_of_sale_outlined), label: 'POS'),
                      NavigationDestination(icon: Icon(Icons.inventory_2_outlined), label: 'Inventory'),
                      NavigationDestination(icon: Icon(Icons.people_outline), label: 'Customers'),
                      NavigationDestination(icon: Icon(Icons.menu), label: 'More'),
                    ],
                  ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class LoginScreen extends StatelessWidget {
  const LoginScreen({required this.onLogin});
  final VoidCallback onLogin;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(28),
        decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [ink, navy])),
        child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.storefront, color: Colors.white, size: 68),
          const SizedBox(height: 18),
          const Text('MobiDuka', style: TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800)),
          const Text('Point of Sale', style: TextStyle(color: Colors.white70, fontSize: 16)),
          const SizedBox(height: 8),
          const Text('Smart retail management for modern businesses', textAlign: TextAlign.center, style: TextStyle(color: Colors.white70)),
          const SizedBox(height: 34),
          SizedBox(width: double.infinity, child: FilledButton(onPressed: onLogin, child: const Padding(padding: EdgeInsets.all(13), child: Text('Get Started')))),
          TextButton(onPressed: onLogin, child: const Text('Quick PIN Login', style: TextStyle(color: Colors.white))),
        ])),
      );
}

class DashboardScreen extends StatelessWidget {
  const DashboardScreen();
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.fromLTRB(16, 28, 16, 20), children: [
        const Text('Tue, 8 July 2026 · 14:45', style: TextStyle(color: muted)),
        const Text('MobiDuka Store', style: TextStyle(color: ink, fontSize: 24, fontWeight: FontWeight.w800)),
        const Text('Nairobi CBD · Shift: Morning', style: TextStyle(color: muted)),
        const SizedBox(height: 16),
        GridView.count(crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 1.45, children: const [
          StatCard('📈', 'KSh 84,250', "Today's Sales", '+12% vs yesterday'),
          StatCard('💰', 'KSh 22,100', "Today's Profit", '26.2% margin'),
          StatCard('💵', 'KSh 45,800', 'Cash in Till', 'Last count: 2h ago'),
          StatCard('📱', 'KSh 38,450', 'M-Pesa Sales', '47 transactions'),
        ]),
        const SizedBox(height: 16),
        Section(title: 'Quick Actions', child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: const [ActionIcon('🛒', 'New Sale'), ActionIcon('📦', 'Add Stock'), ActionIcon('💸', 'Expense'), ActionIcon('📊', 'Report')])),
        Section(title: 'Top Selling Today', child: Column(children: products.take(5).toList().asMap().entries.map((entry) => ListTile(contentPadding: EdgeInsets.zero, leading: CircleAvatar(backgroundColor: const Color(0xFFE8ECF4), child: Text('${entry.key + 1}')), title: Text(entry.value.name), subtitle: Text('${42 - entry.key * 4} units sold'), trailing: Text('KSh ${(8400 - entry.key * 1200).toString()}', style: const TextStyle(fontWeight: FontWeight.bold)))).toList())),
        Section(title: 'Recent Transactions', child: Column(children: const [ListTile(contentPadding: EdgeInsets.zero, leading: Text('💵', style: TextStyle(fontSize: 22)), title: Text('Walk-in'), subtitle: Text('5 items · 14:32'), trailing: Text('KSh 1,250')), ListTile(contentPadding: EdgeInsets.zero, leading: Text('📱', style: TextStyle(fontSize: 22)), title: Text('Jane Mwangi'), subtitle: Text('8 items · 14:18'), trailing: Text('KSh 3,400'))])),
        Card(color: const Color(0xFFFFF8E1), child: const ListTile(leading: Icon(Icons.warning_amber_rounded, color: Colors.orange), title: Text('12 Items Low on Stock'), subtitle: Text('Action needed before end of day'), trailing: Text('View'))),
      ]);
}

class StatCard extends StatelessWidget {
  const StatCard(this.icon, this.value, this.label, this.subtitle);
  final String icon, value, label, subtitle;
  @override
  Widget build(BuildContext context) => Card(color: navy, child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(icon, style: const TextStyle(fontSize: 20)), const Spacer(), Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)), Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11)), Text(subtitle, style: const TextStyle(color: Colors.white, fontSize: 10))])));
}

class ActionIcon extends StatelessWidget {
  const ActionIcon(this.icon, this.label);
  final String icon, label;
  @override
  Widget build(BuildContext context) => Column(children: [Text(icon, style: const TextStyle(fontSize: 25)), const SizedBox(height: 4), Text(label, style: const TextStyle(fontSize: 10))]);
}

class Section extends StatelessWidget {
  const Section({required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Card(margin: const EdgeInsets.only(bottom: 12), child: Padding(padding: const EdgeInsets.fromLTRB(14, 12, 14, 8), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: ink, fontWeight: FontWeight.w800)), const SizedBox(height: 5), child])));
}

class ProductScreen extends StatefulWidget {
  const ProductScreen({required this.title});
  final String title;
  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  String search = '';
  @override
  Widget build(BuildContext context) {
    final visible = products.where((p) => p.name.toLowerCase().contains(search.toLowerCase())).toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 28, 16, 8),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(widget.title, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: TextField(
            onChanged: (value) => setState(() => search = value),
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search products...',
              filled: true,
              border: OutlineInputBorder(borderSide: BorderSide.none),
            ),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: visible.map((product) {
              return Card(
                child: ListTile(
                  leading: Text(product.emoji, style: const TextStyle(fontSize: 26)),
                  title: Text(product.name),
                  subtitle: Text('${product.category} · KSh ${product.price}'),
                  trailing: Text(
                    '${product.stock} in stock',
                    style: TextStyle(
                      color: product.stock <= 5 ? Colors.red : muted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}

class CustomerScreen extends StatelessWidget {
  const CustomerScreen();
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.fromLTRB(16, 28, 16, 20), children: [const Text('Customers', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)), const SizedBox(height: 12), const Text('7 Total Customers · KSh 22,100 Total Credit', style: TextStyle(color: muted)), const SizedBox(height: 14), ...const [('JM', 'Jane Mwangi', '0712 345 678', 'KSh 3,400'), ('PO', 'Peter Otieno', '0723 456 789', 'KSh 5,200'), ('JK', 'James Kariuki', '0745 678 901', 'KSh 1,800'), ('GA', 'Grace Achieng', '0756 789 012', 'KSh 9,600'), ('SN', 'Sarah Njeri', '0778 901 234', 'KSh 2,100')].map((item) => Card(child: ListTile(leading: CircleAvatar(child: Text(item.$1)), title: Text(item.$2), subtitle: Text('${item.$3} · Credit'), trailing: Text(item.$4))))]);
}

class MoreScreen extends StatelessWidget {
  const MoreScreen({required this.onOpen, required this.onLogout});
  final ValueChanged<String> onOpen;
  final VoidCallback onLogout;
  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
        children: [
          const CircleAvatar(radius: 26, child: Text('A')),
          const SizedBox(height: 8),
          const Text('Admin User', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const Text('admin@mobiduka.co.ke\nStore Manager'),
          const SizedBox(height: 20),
          const Text('Store\nMobiDuka Store\n\nBranch\nNairobi CBD\n\nShift\nMorning'),
          const SizedBox(height: 12),
          ...['Reports & Analytics', 'Purchase Orders', 'Suppliers', 'Credit Book', 'Expense Tracking', 'Employees', 'Notifications', 'Backup & Cloud Sync', 'Settings', 'User Profile'].map(
            (label) => Material(
              color: Colors.transparent,
              child: ListTile(
                leading: const Icon(Icons.chevron_right),
                title: Text(label),
                onTap: () => onOpen(label),
              ),
            ),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(onPressed: onLogout, icon: const Icon(Icons.logout), label: const Text('Logout')),
        ],
      );
}

class DetailScreen extends StatelessWidget {
  const DetailScreen({required this.title, required this.onBack});
  final String title;
  final VoidCallback onBack;
  @override
  Widget build(BuildContext context) => title == 'Reports & Analytics' ? ReportsScreen(onBack: onBack) : ListView(padding: const EdgeInsets.fromLTRB(16, 28, 16, 20), children: [Row(children: [IconButton(onPressed: onBack, icon: const Icon(Icons.arrow_back)), Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold))]), const SizedBox(height: 20), Card(child: ListTile(title: Text(title), subtitle: const Text('MobiDuka Store · Nairobi CBD\nThis section is ready for local store data.')))]);
}

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({required this.onBack});
  final VoidCallback onBack;
  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  int tab = 0;
  final List<double> week = const [62000.0, 84250.0, 71000.0, 95000.0, 110000.0, 130000.0, 78000.0];
  final List<double> profit = const [15500.0, 22100.0, 18200.0, 25400.0, 30800.0, 38000.0, 20200.0];
  final List<double> months = const [1.8, 2.1, 2.4, 2.0, 2.7, 3.1, 2.9, 3.4, 3.0, 3.6, 3.2, 4.1];
  @override
  Widget build(BuildContext context) {
    final weekSales = week.take(4).reduce((a, b) => a + b);
    final weekProfit = profit.take(4).reduce((a, b) => a + b);
    return DefaultTabController(length: 3, child: Column(children: [Container(padding: const EdgeInsets.fromLTRB(12, 28, 12, 16), decoration: const BoxDecoration(gradient: LinearGradient(colors: [ink, navy])), child: Column(children: [Row(children: [IconButton(onPressed: widget.onBack, icon: const Icon(Icons.arrow_back, color: Colors.white)), const Expanded(child: Text('Reports & Analytics', style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.bold))), const Chip(label: Text('LIVE'), backgroundColor: Color(0x554CAF50))]), const Align(alignment: Alignment.centerLeft, child: Text('Week of Sep 2026 · Up to Thu', style: TextStyle(color: Colors.white60, fontSize: 12))), const SizedBox(height: 12), Row(children: [Metric('Today\'s Sales', 'KSh 95K', 'Thu'), Metric('Week Sales', 'KSh ${(weekSales / 1000).round()}K', 'Mon – Thu'), Metric('Avg Margin', '${(weekProfit / weekSales * 100).toStringAsFixed(1)}%', 'This week')])])), TabBar(tabs: const [Tab(text: 'Daily'), Tab(text: 'Monthly'), Tab(text: 'Profit')], onTap: (value) => setState(() => tab = value), indicatorColor: navy, labelColor: navy), Expanded(child: ListView(padding: const EdgeInsets.all(16), children: [if (tab == 0) _daily(), if (tab == 1) _monthly(), if (tab == 2) _profit()]))]));
  }
  Widget _daily() {
    final chart = SizedBox(
      height: 190,
      child: LineChart(
        LineChartData(
          minY: 0,
          maxY: 140000,
          gridData: const FlGridData(show: true),
          titlesData: const FlTitlesData(show: true),
          lineBarsData: [_line(week, navy), _line(profit, gold)],
        ),
      ),
    );
    return Column(children: [_chartCard('Sales & Profit — This Week', chart), _breakdown(), _donut()]);
  }

  Widget _monthly() {
    final groups = months.asMap().entries.map((entry) {
      return BarChartGroupData(
        x: entry.key,
        barRods: [
          BarChartRodData(
            toY: entry.value,
            color: entry.key == 8 ? gold : navy,
            width: 14,
            borderRadius: BorderRadius.circular(3),
          ),
        ],
      );
    }).toList();
    final chart = SizedBox(
      height: 210,
      child: BarChart(
        BarChartData(
          maxY: 5,
          barGroups: groups,
          titlesData: const FlTitlesData(show: true),
          gridData: const FlGridData(show: true),
        ),
      ),
    );
    return Column(
      children: [
        _chartCard('Monthly Sales 2026', chart),
        const SizedBox(height: 12),
        const Section(
          title: 'Monthly Breakdown',
          child: Text('Jan  KSh 1.8M\nFeb  KSh 2.1M\nMar  KSh 2.4M\nApr  KSh 2.0M\nMay  KSh 2.7M\nJun  KSh 3.1M\nJul  KSh 2.9M\nAug  KSh 3.4M\nSep  KSh 3.0M'),
        ),
      ],
    );
  }

  Widget _profit() {
    final groups = profit.asMap().entries.map((entry) {
      return BarChartGroupData(
        x: entry.key,
        barRods: [
          BarChartRodData(
            toY: entry.value,
            color: entry.key == 3 ? gold : Colors.green,
            width: 20,
            borderRadius: BorderRadius.circular(4),
          ),
        ],
      );
    }).toList();
    final chart = SizedBox(
      height: 190,
      child: BarChart(
        BarChartData(
          maxY: 45000,
          barGroups: groups,
          titlesData: const FlTitlesData(show: true),
          gridData: const FlGridData(show: true),
        ),
      ),
    );
    return Column(
      children: [
        _chartCard('Profit This Week', chart),
        const Section(title: 'Net Profit (week to date)', child: Text('KSh 181,650 · 26.0% margin')),
      ],
    );
  }
  Widget _breakdown() => Section(title: 'Daily Breakdown', child: Column(children: week.asMap().entries.map((e) => Padding(padding: const EdgeInsets.only(bottom: 9), child: Row(children: [SizedBox(width: 32, child: Text(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][e.key])), Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(value: e.value / 130000, minHeight: 7, color: e.key == 3 ? gold : navy, backgroundColor: const Color(0xFFF0F3F9)))), const SizedBox(width: 10), SizedBox(width: 54, child: Text(e.key > 3 ? '—' : 'KSh ${(e.value / 1000).round()}K', textAlign: TextAlign.right, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)))]))).toList()));
  Widget _donut() {
    final chart = SizedBox(
      width: 130,
      height: 130,
      child: PieChart(
        PieChartData(
          centerSpaceRadius: 30,
          sections: [
            PieChartSectionData(value: 28, color: navy, showTitle: false),
            PieChartSectionData(value: 22, color: gold, showTitle: false),
            PieChartSectionData(value: 18, color: Colors.green, showTitle: false),
            PieChartSectionData(value: 15, color: Colors.red, showTitle: false),
            PieChartSectionData(value: 17, color: muted, showTitle: false),
          ],
        ),
      ),
    );
    return Section(
      title: 'Sales by Category',
      child: Row(
        children: [
          chart,
          const SizedBox(width: 14),
          const Expanded(
            child: Text(
              'Flour & Grains     28%\nDairy                    22%\nOils & Fats            18%\nPharma                 15%\nOthers                   17%',
              style: TextStyle(height: 1.8, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
  Widget _chartCard(String title, Widget chart) => Section(title: title, child: chart);
  static LineChartBarData _line(List<double> data, Color color) => LineChartBarData(spots: data.asMap().entries.map((e) => FlSpot(e.key.toDouble(), e.value)).toList(), color: color, isCurved: true, barWidth: 2, dotData: const FlDotData(show: false), belowBarData: BarAreaData(show: true, color: color.withOpacity(.08)));
}

class Metric extends StatelessWidget {
  const Metric(this.label, this.value, this.sub);
  final String label, value, sub;
  @override
  Widget build(BuildContext context) => Expanded(child: Container(margin: const EdgeInsets.only(right: 6), padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(10)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(color: Colors.white60, fontSize: 9)), Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)), Text(sub, style: const TextStyle(color: Colors.white54, fontSize: 9))])));
}
