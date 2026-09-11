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
              width: 393,
              height: 852,
              margin: const EdgeInsets.all(18),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFF0A0A0A), borderRadius: BorderRadius.circular(54), boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 30, offset: Offset(0, 20))]),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(44),
                child: Stack(children: [
                  Column(children: [
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
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: Container(
                        width: 120,
                        height: 34,
                        decoration: const BoxDecoration(
                          color: Color(0xFF0A0A0A),
                          borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
                        ),
                      ),
                    ),
                  ),
                ]),
              ),
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
  String category = 'All';
  final Map<String, int> cart = {};
  Product? selected;

  @override
  Widget build(BuildContext context) {
    if (selected != null) return _productDetails(selected!);
    final visible = products.where((p) => (category == 'All' || p.category == category) && p.name.toLowerCase().contains(search.toLowerCase())).toList();
    final cartCount = cart.values.fold(0, (sum, quantity) => sum + quantity);
    final cartTotal = products.where((p) => cart.containsKey(p.name)).fold(0, (sum, p) => sum + p.price * cart[p.name]!);
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
        if (widget.title == 'Point of Sale')
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              children: ['All', 'Flour', 'Oils', 'Sugar', 'Dairy', 'Pharma', 'Beverages', 'Spreads', 'Spices', 'Bakery'].map((value) => Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(label: Text(value), selected: category == value, onSelected: (_) => setState(() => category = value)),
                  )).toList(),
            ),
          ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: visible.map((product) {
              return Card(
                child: ListTile(
                  onTap: widget.title == 'Inventory & Stock' ? () => setState(() => selected = product) : null,
                  leading: Text(product.emoji, style: const TextStyle(fontSize: 26)),
                  title: Text(product.name),
                  subtitle: Text('${product.category} · KSh ${product.price}'),
                  trailing: widget.title == 'Point of Sale'
                      ? FilledButton(onPressed: () => setState(() => cart[product.name] = (cart[product.name] ?? 0) + 1), child: Text('KSh ${product.price}'))
                      : Text('${product.stock} in stock', style: TextStyle(color: product.stock <= 5 ? Colors.red : muted, fontWeight: FontWeight.w600)),
                ),
              );
            }).toList(),
          ),
        ),
        if (widget.title == 'Point of Sale' && cartCount > 0)
          Material(
            color: navy,
            child: ListTile(
              leading: const Icon(Icons.shopping_bag, color: Colors.white),
              title: Text('$cartCount items in cart', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              subtitle: Text('KSh $cartTotal', style: const TextStyle(color: Colors.white70)),
              trailing: FilledButton.tonal(onPressed: () => _showCheckout(context, cartTotal), child: const Text('Checkout')),
            ),
          ),
      ],
    );
  }

  Widget _productDetails(Product product) => ListView(padding: const EdgeInsets.fromLTRB(16, 28, 16, 24), children: [
        Row(children: [IconButton(onPressed: () => setState(() => selected = null), icon: const Icon(Icons.arrow_back)), const Text('Product Details', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold))]),
        Card(color: navy, child: ListTile(leading: Text(product.emoji, style: const TextStyle(fontSize: 36)), title: Text(product.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)), subtitle: Text(product.category, style: const TextStyle(color: Colors.white70)))),
        const SizedBox(height: 12),
        Row(children: [_infoCard('Cost Price', 'KSh ${product.price - 40}', Colors.red), _infoCard('Selling Price', 'KSh ${product.price}', navy)]),
        Row(children: [_infoCard('Stock', '${product.stock} units', product.stock <= 5 ? Colors.red : Colors.green), _infoCard('Reorder', '${product.stock < 10 ? product.stock + 12 : product.stock - 10} units', gold)]),
        Card(child: ListTile(title: const Text('Stock Information'), subtitle: Text('Status: ${product.stock <= 5 ? 'Critical' : product.stock < 20 ? 'Low Stock' : 'In Stock'}\nCategory: ${product.category}\nCurrent stock: ${product.stock} units'))),
      ]);

  Widget _infoCard(String label, String value, Color color) => Expanded(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                Text(label, style: const TextStyle(color: muted, fontSize: 11)),
                Text(value, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 16)),
              ],
            ),
          ),
        ),
      );

  void _showCheckout(BuildContext context, int total) {
    showModalBottomSheet<void>(context: context, builder: (context) => SafeArea(child: Padding(padding: const EdgeInsets.all(20), child: Column(mainAxisSize: MainAxisSize.min, children: [Text('Payment · KSh $total', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)), const SizedBox(height: 16), FilledButton(onPressed: () { Navigator.pop(context); setState(() => cart.clear()); }, child: const Text('Complete Cash Sale')), OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel'))]))));
  }
}

class CustomerScreen extends StatefulWidget {
  const CustomerScreen();
  @override
  State<CustomerScreen> createState() => _CustomerScreenState();
}

class _CustomerScreenState extends State<CustomerScreen> {
  String search = '';
  String? selected;

  @override
  Widget build(BuildContext context) {
    final visible = productsCustomers.where((item) => item.$2.toLowerCase().contains(search.toLowerCase())).toList();
    if (selected != null) {
      final item = productsCustomers.firstWhere((value) => value.$2 == selected);
      return ListView(padding: const EdgeInsets.fromLTRB(16, 28, 16, 20), children: [Row(children: [IconButton(onPressed: () => setState(() => selected = null), icon: const Icon(Icons.arrow_back)), const Text('Customer Profile', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold))]), Card(color: navy, child: ListTile(leading: CircleAvatar(child: Text(item.$1)), title: Text(item.$2, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)), subtitle: Text('${item.$3}\nLast visit: Today', style: const TextStyle(color: Colors.white70)))), const Card(child: ListTile(title: Text('Transaction History'), subtitle: Text('Today · Sale · KSh 3,400\nYesterday · Credit · KSh 1,200\n5 Jul · Payment · KSh 2,000')))]);
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 20),
      children: [
        const Text('Customers', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        const Text('7 Total Customers · KSh 22,100 Total Credit', style: TextStyle(color: muted)),
        const SizedBox(height: 12),
        TextField(onChanged: (value) => setState(() => search = value), decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search customers...', filled: true)),
        const SizedBox(height: 12),
        ...visible.map((item) => Card(
              child: ListTile(
                onTap: () => setState(() => selected = item.$2),
                leading: CircleAvatar(child: Text(item.$1)),
                title: Text(item.$2),
                subtitle: Text('${item.$3} · ${item.$4} purchases'),
                trailing: Text(item.$5),
              ),
            )),
      ],
    );
  }
}

const productsCustomers = <(String, String, String, String, String)>[
  ('JM', 'Jane Mwangi', '0712 345 678', '28', 'KSh 3,400'),
  ('PO', 'Peter Otieno', '0723 456 789', '45', 'KSh 5,200'),
  ('JK', 'James Kariuki', '0745 678 901', '19', 'KSh 1,800'),
  ('GA', 'Grace Achieng', '0756 789 012', '67', 'KSh 9,600'),
  ('SN', 'Sarah Njeri', '0778 901 234', '38', 'KSh 2,100'),
];

class MoreScreen extends StatelessWidget {
  const MoreScreen({required this.onOpen, required this.onLogout});
  final ValueChanged<String> onOpen;
  final VoidCallback onLogout;
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 20), children: [
        Container(padding: const EdgeInsets.fromLTRB(0, 28, 0, 18), decoration: const BoxDecoration(gradient: LinearGradient(colors: [ink, navy])), child: Row(children: [const CircleAvatar(radius: 28, backgroundColor: gold, child: Text('A', style: TextStyle(color: ink, fontWeight: FontWeight.bold, fontSize: 20))), const SizedBox(width: 12), const Expanded(child: Text('Admin User\nadmin@mobiduka.co.ke\nStore Manager', style: TextStyle(color: Colors.white, height: 1.35))), IconButton(onPressed: () => onOpen('User Profile'), icon: const Icon(Icons.edit, color: Colors.white))])),
        const SizedBox(height: 12),
        Card(color: navy, child: const Padding(padding: EdgeInsets.all(12), child: Row(children: [Expanded(child: Column(children: [Text('Store', style: TextStyle(color: Colors.white60, fontSize: 10)), Text('MobiDuka Store', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold))])), Expanded(child: Column(children: [Text('Branch', style: TextStyle(color: Colors.white60, fontSize: 10)), Text('Nairobi CBD', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold))])), Expanded(child: Column(children: [Text('Shift', style: TextStyle(color: Colors.white60, fontSize: 10)), Text('Morning', style: TextStyle(color: gold, fontWeight: FontWeight.bold))]))]))),
        _menuSection('Sales & Finance', [('Sales History', 'Reports & Analytics', '🧾'), ('Purchase Orders', 'Purchase Orders', '📦'), ('Suppliers', 'Suppliers', '🏭'), ('Credit Book', 'Credit Book', '📋'), ('Expense Tracking', 'Expense Tracking', '💸')]),
        _menuSection('People', [('Employees', 'Employees', '👥'), ('Customer List', 'customers', '🙂')]),
        _menuSection('System', [('Notifications', 'Notifications', '🔔'), ('Backup & Cloud Sync', 'Backup & Cloud Sync', '☁️'), ('Settings', 'Settings', '⚙️'), ('User Profile', 'User Profile', '👤')]),
        FilledButton.icon(onPressed: onLogout, icon: const Icon(Icons.logout), label: const Text('Logout'), style: FilledButton.styleFrom(backgroundColor: const Color(0xFFD32F2F))),
        const SizedBox(height: 16),
        const Center(child: Text('MobiDuka POS v2.4.1\n© 2026 MobiTech Solutions Ltd · Kenya', textAlign: TextAlign.center, style: TextStyle(color: muted, fontSize: 11))),
      ]);

  Widget _menuSection(String title, List<(String, String, String)> items) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Padding(padding: const EdgeInsets.fromLTRB(4, 10, 4, 6), child: Text(title.toUpperCase(), style: const TextStyle(color: muted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1))), Card(child: Column(children: items.map((item) => Material(color: Colors.transparent, child: ListTile(leading: Text(item.$3, style: const TextStyle(fontSize: 20)), title: Text(item.$1), trailing: item.$1 == 'Notifications' ? const Badge(label: Text('3')) : const Icon(Icons.chevron_right), onTap: () => onOpen(item.$2)))).toList()))]);
}

class DetailScreen extends StatefulWidget {
  const DetailScreen({required this.title, required this.onBack});
  final String title;
  final VoidCallback onBack;
  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  bool editing = false;
  bool autoBackup = true;
  bool wifiOnly = true;

  @override
  Widget build(BuildContext context) {
    if (widget.title == 'Reports & Analytics') return ReportsScreen(onBack: widget.onBack);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 20),
      children: [
        Row(children: [IconButton(onPressed: widget.onBack, icon: const Icon(Icons.arrow_back)), Expanded(child: Text(widget.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)))]),
        const SizedBox(height: 12),
        ..._content(),
      ],
    );
  }

  List<Widget> _content() {
    switch (widget.title) {
      case 'Purchase Orders':
        return _cards([('PO-2026-084', 'Unga Limited', 'Pending', 'KSh 48,000'), ('PO-2026-083', 'Bidco Africa', 'Delivered', 'KSh 32,500'), ('PO-2026-082', 'Procter & Gamble', 'Partial', 'KSh 67,200'), ('PO-2026-081', 'Dawa Limited', 'Delivered', 'KSh 24,800')]);
      case 'Suppliers':
        return _cards([('Unga Limited', 'Flour & Grains · Net 30', '12 orders', 'KSh 48K'), ('Bidco Africa', 'Oils & Fats · Net 14', '8 orders', 'Settled'), ('Procter & Gamble', 'FMCG · Net 21', '15 orders', 'KSh 33K'), ('Dawa Limited', 'Pharmaceuticals · Prepaid', '6 orders', 'Settled')]);
      case 'Credit Book':
        return _cards([('Peter Otieno', '0723 456 789 · 45 transactions', '1d outstanding', 'KSh 5,200'), ('Grace Achieng', '0756 789 012 · 67 transactions', 'Added today', 'KSh 9,600'), ('Jane Mwangi', '0712 345 678 · 28 transactions', '1d outstanding', 'KSh 3,400'), ('Sarah Njeri', '0778 901 234 · 38 transactions', '4d outstanding', 'KSh 2,100')]);
      case 'Expense Tracking':
        return _cards([('Electricity Bill', 'Utilities · M-Pesa · 8 Jul 2026', 'RECURRING', 'KSh 8,500'), ('Staff Salaries', 'Payroll · Bank · 7 Jul 2026', 'RECURRING', 'KSh 75,000'), ('Shop Rent', 'Rent · Bank · 1 Jul 2026', 'RECURRING', 'KSh 35,000'), ('Plastic Bags & Packaging', 'Supplies · Cash · 6 Jul 2026', '', 'KSh 2,300')]);
      case 'Employees':
        return _cards([('Admin User', 'Store Manager · Morning shift', '● Active', 'KSh 55K'), ('Kevin Ochieng', 'Cashier · Morning shift', '● Active', 'KSh 28K'), ('Fatuma Hassan', 'Stock Keeper · Afternoon shift', '● Active', 'KSh 30K'), ('Brian Mutua', 'Cashier · Evening shift', '● Inactive', 'KSh 26K')]);
      case 'Notifications':
        return _cards([('🔴 Critical Stock Alert', 'Panadol 500mg has only 3 units remaining.', '14:30', ''), ('⚠️ Low Stock Warning', 'Royco 75g is running low (5 units).', '13:55', ''), ('🎯 Daily Sales Target Achieved', 'Today\'s sales reached KSh 84,250.', '13:00', ''), ('☁️ Backup Completed', 'Your data has been backed up to the cloud.', '06:00', '')]);
      case 'Backup & Cloud Sync':
        return [const Card(child: ListTile(leading: Icon(Icons.cloud_done, color: Colors.green), title: Text('Cloud Backup'), subtitle: Text('Last backup: Today, 06:00 AM\nAll data synced'))), FilledButton.icon(onPressed: () {}, icon: const Icon(Icons.cloud_upload), label: const Text('Backup Now')), SwitchListTile(title: const Text('Auto Backup'), subtitle: const Text('Every day at 6:00 AM'), value: autoBackup, onChanged: (value) => setState(() => autoBackup = value)), SwitchListTile(title: const Text('Wi-Fi Only'), value: wifiOnly, onChanged: (value) => setState(() => wifiOnly = value))];
      case 'Settings':
        return [const Card(child: ListTile(title: Text('Business Information'), subtitle: Text('MobiDuka Store\nNairobi CBD, Kenya\n+254 712 345 678\nKES (Kenyan Shilling)'))), const Card(child: ListTile(title: Text('Payment Methods'), subtitle: Text('💵 Cash   Active\n📱 M-Pesa   Active\n📋 Credit / Tab   Active\n🏦 Bank Transfer   Inactive'))), const SwitchListTile(title: Text('Auto-print Receipt'), value: true, onChanged: null), const SwitchListTile(title: Text('Low Stock Alerts'), value: true, onChanged: null)];
      case 'User Profile':
        return [Row(children: [const CircleAvatar(radius: 28, child: Text('A')), const SizedBox(width: 12), const Expanded(child: Text('Admin User\nStore Manager')), TextButton(onPressed: () => setState(() => editing = !editing), child: Text(editing ? 'Cancel' : 'Edit'))]), Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [TextField(enabled: editing, decoration: const InputDecoration(labelText: 'Full Name', hintText: 'Admin User')), TextField(enabled: editing, decoration: const InputDecoration(labelText: 'Phone Number', hintText: '0712 345 678')), TextField(enabled: editing, decoration: const InputDecoration(labelText: 'Email Address', hintText: 'admin@mobiduka.co.ke'))]))), const Card(child: ListTile(title: Text('Store Information'), subtitle: Text('MobiDuka Store\nNairobi CBD')))];
      default:
        return [Card(child: ListTile(title: Text(widget.title), subtitle: const Text('MobiDuka Store · Nairobi CBD\nThis section is ready for local store data.')))];
    }
  }

  List<Widget> _cards(List<(String, String, String, String)> values) => values.map((item) {
        return Card(
          child: ListTile(
            title: Text(item.$1, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('${item.$2}\n${item.$3}'),
            isThreeLine: true,
            trailing: Text(item.$4, style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
        );
      }).toList();
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
  static LineChartBarData _line(List<double> data, Color color) => LineChartBarData(spots: data.asMap().entries.map((e) => FlSpot(e.key.toDouble(), e.value)).toList(), color: color, isCurved: true, barWidth: 2, dotData: const FlDotData(show: false), belowBarData: BarAreaData(show: true, color: color.withValues(alpha: .08)));
}

class Metric extends StatelessWidget {
  const Metric(this.label, this.value, this.sub);
  final String label, value, sub;
  @override
  Widget build(BuildContext context) => Expanded(child: Container(margin: const EdgeInsets.only(right: 6), padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(10)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(color: Colors.white60, fontSize: 9)), Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)), Text(sub, style: const TextStyle(color: Colors.white54, fontSize: 9))])));
}
