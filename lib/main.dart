import 'package:flutter/material.dart';

import 'app.dart';

void main() {
  runApp(const MobiDukaDemo());
}

class MobiDukaDemo extends StatelessWidget {
  const MobiDukaDemo({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF123A8F)),
        useMaterial3: true,
      ),
      home: MobiDukaApp(
        data: AppData.demo,
        loginBuilder: _buildLogin,
        screenBuilders: {
          AppScreen.dashboard: _buildDashboard,
          AppScreen.pos: (context, data, onNavigate) => _buildProducts('Point of Sale', data.products),
          AppScreen.inventory: (context, data, onNavigate) => _buildProducts('Inventory & Stock', data.products),
          AppScreen.customers: _buildCustomers,
          AppScreen.reports: (context, data, onNavigate) => _buildDetailPage('Reports & Analytics', Icons.bar_chart, data, onNavigate),
          AppScreen.settings: (context, data, onNavigate) => _buildDetailPage('Settings', Icons.settings_outlined, data, onNavigate),
          AppScreen.profile: (context, data, onNavigate) => _buildDetailPage('User Profile', Icons.person_outline, data, onNavigate),
          AppScreen.purchases: (context, data, onNavigate) => _buildDetailPage('Purchase Orders', Icons.receipt_long_outlined, data, onNavigate),
          AppScreen.suppliers: (context, data, onNavigate) => _buildDetailPage('Suppliers', Icons.factory_outlined, data, onNavigate),
          AppScreen.credit: (context, data, onNavigate) => _buildDetailPage('Credit Book', Icons.menu_book_outlined, data, onNavigate),
          AppScreen.expenses: (context, data, onNavigate) => _buildDetailPage('Expense Tracking', Icons.payments_outlined, data, onNavigate),
          AppScreen.employees: (context, data, onNavigate) => _buildDetailPage('Employees', Icons.badge_outlined, data, onNavigate),
          AppScreen.notifications: (context, data, onNavigate) => _buildDetailPage('Notifications', Icons.notifications_outlined, data, onNavigate),
          AppScreen.backup: (context, data, onNavigate) => _buildDetailPage('Backup & Cloud Sync', Icons.cloud_outlined, data, onNavigate),
        },
        moreBuilder: _buildMore,
      ),
    );
  }

  static Widget _buildLogin(BuildContext context, VoidCallback onLogin) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0D1B3D), Color(0xFF123A8F)],
        ),
      ),
      padding: const EdgeInsets.all(28),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.storefront, size: 64, color: Colors.white),
            const SizedBox(height: 16),
            const Text('MobiDuka', style: TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.bold)),
            const Text('Point of Sale', style: TextStyle(color: Color(0xB3FFFFFF), fontSize: 16)),
            const SizedBox(height: 8),
            const Text('Smart retail management for modern businesses', textAlign: TextAlign.center, style: TextStyle(color: Color(0xB3FFFFFF))),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onLogin,
                child: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Get Started')),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(onPressed: onLogin, child: const Text('Quick PIN Login', style: TextStyle(color: Colors.white))),
          ],
        ),
      ),
    );
  }

  static Widget _buildDashboard(BuildContext context, AppData data, void Function(String screen) onNavigate) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 44, 16, 24),
      children: [
        const Text('Tue, 8 July 2026 · 14:45', style: TextStyle(color: Color(0xFF6B7A99))),
        Text(data.storeName, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF0D1B3D))),
        Text('${data.location} · Shift: ${data.shift}', style: const TextStyle(color: Color(0xFF6B7A99))),
        const SizedBox(height: 18),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.45,
          children: data.dashboardStats.map((stat) => Card(
                color: const Color(0xFF123A8F),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(stat.icon, style: const TextStyle(fontSize: 20)),
                    const Spacer(),
                    Text(stat.value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    Text(stat.label, style: const TextStyle(color: Color(0xB3FFFFFF), fontSize: 11)),
                    Text(stat.subtitle, style: const TextStyle(color: Colors.white, fontSize: 10)),
                  ]),
                ),
              )).toList(),
        ),
        const SizedBox(height: 16),
        _section('Top Selling Today', data.topProducts.map((product) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Text(product.name.substring(0, 1), style: const TextStyle(fontSize: 20)),
              title: Text(product.name),
              subtitle: Text('${product.unitsSold} units sold'),
              trailing: Text(product.revenue, style: const TextStyle(fontWeight: FontWeight.bold)),
            )).toList()),
        const SizedBox(height: 12),
        _section('Recent Transactions', data.recentTransactions.map((transaction) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(transaction.method == 'M-Pesa' ? Icons.phone_android : Icons.payments_outlined),
              title: Text(transaction.customer),
              subtitle: Text('${transaction.items} items · ${transaction.time}'),
              trailing: Text(transaction.amount, style: const TextStyle(fontWeight: FontWeight.bold)),
            )).toList()),
        const SizedBox(height: 12),
        Material(
          color: const Color(0xFFFFF8E1),
          borderRadius: BorderRadius.circular(14),
          clipBehavior: Clip.antiAlias,
          child: ListTile(
            leading: const Icon(Icons.warning_amber_rounded, color: Colors.orange),
            title: const Text('12 Items Low on Stock'),
            subtitle: Text(data.lowStockItems.join(' · ')),
            trailing: IconButton(onPressed: () => onNavigate('inventory'), icon: const Icon(Icons.arrow_forward)),
          ),
        ),
      ],
    );
  }

  static Widget _buildProducts(String title, List<ProductData> products) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 44, 16, 24),
      children: [
        Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 14),
        ...products.map((product) => Card(child: ListTile(
              leading: Text(product.emoji, style: const TextStyle(fontSize: 24)),
              title: Text(product.name),
              subtitle: Text('${product.category} · KSh ${product.price}'),
              trailing: Text('${product.stock} in stock'),
            ))),
      ],
    );
  }

  static Widget _buildCustomers(BuildContext context, AppData data, void Function(String screen) onNavigate) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 44, 16, 24),
      children: [
        const Text('Customers', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text('Total Customers  ${data.customers.length}'),
        const SizedBox(height: 12),
        ...data.customers.map((customer) => Card(child: ListTile(
              leading: CircleAvatar(child: Text(customer.initials)),
              title: Text(customer.name),
              subtitle: Text('${customer.phone} · ${customer.purchases} purchases'),
              trailing: Text(customer.credit == 0 ? 'Settled' : 'KSh ${customer.credit}'),
            ))),
      ],
    );
  }

  static Widget _buildMore(BuildContext context, AppData data, VoidCallback onLogout, void Function(String screen) onNavigate) {
    final links = <String, IconData>{
      'Reports': Icons.assessment_outlined,
      'Purchase Orders': Icons.receipt_long_outlined,
      'Suppliers': Icons.factory_outlined,
      'Credit Book': Icons.menu_book_outlined,
      'Expense Tracking': Icons.payments_outlined,
      'Employees': Icons.badge_outlined,
      'Notifications': Icons.notifications_outlined,
      'Backup & Cloud Sync': Icons.cloud_outlined,
      'Settings': Icons.settings_outlined,
      'User Profile': Icons.person_outline,
    };
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 48, 20, 24),
      children: [
        const CircleAvatar(radius: 26, child: Text('A')),
        const SizedBox(height: 8),
        const Text('Admin User', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        const Text('admin@mobiduka.co.ke\nStore Manager'),
        const SizedBox(height: 20),
        Text('Store\n${data.storeName}\n\nBranch\n${data.location}\n\nShift\n${data.shift}'),
        const SizedBox(height: 16),
        ...links.entries.map((entry) => ListTile(
              leading: Icon(entry.value),
              title: Text(entry.key),
              trailing: entry.key == 'Notifications' ? const Badge(label: Text('3')) : null,
              onTap: () => onNavigate(_routeName(entry.key)),
            )),
        const SizedBox(height: 12),
        FilledButton.icon(onPressed: onLogout, icon: const Icon(Icons.logout), label: const Text('Logout')),
        const SizedBox(height: 16),
        const Center(child: Text('MobiDuka POS v2.4.1\n© 2026 MobiTech Solutions Ltd · Kenya', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF6B7A99), fontSize: 11))),
      ],
    );
  }

  static String _routeName(String label) => switch (label) {
        'Purchase Orders' => 'purchases',
        'Backup & Cloud Sync' => 'backup',
        'User Profile' => 'profile',
        'Expense Tracking' => 'expenses',
        'Credit Book' => 'credit',
        _ => label.toLowerCase(),
      };

  static Widget _buildDetailPage(String title, IconData icon, AppData data, void Function(String screen) onNavigate) =>
      ManagementPage(title: title, icon: icon, data: data, onNavigate: onNavigate);

  static Widget _section(String title, List<Widget> children) => Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
            ...children,
          ]),
        ),
      );
}

class ManagementPage extends StatefulWidget {
  const ManagementPage({required this.title, required this.icon, required this.data, required this.onNavigate});

  final String title;
  final IconData icon;
  final AppData data;
  final void Function(String screen) onNavigate;

  @override
  State<ManagementPage> createState() => _ManagementPageState();
}

class _ManagementPageState extends State<ManagementPage> {
  String filter = 'All';
  bool editing = false;
  bool autoBackup = true;
  bool wifiOnly = true;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 42, 16, 28),
      children: [
        Row(children: [
          IconButton(onPressed: () => widget.onNavigate('more'), icon: const Icon(Icons.arrow_back)),
          Expanded(child: Text(widget.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold))),
          Icon(widget.icon, color: const Color(0xFF123A8F)),
        ]),
        const SizedBox(height: 12),
        ..._content(),
      ],
    );
  }

  List<Widget> _content() {
    switch (widget.title) {
      case 'Reports & Analytics':
        return _reports();
      case 'Purchase Orders':
        return _purchaseOrders();
      case 'Suppliers':
        return _suppliers();
      case 'Credit Book':
        return _creditBook();
      case 'Expense Tracking':
        return _expenses();
      case 'Employees':
        return _employees();
      case 'Notifications':
        return _notifications();
      case 'Backup & Cloud Sync':
        return _backup();
      case 'Settings':
        return _settings();
      case 'User Profile':
        return _profile();
      default:
        return [const Text('No content available')];
    }
  }

  List<Widget> _reports() => [
        const Text('Week of Sep 2026 · Up to Thu', style: TextStyle(color: Color(0xFF6B7A99))),
        const SizedBox(height: 12),
        Row(children: const [
          _MetricCard(label: "Today's Sales", value: 'KSh 95K', note: 'Thu'),
          _MetricCard(label: 'Week Sales', value: 'KSh 312K', note: 'Mon – Thu'),
          _MetricCard(label: 'Avg Margin', value: '26.0%', note: 'This week'),
        ]),
        _panel('Sales & Profit — This Week', Column(children: [
          _bar('Mon', 62, 'KSh 62K', false),
          _bar('Tue', 84, 'KSh 84K', false),
          _bar('Wed', 71, 'KSh 71K', false),
          _bar('Thu', 95, 'KSh 95K', true),
          _bar('Fri', 0, '—', false),
          _bar('Sat', 0, '—', false),
          _bar('Sun', 0, '—', false),
        ])),
        _panel('Daily Breakdown', Column(children: const [
          ListTile(title: Text('Mon'), trailing: Text('KSh 62K · 25%')),
          ListTile(title: Text('Tue'), trailing: Text('KSh 84K · 26%')),
          ListTile(title: Text('Wed'), trailing: Text('KSh 71K · 26%')),
          ListTile(title: Text('Thu'), trailing: Text('KSh 95K · 27%')),
        ])),
        _panel('Sales by Category', const Column(children: [
          _ProgressRow(label: 'Flour & Grains', value: 28, color: Color(0xFF123A8F)),
          _ProgressRow(label: 'Dairy', value: 22, color: Color(0xFFD4AF37)),
          _ProgressRow(label: 'Oils & Fats', value: 18, color: Colors.green),
          _ProgressRow(label: 'Pharma', value: 15, color: Colors.red),
          _ProgressRow(label: 'Others', value: 17, color: Color(0xFF6B7A99)),
        ])),
      ];

  Widget _bar(String label, int value, String amount, bool current) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(children: [
          SizedBox(width: 34, child: Text(label, style: TextStyle(fontWeight: current ? FontWeight.bold : FontWeight.normal))),
          Expanded(child: LinearProgressIndicator(value: value / 100, minHeight: 8, color: current ? const Color(0xFFD4AF37) : const Color(0xFF123A8F), backgroundColor: const Color(0xFFF0F3F9))),
          SizedBox(width: 64, child: Text(amount, textAlign: TextAlign.right, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold))),
        ]),
      );

  List<Widget> _purchaseOrders() {
    final orders = [
      ('PO-2026-084', 'Unga Limited', 'Pending', '6 items · Due 10 Jul 2026', 'KSh 48,000'),
      ('PO-2026-083', 'Bidco Africa', 'Delivered', '4 items · Due 9 Jul 2026', 'KSh 32,500'),
      ('PO-2026-082', 'Procter & Gamble', 'Partial', '8 items · Due 7 Jul 2026', 'KSh 67,200'),
      ('PO-2026-081', 'Dawa Limited', 'Delivered', '12 items · Due 5 Jul 2026', 'KSh 24,800'),
      ('PO-2026-080', 'Brookside Dairy', 'Cancelled', '3 items · Due 3 Jul 2026', 'KSh 18,600'),
    ];
    return [
      const _SummaryStrip(items: [('This Month', 'KSh 191K'), ('Pending', '3'), ('Delivered', '2')]),
      _filterChips(['All', 'Pending', 'Delivered']),
      ...orders.where((order) => filter == 'All' || order.$3 == filter).map((order) {
        return Card(
          child: ListTile(
            title: Text(order.$1, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('${order.$2}\n${order.$4}'),
            isThreeLine: true,
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [Text(order.$3), Text(order.$5, style: const TextStyle(fontWeight: FontWeight.bold))],
            ),
          ),
        );
      }),
    ];
  }

  List<Widget> _suppliers() {
    final suppliers = [
      ('UL', 'Unga Limited', 'Flour & Grains · Net 30', '12 orders', 'KSh 48K'),
      ('BA', 'Bidco Africa', 'Oils & Fats · Net 14', '8 orders', 'Settled'),
      ('PG', 'Procter & Gamble', 'FMCG · Net 21', '15 orders', 'KSh 33K'),
      ('DL', 'Dawa Limited', 'Pharmaceuticals · Prepaid', '6 orders', 'Settled'),
      ('BD', 'Brookside Dairy', 'Dairy Products · COD', '22 orders', 'KSh 12K'),
      ('KO', 'Kapa Oil', 'Cooking Oil · Net 7', '5 orders', 'Settled'),
    ];
    return [
      const _SummaryStrip(items: [('Total Suppliers', '6'), ('Outstanding', 'KSh 93K')]),
      const TextField(decoration: InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search suppliers...', filled: true)),
      const SizedBox(height: 10),
      ...suppliers.map((supplier) => Card(
            child: ListTile(
              leading: CircleAvatar(child: Text(supplier.$1)),
              title: Text(supplier.$2),
              subtitle: Text('${supplier.$3}\n★ ★ ★ ★ ★  ${supplier.$4}'),
              isThreeLine: true,
              trailing: Text(supplier.$5, style: const TextStyle(fontWeight: FontWeight.bold)),
            ),
          )),
    ];
  }

  List<Widget> _creditBook() => [
        const _SummaryStrip(items: [('Outstanding Credit', 'KSh 22,100'), ('Accounts', '5 active')]),
        ...widget.data.customers.where((customer) => customer.credit > 0).map((customer) => Card(
              child: ListTile(
                leading: CircleAvatar(child: Text(customer.initials)),
                title: Text(customer.name),
                subtitle: Text('${customer.phone} · ${customer.purchases} transactions\nLast: ${customer.lastVisit}'),
                isThreeLine: true,
                trailing: Text('KSh ${customer.credit}', style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
            )),
      ];

  List<Widget> _expenses() {
    final expenses = [
      ('⚡', 'Electricity Bill', 'Utilities · M-Pesa · 8 Jul 2026', 'KSh 8,500'),
      ('👥', 'Staff Salaries', 'Payroll · Bank · 7 Jul 2026', 'KSh 75,000'),
      ('🏪', 'Shop Rent', 'Rent · Bank · 1 Jul 2026', 'KSh 35,000'),
      ('🛍️', 'Plastic Bags & Packaging', 'Supplies · Cash · 6 Jul 2026', 'KSh 2,300'),
      ('📶', 'Internet & Data', 'Utilities · M-Pesa · 5 Jul 2026', 'KSh 3,500'),
      ('🚚', 'Transport / Delivery', 'Logistics · Cash · 3 Jul 2026', 'KSh 4,500'),
    ];
    return [
      const _SummaryStrip(items: [('Total This Month', 'KSh 136,400')]),
      _filterChips(['All', 'Utilities', 'Payroll', 'Rent', 'Supplies', 'Logistics']),
      ...expenses.map((expense) => Card(
            child: ListTile(
              leading: Text(expense.$1, style: const TextStyle(fontSize: 22)),
              title: Text(expense.$2),
              subtitle: Text(expense.$3),
              trailing: Text(expense.$4, style: const TextStyle(fontWeight: FontWeight.bold)),
            ),
          )),
    ];
  }

  List<Widget> _employees() {
    final employees = [
      ('AU', 'Admin User', 'Store Manager · Morning shift', 'KSh 55K', true),
      ('KO', 'Kevin Ochieng', 'Cashier · Morning shift', 'KSh 28K', true),
      ('FH', 'Fatuma Hassan', 'Stock Keeper · Afternoon shift', 'KSh 30K', true),
      ('BM', 'Brian Mutua', 'Cashier · Evening shift', 'KSh 26K', false),
      ('LA', 'Linda Auma', 'Supervisor · Morning shift', 'KSh 38K', true),
    ];
    return [
      const _SummaryStrip(items: [('Total', '5'), ('Active', '4'), ('Inactive', '1')]),
      ...employees.map((employee) => Card(
            child: ListTile(
              leading: CircleAvatar(child: Text(employee.$1)),
              title: Text(employee.$2),
              subtitle: Text(employee.$3),
              trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(employee.$4),
                  Text(employee.$5 ? '● Active' : '● Inactive', style: TextStyle(color: employee.$5 ? Colors.green : Colors.red, fontSize: 11)),
                ],
              ),
            ),
          )),
    ];
  }

  List<Widget> _notifications() => [
        Row(children: [const Text('3 new', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)), const Spacer(), TextButton(onPressed: () {}, child: const Text('Mark all read'))]),
        ...[
          ('🔴', 'Critical Stock Alert', 'Panadol 500mg has only 3 units remaining.', '14:30'),
          ('⚠️', 'Low Stock Warning', 'Royco 75g is running low (5 units).', '13:55'),
          ('🎯', 'Daily Sales Target Achieved', 'Today\'s sales of KSh 84,250 exceeded target.', '13:00'),
          ('📦', 'New Purchase Order Received', 'PO-2026-083 from Bidco Africa delivered.', '11:20'),
          ('☁️', 'Backup Completed', 'Your data has been successfully backed up.', '06:00'),
        ].map((notice) => Card(child: ListTile(leading: Text(notice.$1, style: const TextStyle(fontSize: 22)), title: Text(notice.$2), subtitle: Text('${notice.$3}\n${notice.$4}'), isThreeLine: true))),
      ];

  List<Widget> _backup() => [
        const Card(child: ListTile(leading: Icon(Icons.cloud_done, color: Colors.green), title: Text('Cloud Backup'), subtitle: Text('Last backup: Today, 06:00 AM\nAll data synced'))),
        const _SummaryStrip(items: [('Used', '4.2 MB'), ('Capacity', '15 GB')]),
        FilledButton.icon(onPressed: () {}, icon: const Icon(Icons.cloud_upload), label: const Text('Backup Now')),
        SwitchListTile(title: const Text('Auto Backup'), subtitle: const Text('Backup automatically every day at 6:00 AM'), value: autoBackup, onChanged: (value) => setState(() => autoBackup = value)),
        SwitchListTile(title: const Text('Wi-Fi Only'), subtitle: const Text('Only sync when connected to Wi-Fi'), value: wifiOnly, onChanged: (value) => setState(() => wifiOnly = value)),
        _panel('Backup History', const Column(children: [ListTile(leading: Icon(Icons.check_circle, color: Colors.green), title: Text('Today, 06:00 AM'), subtitle: Text('12,450 records · 4.2 MB')), ListTile(leading: Icon(Icons.check_circle, color: Colors.green), title: Text('Yesterday, 06:00 AM'), subtitle: Text('12,287 records · 4.1 MB')), ListTile(leading: Icon(Icons.error, color: Colors.red), title: Text('5 Jul, 06:00 AM'), subtitle: Text('Backup failed — retried'))])),
      ];

  List<Widget> _settings() => [
        _panel('Business Information', const Column(children: [ListTile(title: Text('Business Name'), subtitle: Text('MobiDuka Store')), ListTile(title: Text('Location'), subtitle: Text('Nairobi CBD, Kenya')), ListTile(title: Text('Phone'), subtitle: Text('+254 712 345 678')), ListTile(title: Text('Currency'), subtitle: Text('KES (Kenyan Shilling)'))])),
        _panel('Preferences', Column(children: [SwitchListTile(title: const Text('Auto-print Receipt'), value: true, onChanged: (_) {}), SwitchListTile(title: const Text('Low Stock Alerts'), value: true, onChanged: (_) {}), SwitchListTile(title: const Text('Daily Report Email'), value: false, onChanged: (_) {}), SwitchListTile(title: const Text('M-Pesa Integration'), value: true, onChanged: (_) {})])),
        _panel('Payment Methods', const Column(children: [ListTile(leading: Text('💵'), title: Text('Cash'), trailing: Text('Active')), ListTile(leading: Text('📱'), title: Text('M-Pesa'), trailing: Text('Active')), ListTile(leading: Text('📋'), title: Text('Credit / Tab'), trailing: Text('Active')), ListTile(leading: Text('🏦'), title: Text('Bank Transfer'), trailing: Text('Inactive'))])),
        const Center(child: Text('MobiDuka POS v2.4.1 · Build 20260708', style: TextStyle(color: Color(0xFF6B7A99), fontSize: 11))),
      ];

  List<Widget> _profile() => [
        Row(children: [const CircleAvatar(radius: 30, child: Text('A')), const SizedBox(width: 12), const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Admin User', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)), Text('Store Manager')]), const Spacer(), TextButton(onPressed: () => setState(() => editing = !editing), child: Text(editing ? 'Cancel' : 'Edit'))]),
        _panel('Personal Information', Column(children: [TextField(enabled: editing, decoration: const InputDecoration(labelText: 'Full Name', hintText: 'Admin User')), TextField(enabled: editing, decoration: const InputDecoration(labelText: 'Phone Number', hintText: '0712 345 678')), TextField(enabled: editing, decoration: const InputDecoration(labelText: 'Email Address', hintText: 'admin@mobiduka.co.ke'))])),
        _panel('Store Information', const Column(children: [ListTile(title: Text('Store Name'), subtitle: Text('MobiDuka Store')), ListTile(title: Text('Branch'), subtitle: Text('Nairobi CBD'))])),
        if (editing) FilledButton(onPressed: () => setState(() => editing = false), child: const Text('Save Changes')),
      ];

  Widget _filterChips(List<String> values) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: values.map((value) => Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(value),
                  selected: filter == value,
                  onSelected: (_) => setState(() => filter = value),
                ),
              )).toList(),
        ),
      );

  Widget _panel(String title, Widget child) => Card(child: Padding(padding: const EdgeInsets.fromLTRB(14, 12, 14, 8), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0D1B3D))), const SizedBox(height: 6), child])));
}

class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip({required this.items});
  final List<(String, String)> items;
  @override
  Widget build(BuildContext context) => Row(children: items.map((item) => Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(10), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(item.$1, style: const TextStyle(color: Color(0xFF6B7A99), fontSize: 10)), Text(item.$2, style: const TextStyle(fontWeight: FontWeight.bold))]))))).toList());
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, required this.value, required this.note});
  final String label;
  final String value;
  final String note;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Card(
          color: const Color(0xFF123A8F),
          child: Padding(
            padding: const EdgeInsets.all(9),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: Colors.white70, fontSize: 9)),
                Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                Text(note, style: const TextStyle(color: Colors.white60, fontSize: 9)),
              ],
            ),
          ),
        ),
      );
}

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({required this.label, required this.value, required this.color});
  final String label;
  final int value;
  final Color color;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 10), child: Row(children: [Expanded(child: Text(label)), SizedBox(width: 110, child: LinearProgressIndicator(value: value / 100, color: color, backgroundColor: const Color(0xFFE8ECF4))), const SizedBox(width: 8), SizedBox(width: 30, child: Text('$value%'))]));
}
