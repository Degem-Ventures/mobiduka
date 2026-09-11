import 'package:flutter/material.dart';

enum AppScreen {
  login,
  dashboard,
  pos,
  inventory,
  reports,
  customers,
  more,
  settings,
  purchases,
  suppliers,
  credit,
  expenses,
  employees,
  notifications,
  backup,
  profile,
}

typedef ScreenBuilder = Widget Function(
  BuildContext context,
  AppData data,
  void Function(String screen) onNavigate,
);

typedef LoginBuilder = Widget Function(
  BuildContext context,
  VoidCallback onLogin,
);

typedef MoreBuilder = Widget Function(
  BuildContext context,
  AppData data,
  VoidCallback onLogout,
  void Function(String screen) onNavigate,
);

class DashboardStat {
  const DashboardStat({
    required this.label,
    required this.value,
    required this.subtitle,
    required this.icon,
  });

  final String label;
  final String value;
  final String subtitle;
  final String icon;
}

class QuickStat {
  const QuickStat({
    required this.label,
    required this.value,
    required this.subtitle,
    required this.icon,
  });

  final String label;
  final String value;
  final String subtitle;
  final String icon;
}

class ProductData {
  const ProductData({
    required this.id,
    required this.name,
    required this.category,
    required this.cost,
    required this.price,
    required this.stock,
    required this.reorder,
    required this.emoji,
    required this.status,
  });

  final int id;
  final String name;
  final String category;
  final int cost;
  final int price;
  final int stock;
  final int reorder;
  final String emoji;
  final String status;
}

class TopProduct {
  const TopProduct({
    required this.name,
    required this.unitsSold,
    required this.revenue,
    required this.change,
  });

  final String name;
  final int unitsSold;
  final String revenue;
  final String change;
}

class TransactionData {
  const TransactionData({
    required this.time,
    required this.customer,
    required this.amount,
    required this.method,
    required this.items,
  });

  final String time;
  final String customer;
  final String amount;
  final String method;
  final int items;
}

class CustomerData {
  const CustomerData({
    required this.name,
    required this.phone,
    required this.credit,
    required this.purchases,
    required this.lastVisit,
    required this.initials,
  });

  final String name;
  final String phone;
  final int credit;
  final int purchases;
  final String lastVisit;
  final String initials;
}

class AppData {
  const AppData({
    required this.storeName,
    required this.location,
    required this.shift,
    required this.dashboardStats,
    required this.quickStats,
    required this.topProducts,
    required this.recentTransactions,
    required this.customers,
    required this.products,
    required this.lowStockItems,
  });

  final String storeName;
  final String location;
  final String shift;
  final List<DashboardStat> dashboardStats;
  final List<QuickStat> quickStats;
  final List<TopProduct> topProducts;
  final List<TransactionData> recentTransactions;
  final List<CustomerData> customers;
  final List<ProductData> products;
  final List<String> lowStockItems;

  static const demo = AppData(
    storeName: 'MobiDuka Store',
    location: 'Nairobi CBD',
    shift: 'Morning',
    dashboardStats: [
      DashboardStat(label: "Today's Sales", value: 'KSh 84,250', subtitle: '+12% vs yesterday', icon: '📈'),
      DashboardStat(label: "Today's Profit", value: 'KSh 22,100', subtitle: '26.2% margin', icon: '💰'),
      DashboardStat(label: 'Cash in Till', value: 'KSh 45,800', subtitle: 'Last count: 2h ago', icon: '💵'),
      DashboardStat(label: 'M-Pesa Sales', value: 'KSh 38,450', subtitle: '47 transactions', icon: '📱'),
    ],
    quickStats: [
      QuickStat(label: 'Credit Out', value: 'KSh 12,300', subtitle: '8 customers', icon: '🔴'),
      QuickStat(label: 'Stock Value', value: 'KSh 312,000', subtitle: '486 SKUs', icon: '📦'),
      QuickStat(label: 'Low Stock', value: '12 items', subtitle: 'Need reorder', icon: '⚠️'),
      QuickStat(label: 'Transactions', value: '156', subtitle: 'Today', icon: '🧾'),
    ],
    topProducts: [
      TopProduct(name: 'Unga Jogoo 2kg', unitsSold: 42, revenue: 'KSh 8,400', change: '+8%'),
      TopProduct(name: 'Cooking Oil 1L', unitsSold: 38, revenue: 'KSh 7,220', change: '+15%'),
      TopProduct(name: 'Sugar 1kg', unitsSold: 35, revenue: 'KSh 4,900', change: '-3%'),
      TopProduct(name: 'Blue Band 500g', unitsSold: 29, revenue: 'KSh 4,350', change: '+5%'),
      TopProduct(name: 'Milk 500ml', unitsSold: 27, revenue: 'KSh 2,700', change: '+22%'),
    ],
    recentTransactions: [
      TransactionData(time: '14:32', customer: 'Walk-in', amount: 'KSh 1,250', method: 'Cash', items: 5),
      TransactionData(time: '14:18', customer: 'Jane Mwangi', amount: 'KSh 3,400', method: 'M-Pesa', items: 8),
      TransactionData(time: '13:55', customer: 'Walk-in', amount: 'KSh 650', method: 'Cash', items: 2),
      TransactionData(time: '13:41', customer: 'Peter Otieno', amount: 'KSh 5,200', method: 'Credit', items: 14),
    ],
    customers: [
      CustomerData(name: 'Jane Mwangi', phone: '0712 345 678', credit: 3400, purchases: 28, lastVisit: '2h ago', initials: 'JM'),
      CustomerData(name: 'Peter Otieno', phone: '0723 456 789', credit: 5200, purchases: 45, lastVisit: 'Yesterday', initials: 'PO'),
      CustomerData(name: 'Mary Wanjiku', phone: '0734 567 890', credit: 0, purchases: 32, lastVisit: '3 days ago', initials: 'MW'),
      CustomerData(name: 'James Kariuki', phone: '0745 678 901', credit: 1800, purchases: 19, lastVisit: '1 week ago', initials: 'JK'),
      CustomerData(name: 'Grace Achieng', phone: '0756 789 012', credit: 9600, purchases: 67, lastVisit: 'Today', initials: 'GA'),
      CustomerData(name: 'David Kamau', phone: '0767 890 123', credit: 0, purchases: 14, lastVisit: '2 weeks ago', initials: 'DK'),
      CustomerData(name: 'Sarah Njeri', phone: '0778 901 234', credit: 2100, purchases: 38, lastVisit: '4 days ago', initials: 'SN'),
    ],
    products: [
      ProductData(id: 1, name: 'Unga Jogoo 2kg', category: 'Flour', cost: 160, price: 200, stock: 45, reorder: 20, emoji: '🌾', status: 'good'),
      ProductData(id: 2, name: 'Cooking Oil 1L', category: 'Oils', cost: 150, price: 190, stock: 32, reorder: 15, emoji: '🫙', status: 'good'),
      ProductData(id: 3, name: 'Sugar 1kg', category: 'Sugar', cost: 100, price: 140, stock: 28, reorder: 30, emoji: '🍬', status: 'low'),
      ProductData(id: 4, name: 'Blue Band 500g', category: 'Spreads', cost: 110, price: 150, stock: 18, reorder: 20, emoji: '🧈', status: 'low'),
      ProductData(id: 5, name: 'Milk 500ml', category: 'Dairy', cost: 75, price: 100, stock: 60, reorder: 40, emoji: '🥛', status: 'good'),
      ProductData(id: 6, name: 'Royco 75g', category: 'Spices', cost: 30, price: 45, stock: 5, reorder: 20, emoji: '🌶️', status: 'critical'),
      ProductData(id: 7, name: 'Panadol 500mg', category: 'Pharma', cost: 20, price: 30, stock: 3, reorder: 50, emoji: '💊', status: 'critical'),
      ProductData(id: 8, name: 'Omo 400g', category: 'Detergent', cost: 130, price: 180, stock: 8, reorder: 15, emoji: '🧺', status: 'low'),
      ProductData(id: 9, name: 'Colgate 100ml', category: 'Personal', cost: 60, price: 85, stock: 22, reorder: 20, emoji: '🪥', status: 'good'),
      ProductData(id: 10, name: 'Bread White', category: 'Bakery', cost: 40, price: 55, stock: 15, reorder: 20, emoji: '🍞', status: 'low'),
      ProductData(id: 11, name: 'Eggs (tray)', category: 'Dairy', cost: 380, price: 480, stock: 12, reorder: 10, emoji: '🥚', status: 'good'),
      ProductData(id: 12, name: 'Nescafé 100g', category: 'Beverages', cost: 240, price: 320, stock: 9, reorder: 12, emoji: '☕', status: 'low'),
    ],
    lowStockItems: ['Panadol 500mg', 'Royco 75g', 'Omo 400g'],
  );
}

class NavItem {
  const NavItem({
    required this.screen,
    required this.label,
    required this.icon,
  });

  final AppScreen screen;
  final String label;
  final IconData icon;
}

class MobiDukaApp extends StatefulWidget {
  const MobiDukaApp({
    super.key,
    required this.loginBuilder,
    required this.screenBuilders,
    required this.moreBuilder,
    this.data = AppData.demo,
  });

  final LoginBuilder loginBuilder;
  final Map<AppScreen, ScreenBuilder> screenBuilders;
  final MoreBuilder moreBuilder;
  final AppData data;

  @override
  State<MobiDukaApp> createState() => _MobiDukaAppState();
}

class _MobiDukaAppState extends State<MobiDukaApp> {
  AppScreen _screen = AppScreen.login;
  bool _loggedIn = false;

  static const _navItems = <NavItem>[
    NavItem(screen: AppScreen.dashboard, label: 'Dashboard', icon: Icons.dashboard_outlined),
    NavItem(screen: AppScreen.pos, label: 'POS', icon: Icons.shopping_bag_outlined),
    NavItem(screen: AppScreen.inventory, label: 'Inventory', icon: Icons.inventory_2_outlined),
    NavItem(screen: AppScreen.customers, label: 'Customers', icon: Icons.people_outline),
    NavItem(screen: AppScreen.more, label: 'More', icon: Icons.menu),
  ];

  static const _bottomNavScreens = <AppScreen>{
    AppScreen.dashboard,
    AppScreen.pos,
    AppScreen.inventory,
    AppScreen.customers,
    AppScreen.more,
  };

  void _handleLogin() {
    setState(() {
      _loggedIn = true;
      _screen = AppScreen.dashboard;
    });
  }

  void _handleLogout() {
    setState(() {
      _loggedIn = false;
      _screen = AppScreen.login;
    });
  }

  void _handleNavigate(String screen) {
    for (final target in AppScreen.values) {
      if (target.name == screen) {
        setState(() => _screen = target);
        return;
      }
    }
  }

  Widget _buildCurrentScreen(BuildContext context) {
    if (_screen == AppScreen.more) {
      return widget.moreBuilder(context, widget.data, _handleLogout, _handleNavigate);
    }

    final builder = widget.screenBuilders[_screen];
    return builder?.call(context, widget.data, _handleNavigate) ?? const SizedBox.shrink();
  }

  @override
  Widget build(BuildContext context) {
    final activeNav = _bottomNavScreens.contains(_screen) ? _screen : null;
    final showNav = _bottomNavScreens.contains(_screen);

    return Material(
      color: Colors.transparent,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0D1B3D), Color(0xFF123A8F)],
          ),
        ),
        child: Stack(
        alignment: Alignment.center,
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Container(
              width: 393,
              height: 852,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF0A0A0A),
                borderRadius: BorderRadius.circular(54),
                boxShadow: const [
                  BoxShadow(color: Color(0x1AFFFFFF), spreadRadius: 1),
                  BoxShadow(color: Color(0xFF1A1A1A), spreadRadius: 2),
                  BoxShadow(color: Color(0x99000000), blurRadius: 40, offset: Offset(0, 40)),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(44),
                child: DecoratedBox(
                  decoration: const BoxDecoration(color: Colors.white),
                  child: Stack(
                    children: [
                      if (_screen == AppScreen.login)
                        widget.loginBuilder(context, _handleLogin)
                      else if (_loggedIn)
                        Column(
                          children: [
                            Expanded(child: ClipRect(child: _buildCurrentScreen(context))),
                            if (showNav) _buildBottomNav(activeNav),
                          ],
                        ),
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
                              borderRadius: BorderRadius.vertical(
                                bottom: Radius.circular(20),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const Positioned(
            bottom: 24,
            left: 20,
            right: 20,
            child: IgnorePointer(
              child: Column(
                children: [
                  Text(
                    'MobiDuka POS · Interactive Prototype',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0x59FFFFFF), fontSize: 12, fontWeight: FontWeight.w500, letterSpacing: 0.5),
                  ),
                  SizedBox(height: 2),
                  Text(
                    '25+ screens · Android UI · Material Design 3',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0x33FFFFFF), fontSize: 11),
                  ),
                ],
              ),
            ),
          ),
        ],
        ),
      ),
    );
  }

  Widget _buildBottomNav(AppScreen? activeNav) {
    return Container(
      height: 68,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE7EAF0))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: _navItems.map((item) {
          final isActive = activeNav == item.screen;
          return Expanded(
            child: InkWell(
              onTap: () => setState(() => _screen = item.screen),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(item.icon, size: 22, color: isActive ? const Color(0xFF123A8F) : const Color(0xFF9AA3B8)),
                      const SizedBox(height: 3),
                      Text(
                        item.label,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                          color: isActive ? const Color(0xFF123A8F) : const Color(0xFF9AA3B8),
                        ),
                      ),
                    ],
                  ),
                  if (item.screen == AppScreen.pos)
                    const Positioned(top: 6, right: 8, child: _StatusDot()),
                  if (isActive)
                    const Positioned(
                      bottom: 0,
                      child: SizedBox(width: 20, height: 3, child: DecoratedBox(decoration: BoxDecoration(color: Color(0xFF123A8F)))),
                    ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot();

  @override
  Widget build(BuildContext context) => Container(
        width: 7,
        height: 7,
        decoration: const BoxDecoration(color: Color(0xFFD4AF37), shape: BoxShape.circle),
      );
}