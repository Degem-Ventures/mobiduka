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
          AppScreen.reports: (context, data, onNavigate) => _buildInfoPage('Reports & Analytics', Icons.bar_chart, onNavigate),
          AppScreen.settings: (context, data, onNavigate) => _buildInfoPage('Settings', Icons.settings_outlined, onNavigate),
          AppScreen.profile: (context, data, onNavigate) => _buildInfoPage('User Profile', Icons.person_outline, onNavigate),
          AppScreen.purchases: (context, data, onNavigate) => _buildInfoPage('Purchase Orders', Icons.receipt_long_outlined, onNavigate),
          AppScreen.suppliers: (context, data, onNavigate) => _buildInfoPage('Suppliers', Icons.factory_outlined, onNavigate),
          AppScreen.credit: (context, data, onNavigate) => _buildInfoPage('Credit Book', Icons.menu_book_outlined, onNavigate),
          AppScreen.expenses: (context, data, onNavigate) => _buildInfoPage('Expense Tracking', Icons.payments_outlined, onNavigate),
          AppScreen.employees: (context, data, onNavigate) => _buildInfoPage('Employees', Icons.badge_outlined, onNavigate),
          AppScreen.notifications: (context, data, onNavigate) => _buildInfoPage('Notifications', Icons.notifications_outlined, onNavigate),
          AppScreen.backup: (context, data, onNavigate) => _buildInfoPage('Backup & Cloud Sync', Icons.cloud_outlined, onNavigate),
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
        ListTile(
          tileColor: const Color(0xFFFFF8E1),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          leading: const Icon(Icons.warning_amber_rounded, color: Colors.orange),
          title: const Text('12 Items Low on Stock'),
          subtitle: Text(data.lowStockItems.join(' · ')),
          trailing: IconButton(onPressed: () => onNavigate('inventory'), icon: const Icon(Icons.arrow_forward)),
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

  static Widget _buildInfoPage(String title, IconData icon, void Function(String screen) onNavigate) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 48, 16, 24),
      children: [
        Icon(icon, size: 48, color: const Color(0xFF123A8F)),
        const SizedBox(height: 12),
        Text(title, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        const Card(child: ListTile(title: Text('MobiDuka Store'), subtitle: Text('Nairobi CBD · Morning shift'))),
        ListTile(leading: const Icon(Icons.arrow_back), title: const Text('Back to More'), onTap: () => onNavigate('more')),
      ],
    );
  }

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
