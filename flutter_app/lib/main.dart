import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

void main() => runApp(const MobiDukaApp());

const navy = Color(0xFF123A8F);
const ink = Color(0xFF0D1B3D);
const gold = Color(0xFFD4AF37);
const muted = Color(0xFF6B7A99);

class Product {
  const Product(
    this.name,
    this.category,
    this.cost,
    this.price,
    this.stock,
    this.reorder,
    this.emoji, {
    this.status = 'good',
  });
  final String name;
  final String category;
  final int cost;
  final int price;
  final int stock;
  final int reorder;
  final String emoji;
  final String status;
}

const products = <Product>[
  Product('Unga Jogoo 2kg', 'Flour', 160, 200, 45, 20, '🌾'),
  Product('Cooking Oil 1L', 'Oils', 150, 190, 32, 15, '🫙'),
  Product('Sugar 1kg', 'Sugar', 100, 140, 28, 30, '🍬', status: 'low'),
  Product('Blue Band 500g', 'Spreads', 110, 150, 18, 20, '🧈', status: 'low'),
  Product('Milk 500ml', 'Dairy', 75, 100, 60, 40, '🥛'),
  Product('Royco 75g', 'Spices', 30, 45, 5, 20, '🌶️', status: 'critical'),
  Product('Panadol 500mg', 'Pharma', 20, 30, 3, 50, '💊', status: 'critical'),
  Product('Omo 400g', 'Detergent', 130, 180, 8, 15, '🧺', status: 'low'),
  Product('Colgate 100ml', 'Personal', 60, 85, 22, 20, '🪥'),
  Product('Bread White', 'Bakery', 40, 55, 15, 20, '🍞', status: 'low'),
  Product('Eggs (tray)', 'Dairy', 380, 480, 12, 10, '🥚'),
  Product('Nescafé 100g', 'Beverages', 240, 320, 9, 12, '☕', status: 'low'),
];

const inventoryCategories = <String>[
  'Flour',
  'Oils',
  'Sugar',
  'Spreads',
  'Dairy',
  'Spices',
  'Pharma',
  'Detergent',
  'Personal',
  'Bakery',
  'Beverages',
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
        ? LoginScreen(
            onLogin: () => setState(() {
              loggedIn = true;
              tab = 0;
            }),
          )
        : detail != null
            ? DetailScreen(title: detail!, onBack: () => setState(() => detail = null))
            : <Widget>[
                const DashboardScreen(),
                const POSScreen(),
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

class LoginScreen extends StatefulWidget {
  const LoginScreen({required this.onLogin});
  final VoidCallback onLogin;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  String step = 'splash';
  String pin = '';
  final TextEditingController emailController = TextEditingController(text: 'admin@mobiduka.co.ke');
  final TextEditingController passwordController = TextEditingController(text: '••••••••');

  void _handlePinPress(String digit) {
    if (pin.length >= 4) return;
    final next = pin + digit;
    setState(() => pin = next);
    if (next.length == 4) {
      Future.delayed(const Duration(milliseconds: 400), widget.onLogin);
    }
  }

  void _handlePinDelete() => setState(() {
    if (pin.isEmpty) return;
    pin = pin.substring(0, pin.length - 1);
  });

  @override
  Widget build(BuildContext context) {
    if (step == 'pin') {
      return Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [ink, navy],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(32, 0, 32, 40),
          child: Column(
            children: [
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 72,
                        height: 72,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [gold, Color(0xFFF0D060)],
                          ),
                        ),
                        child: const Center(
                          child: Text(
                            'A',
                            style: TextStyle(
                              color: ink,
                              fontSize: 28,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Admin User',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'MobiDuka Store',
                        style: TextStyle(
                          color: Color(0x99FFFFFF),
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 48),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(4, (index) => Container(
                          width: 16,
                          height: 16,
                          margin: EdgeInsets.only(right: index == 3 ? 0 : 20),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            backgroundBlendMode: BlendMode.srcOver,
                            color: index < pin.length ? gold : const Color(0x33FFFFFF),
                            border: Border.all(
                              color: index < pin.length ? gold : const Color(0x4DFFFFFF),
                              width: 2,
                            ),
                          ),
                        )),
                      ),
                      const SizedBox(height: 48),
                      SizedBox(
                        width: 280,
                        child: GridView.count(
                          crossAxisCount: 3,
                          shrinkWrap: true,
                          mainAxisSpacing: 16,
                          crossAxisSpacing: 16,
                          childAspectRatio: 1.8,
                          children: [
                            ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) {
                              if (key.isEmpty) return const SizedBox();
                              final isDelete = key == '⌫';
                              return Material(
                                color: isDelete ? Colors.transparent : const Color(0x1AFFFFFF),
                                borderRadius: BorderRadius.circular(16),
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(16),
                                  onTap: () => isDelete ? _handlePinDelete() : _handlePinPress(key),
                                  child: Center(
                                    child: Text(
                                      key,
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: isDelete ? 20 : 24,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            }),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(
                width: 220,
                child: TextButton(
                  onPressed: () => setState(() => step = 'login'),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.white,
                    padding: EdgeInsets.zero,
                  ),
                  child: const Text(
                    'Use email & password instead',
                    style: TextStyle(
                      color: Color(0x99FFFFFF),
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (step == 'login') {
      return Container(
        width: double.infinity,
        height: double.infinity,
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(28, 60, 28, 40),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [ink, navy],
                ),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: const BoxDecoration(
                          borderRadius: BorderRadius.all(Radius.circular(12)),
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [gold, Color(0xFFF0D060)],
                          ),
                        ),
                        child: Center(
                          child: SizedBox(
                            width: 24,
                            height: 24,
                            child: CustomPaint(painter: _StorefrontLogoPainter()),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text('MobiDuka POS', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                          Text('Business Management', style: TextStyle(color: Color(0xCCF0D060), fontSize: 12, fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text('Welcome back', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  const Text('Sign in to your account', style: TextStyle(color: Color(0x99FFFFFF), fontSize: 13)),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 0),
                child: Column(
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Email Address',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF6B7A99)),
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      style: const TextStyle(fontSize: 14, color: Color(0xFF0D1B3D)),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFE8ECF4)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFE8ECF4)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: navy),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Password',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF6B7A99)),
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: passwordController,
                      obscureText: true,
                      style: const TextStyle(fontSize: 14, color: Color(0xFF0D1B3D)),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFE8ECF4)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFE8ECF4)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: navy),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () {},
                        child: const Text(
                          'Forgot Password?',
                          style: TextStyle(color: navy, fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: widget.onLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF123A8F),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          shadowColor: const Color(0x403D73C8),
                          elevation: 4,
                        ),
                        child: const Text(
                          'Sign In',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: 220,
                      child: TextButton(
                        onPressed: () => setState(() => step = 'pin'),
                        style: TextButton.styleFrom(
                          backgroundColor: const Color(0x0D123A8F),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text(
                          'Use PIN Login instead',
                          style: TextStyle(color: navy, fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'MobiDuka POS v2.4.1 · Kenya',
                      style: TextStyle(fontSize: 12, color: Color(0xFF6B7A99)),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Powered by MobiTech Solutions Ltd',
                      style: TextStyle(fontSize: 11, color: Color(0xFFB0BAD3)),
                    ),
                    const SizedBox(height: 28),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [ink, navy],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(32, 0, 32, 40),
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(28),
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFFD4AF37), Color(0xFFF0D060), Color(0xFFC9A227)],
                        ),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x40D4AF37),
                            blurRadius: 32,
                            spreadRadius: 0,
                          ),
                        ],
                      ),
                      child: Center(
                        child: SizedBox(
                          width: 56,
                          height: 56,
                          child: CustomPaint(painter: _StorefrontLogoPainter()),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'MobiDuka',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Point of Sale',
                      style: TextStyle(
                        color: Color(0xFFE7C75B),
                        fontSize: 14,
                        letterSpacing: 3,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 18),
                    const Text(
                      'Smart retail management for\nmodern businesses',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color(0x99FFFFFF),
                        fontSize: 14,
                        height: 1.6,
                      ),
                    ),
                    const SizedBox(height: 44),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(3, (index) => Container(
                        margin: EdgeInsets.only(right: index == 2 ? 0 : 8),
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: index == 0 ? gold : const Color(0x4DFFFFFF),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      )),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: Column(
                children: [
                  SizedBox(
                    width: 220,
                    child: ElevatedButton(
                      onPressed: () => setState(() => step = 'login'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF0D060),
                        foregroundColor: const Color(0xFF0D1B3D),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        'Get Started',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: 220,
                    child: OutlinedButton(
                      onPressed: () => setState(() => step = 'pin'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Color(0x33FFFFFF)),
                        padding: const EdgeInsets.symmetric(vertical: 15),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        'Quick PIN Login',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StorefrontLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();

    final awning = Path()
      ..moveTo(size.width * (8 / 56), size.height * (22 / 56))
      ..lineTo(size.width * (28 / 56), size.height * (10 / 56))
      ..lineTo(size.width * (48 / 56), size.height * (22 / 56))
      ..close();

    paint.color = const Color(0xFF0D1B3D).withValues(alpha: 0.9);
    canvas.drawPath(awning, paint);

    final base = RRect.fromRectAndRadius(
      Rect.fromLTWH(size.width * (10 / 56), size.height * (22 / 56), size.width * (36 / 56), size.height * (22 / 56)),
      const Radius.circular(3),
    );
    paint.color = const Color(0xFF0D1B3D).withValues(alpha: 0.8);
    canvas.drawRRect(base, paint);

    final leftPanel = RRect.fromRectAndRadius(
      Rect.fromLTWH(size.width * (17 / 56), size.height * (28 / 56), size.width * (10 / 56), size.height * (16 / 56)),
      const Radius.circular(2),
    );
    paint.color = const Color(0xFFD4AF37).withValues(alpha: 0.9);
    canvas.drawRRect(leftPanel, paint);

    final phone = RRect.fromRectAndRadius(
      Rect.fromLTWH(size.width * (30 / 56), size.height * (26 / 56), size.width * (16 / 56), size.height * (22 / 56)),
      const Radius.circular(4),
    );
    paint.color = Colors.white.withValues(alpha: 0.95);
    canvas.drawRRect(phone, paint);

    final phoneScreen = RRect.fromRectAndRadius(
      Rect.fromLTWH(size.width * (32 / 56), size.height * (30 / 56), size.width * (12 / 56), size.height * (14 / 56)),
      const Radius.circular(2),
    );
    paint.color = const Color(0xFF123A8F).withValues(alpha: 0.8);
    canvas.drawRRect(phoneScreen, paint);

    paint.color = const Color(0xFF666666);
    canvas.drawCircle(Offset(size.width * (38 / 56), size.height * (46 / 56)), size.width * (1.5 / 56), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class DashboardScreen extends StatelessWidget {
  const DashboardScreen();

  @override
  Widget build(BuildContext context) {
    final quickStats = [
      {'label': 'Credit Out', 'value': 'KSh 12,300', 'sub': '8 customers', 'icon': '🔴'},
      {'label': 'Stock Value', 'value': 'KSh 312,000', 'sub': '486 SKUs', 'icon': '📦'},
      {'label': 'Low Stock', 'value': '12 items', 'sub': 'Need reorder', 'icon': '⚠️'},
      {'label': 'Transactions', 'value': '156', 'sub': 'Today', 'icon': '🧾'},
    ];

    final stats = [
      {'icon': '📈', 'value': 'KSh 84,250', 'label': "Today's Sales", 'sub': '+12% vs yesterday', 'bg': const LinearGradient(colors: [navy, Color(0xFF1A4FBF)])},
      {'icon': '💰', 'value': 'KSh 22,100', 'label': "Today's Profit", 'sub': '26.2% margin', 'bg': const LinearGradient(colors: [Color(0xFF2E7D32), Color(0xFF388E3C)])},
      {'icon': '💵', 'value': 'KSh 45,800', 'label': 'Cash in Till', 'sub': 'Last count: 2h ago', 'bg': const LinearGradient(colors: [gold, Color(0xFFF0D060)])},
      {'icon': '📱', 'value': 'KSh 38,450', 'label': 'M-Pesa Sales', 'sub': '47 transactions', 'bg': const LinearGradient(colors: [Color(0xFF005F2E), Color(0xFF00A651)])},
    ];

    final topProducts = [
      {'name': 'Unga Jogoo 2kg', 'sold': 42, 'revenue': 'KSh 8,400', 'change': '+8%'},
      {'name': 'Cooking Oil 1L', 'sold': 38, 'revenue': 'KSh 7,220', 'change': '+15%'},
      {'name': 'Sugar 1kg', 'sold': 35, 'revenue': 'KSh 4,900', 'change': '-3%'},
      {'name': 'Blue Band 500g', 'sold': 29, 'revenue': 'KSh 4,350', 'change': '+5%'},
      {'name': 'Milk 500ml', 'sold': 27, 'revenue': 'KSh 2,700', 'change': '+22%'},
    ];

    final recentTx = [
      {'time': '14:32', 'customer': 'Walk-in', 'amount': 'KSh 1,250', 'method': 'Cash', 'items': 5, 'icon': '💵', 'color': const Color(0xFFE3EAF8)},
      {'time': '14:18', 'customer': 'Jane Mwangi', 'amount': 'KSh 3,400', 'method': 'M-Pesa', 'items': 8, 'icon': '📱', 'color': const Color(0xFFE8F5E9)},
      {'time': '13:55', 'customer': 'Walk-in', 'amount': 'KSh 650', 'method': 'Cash', 'items': 2, 'icon': '💵', 'color': const Color(0xFFE3EAF8)},
      {'time': '13:41', 'customer': 'Peter Otieno', 'amount': 'KSh 5,200', 'method': 'Credit', 'items': 14, 'icon': '📝', 'color': const Color(0xFFFFEBEE)},
    ];

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(20, 52, 20, 20),
          decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [ink, navy]),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text('Tue, 8 July 2026 · 14:45', style: TextStyle(color: Color(0x99FFFFFF), fontSize: 12, fontWeight: FontWeight.w500)),
                        SizedBox(height: 2),
                        Text('MobiDuka Store', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                        SizedBox(height: 2),
                        Text('Nairobi CBD · Shift: Morning', style: TextStyle(color: Color(0xFFE7C75B), fontSize: 12, fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Stack(
                          alignment: Alignment.center,
                          children: const [
                            Icon(Icons.notifications_none_rounded, color: Colors.white, size: 18),
                            Positioned(
                              top: 7,
                              right: 8,
                              child: SizedBox(
                                width: 8,
                                height: 8,
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: Color(0xFFD32F2F),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.more_horiz, color: Colors.white, size: 18),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 74,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: quickStats.length,
                  padding: EdgeInsets.zero,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final item = quickStats[index];
                    return Container(
                      width: 118,
                      padding: const EdgeInsets.fromLTRB(10, 10, 10, 8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.12), width: 1),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${item['icon']} ${item['label']}', style: const TextStyle(color: Color(0x99FFFFFF), fontSize: 11)),
                          const SizedBox(height: 4),
                          Text(item['value'] as String, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 2),
                          Text(item['sub'] as String, style: const TextStyle(color: Color(0x66FFFFFF), fontSize: 10)),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
          child: Column(
            children: [
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.5,
                children: stats.map((item) {
                  final bg = item['bg'] as LinearGradient;
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: bg,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Stack(
                      children: [
                        Positioned(
                          right: -8,
                          top: -8,
                          child: Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white.withValues(alpha: 0.08),
                            ),
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item['icon'] as String, style: const TextStyle(fontSize: 22)),
                            const Spacer(),
                            Text(item['value'] as String, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                            const SizedBox(height: 2),
                            Text(item['label'] as String, style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 10)),
                            const SizedBox(height: 2),
                            Text(item['sub'] as String, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [BoxShadow(color: Color(0x11000000), blurRadius: 8, offset: Offset(0, 2))],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Quick Actions', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: ink)),
                    const SizedBox(height: 14),
                    GridView.count(
                      crossAxisCount: 4,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 0.84,
                      children: [
                        {'label': 'New Sale', 'icon': '🛒', 'color': navy, 'screen': 'pos'},
                        {'label': 'Add Stock', 'icon': '📦', 'color': const Color(0xFF2E7D32), 'screen': 'inventory'},
                        {'label': 'Add Expense', 'icon': '💸', 'color': const Color(0xFFD32F2F), 'screen': 'more'},
                        {'label': 'View Report', 'icon': '📊', 'color': gold, 'screen': 'reports'},
                      ].map((item) {
                        final color = item['color'] as Color;
                        return Column(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Center(child: Text(item['icon'] as String, style: const TextStyle(fontSize: 20))),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              item['label'] as String,
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color, height: 1.2),
                            ),
                          ],
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [BoxShadow(color: Color(0x11000000), blurRadius: 8, offset: Offset(0, 2))],
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Expanded(child: Text('Top Selling Today', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: ink))),
                        TextButton(
                          onPressed: () {},
                          child: const Text('See all', style: TextStyle(color: navy, fontSize: 12, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ...topProducts.asMap().entries.map((entry) {
                      final i = entry.key;
                      final p = entry.value;
                      final isLast = i == topProducts.length - 1;
                      return Padding(
                        padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
                        child: Row(
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(colors: [navy, Color(0xFF1A4FBF)]),
                                borderRadius: BorderRadius.all(Radius.circular(10)),
                              ),
                              child: Center(child: Text('${i + 1}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13))),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(p['name'] as String, style: const TextStyle(color: ink, fontWeight: FontWeight.w600, fontSize: 13), overflow: TextOverflow.ellipsis),
                                  const SizedBox(height: 2),
                                  Text('${p['sold']} units sold', style: const TextStyle(color: muted, fontSize: 11)),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(p['revenue'] as String, style: const TextStyle(color: ink, fontWeight: FontWeight.w700, fontSize: 12)),
                                const SizedBox(height: 2),
                                Text(
                                  p['change'] as String,
                                  style: TextStyle(
                                    color: (p['change'] as String).startsWith('+') ? const Color(0xFF2E7D32) : const Color(0xFFD32F2F),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [BoxShadow(color: Color(0x11000000), blurRadius: 8, offset: Offset(0, 2))],
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Expanded(child: Text('Recent Transactions', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: ink))),
                        TextButton(
                          onPressed: () {},
                          child: const Text('View all', style: TextStyle(color: navy, fontSize: 12, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ...recentTx.asMap().entries.map((entry) {
                      final i = entry.key;
                      final item = entry.value;
                      final isLast = i == recentTx.length - 1;
                      final method = item['method'] as String;
                      final badgeColor = method == 'M-Pesa'
                          ? const Color(0xFFE8F5E9)
                          : method == 'Credit'
                              ? const Color(0xFFFFEBEE)
                              : const Color(0xFFE3EAF8);
                      final badgeTextColor = method == 'M-Pesa'
                          ? const Color(0xFF2E7D32)
                          : method == 'Credit'
                              ? const Color(0xFFD32F2F)
                              : const Color(0xFF123A8F);

                      return Padding(
                        padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
                        child: Row(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: item['color'] as Color,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Center(child: Text(item['icon'] as String, style: const TextStyle(fontSize: 16))),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item['customer'] as String, style: const TextStyle(color: ink, fontWeight: FontWeight.w600, fontSize: 13)),
                                  const SizedBox(height: 2),
                                  Text('${item['items']} items · ${item['time']}', style: const TextStyle(color: muted, fontSize: 11)),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(item['amount'] as String, style: const TextStyle(color: ink, fontWeight: FontWeight.w700, fontSize: 13)),
                                const SizedBox(height: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: badgeColor,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    method,
                                    style: TextStyle(color: badgeTextColor, fontSize: 10, fontWeight: FontWeight.w700),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
                decoration: const BoxDecoration(
                  color: Color(0xFFFFF8E1),
                  borderRadius: BorderRadius.all(Radius.circular(16)),
                  border: Border.fromBorderSide(BorderSide(color: Color(0xFFFFE082))),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Text('⚠️', style: TextStyle(fontSize: 20)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Text('12 Items Low on Stock', style: TextStyle(color: Color(0xFF5D4037), fontSize: 13, fontWeight: FontWeight.w700)),
                              SizedBox(height: 2),
                              Text('Action needed before end of day', style: TextStyle(color: Color(0xFF8D6E63), fontSize: 11)),
                            ],
                          ),
                        ),
                        TextButton(
                          onPressed: () {},
                          style: TextButton.styleFrom(
                            backgroundColor: const Color(0xFFF9A825),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            minimumSize: const Size(0, 0),
                          ),
                          child: const Text('View', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ...[
                      {'label': 'Panadol 500mg', 'value': '3 left'},
                      {'label': 'Royco 75g', 'value': '5 left'},
                      {'label': 'Omo 400g', 'value': '8 left'},
                    ].asMap().entries.map((entry) {
                      final i = entry.key;
                      final item = entry.value;
                      return Padding(
                        padding: EdgeInsets.only(top: i > 0 ? 6 : 0),
                        child: Row(
                          children: [
                            Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFFF9A825), shape: BoxShape.circle)),
                            const SizedBox(width: 8),
                            Expanded(child: Text(item['label'] as String, style: const TextStyle(color: Color(0xFF5D4037), fontSize: 12))),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFEDB3),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(item['value'] as String, style: const TextStyle(color: Color(0xFF5D4037), fontSize: 10, fontWeight: FontWeight.w700)),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
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

class POSScreen extends StatefulWidget {
  const POSScreen({super.key});

  @override
  State<POSScreen> createState() => _POSScreenState();
}

class _POSScreenState extends State<POSScreen> {
  String search = '';
  String category = 'All';
  String paymentMethod = 'cash';
  int discount = 0;
  String view = 'pos';

  final List<String> categories = const [
    'All',
    'Flour',
    'Oils',
    'Sugar',
    'Dairy',
    'Pharma',
    'Beverages',
    'Spreads',
    'Spices',
    'Bakery',
  ];

  final Map<String, int> cart = {};

  void addToCart(Product product) {
    setState(() {
      cart[product.name] = (cart[product.name] ?? 0) + 1;
    });
  }

  void updateQty(String name, int delta) {
    setState(() {
      final next = (cart[name] ?? 0) + delta;
      if (next <= 0) {
        cart.remove(name);
      } else {
        cart[name] = next;
      }
    });
  }

  List<Product> get visibleProducts => products.where((product) {
    final matchesSearch = product.name.toLowerCase().contains(search.toLowerCase());
    final matchesCategory = category == 'All' || product.category == category;
    return matchesSearch && matchesCategory;
  }).toList();

  int get cartCount => cart.values.fold<int>(0, (sum, count) => sum + count);

  int get subtotal => cart.entries.fold<int>(0, (sum, entry) {
    final product = products.firstWhere((item) => item.name == entry.key);
    return sum + (product.price * entry.value);
  });

  int get discountAmount => (subtotal * discount / 100).round();

  int get total => subtotal - discountAmount;

  List<Map<String, dynamic>> get cartItems => cart.entries.map((entry) {
    final product = products.firstWhere((item) => item.name == entry.key);
    return {
      'name': product.name,
      'price': product.price,
      'qty': entry.value,
      'emoji': product.emoji,
    };
  }).toList();

  Widget _metricTile(String value, String label, Color tint) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(color: tint, fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 3),
            Text(label, style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 10)),
          ],
        ),
      ),
    );
  }

  Widget _pill(String text, bool selected, Color color, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? color : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? color : const Color(0xFFE8ECF4)),
        ),
        child: Text(
          text,
          style: TextStyle(
            color: selected ? Colors.white : muted,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _paymentOption(String key, String label, String subtitle, String icon, Color color) {
    final selected = paymentMethod == key;
    return GestureDetector(
      onTap: () => setState(() => paymentMethod = key),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.10) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? color : const Color(0xFFE8ECF4), width: selected ? 2 : 1.2),
          boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(child: Text(icon, style: const TextStyle(fontSize: 20))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(color: ink, fontSize: 15, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 3),
                  Text(subtitle, style: const TextStyle(color: muted, fontSize: 11)),
                ],
              ),
            ),
            if (selected)
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                child: const Icon(Icons.check, color: Colors.white, size: 14),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (view == 'receipt') {
      return Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 22),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [Color(0xFF2E7D32), Color(0xFF388E3C)]),
              ),
              child: Column(
                children: [
                  const Text('✅', style: TextStyle(fontSize: 48)),
                  const SizedBox(height: 8),
                  const Text('Sale Complete!', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text('Receipt #${(1000 + DateTime.now().millisecondsSinceEpoch % 9000)}', style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 13)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      children: [
                        const Text('MobiDuka Store · Nairobi CBD', style: TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        const Text('Tue 8 Jul 2026, 14:45', style: TextStyle(color: muted, fontSize: 11)),
                        const SizedBox(height: 18),
                        const Divider(color: Color(0xFFE8ECF4), thickness: 1),
                        const SizedBox(height: 12),
                        ...cartItems.map((item) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Row(
                                children: [
                                  Expanded(child: Text('${item['name']} × ${item['qty']}', style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w600))),
                                  Text('KSh ${(item['price'] as int) * (item['qty'] as int)}', style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w700)),
                                ],
                              ),
                            )),
                        const SizedBox(height: 12),
                        const Divider(color: Color(0xFFE8ECF4), thickness: 1),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Subtotal', style: TextStyle(color: muted, fontSize: 13)),
                            Text('KSh $subtotal', style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w700)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        if (discountAmount > 0)
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Discount ($discount%)', style: const TextStyle(color: Color(0xFFD32F2F), fontSize: 13, fontWeight: FontWeight.w700)),
                              Text('-KSh $discountAmount', style: const TextStyle(color: Color(0xFFD32F2F), fontSize: 13, fontWeight: FontWeight.w700)),
                            ],
                          ),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('TOTAL', style: TextStyle(color: ink, fontSize: 16, fontWeight: FontWeight.w800)),
                            Text('KSh $total', style: const TextStyle(color: navy, fontSize: 16, fontWeight: FontWeight.w800)),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Payment', style: TextStyle(color: muted, fontSize: 12)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(999),
                                color: paymentMethod == 'mpesa'
                                    ? const Color(0xFFE8F5E9)
                                    : paymentMethod == 'credit'
                                        ? const Color(0xFFFFEBEE)
                                        : const Color(0xFFE3EAF8),
                              ),
                              child: Text(
                                paymentMethod == 'mpesa'
                                    ? 'M-Pesa'
                                    : paymentMethod == 'credit'
                                        ? 'Credit'
                                        : 'Cash',
                                style: TextStyle(
                                  color: paymentMethod == 'mpesa'
                                      ? const Color(0xFF2E7D32)
                                      : paymentMethod == 'credit'
                                          ? const Color(0xFFD32F2F)
                                          : navy,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: TextButton(
                          onPressed: () {},
                          style: TextButton.styleFrom(
                            backgroundColor: const Color(0xFFEEF2FF),
                            foregroundColor: navy,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text('Print Receipt', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextButton(
                          onPressed: () {
                            setState(() {
                              cart.clear();
                              discount = 0;
                              view = 'pos';
                              paymentMethod = 'cash';
                            });
                          },
                          style: TextButton.styleFrom(
                            backgroundColor: navy,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text('New Sale', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (view == 'payment') {
      return Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [ink, navy]),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() => view = 'cart'),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.12),
                      foregroundColor: Colors.white,
                      fixedSize: const Size(36, 36),
                    ),
                    icon: const Icon(Icons.arrow_back),
                  ),
                  const SizedBox(width: 12),
                  const Text('Payment', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      children: [
                        const Text('Total Amount Due', style: TextStyle(color: muted, fontSize: 12)),
                        const SizedBox(height: 8),
                        Text('KSh $total', style: const TextStyle(color: Color(0xFFD4AF37), fontSize: 36, fontWeight: FontWeight.w900)),
                        const SizedBox(height: 6),
                        Text('$cartCount items', style: const TextStyle(color: muted, fontSize: 12)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text('Select Payment Method', style: TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  _paymentOption('cash', 'Cash', 'Physical cash payment', '💵', navy),
                  _paymentOption('mpesa', 'M-Pesa', 'Mobile money transfer', '📱', const Color(0xFF2E7D32)),
                  _paymentOption('credit', 'Credit / Tab', 'Add to customer account', '📋', const Color(0xFFD32F2F)),
                  const SizedBox(height: 20),
                  const Text('Discount', style: TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [0, 5, 10, 15, 20].map((value) {
                      final selected = discount == value;
                      return GestureDetector(
                        onTap: () => setState(() => discount = value),
                        child: Container(
                          width: 58,
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: selected ? navy : Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: selected ? navy : const Color(0xFFE8ECF4)),
                          ),
                          child: Center(
                            child: Text('${value}%', style: TextStyle(color: selected ? Colors.white : muted, fontSize: 13, fontWeight: FontWeight.w700)),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 18),
                  TextButton(
                    onPressed: () => setState(() => view = 'receipt'),
                    style: TextButton.styleFrom(
                      backgroundColor: navy,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: Text('Complete Sale · KSh $total', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (view == 'cart') {
      return Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [ink, navy]),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() => view = 'pos'),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.12),
                      foregroundColor: Colors.white,
                      fixedSize: const Size(36, 36),
                    ),
                    icon: const Icon(Icons.arrow_back),
                  ),
                  const SizedBox(width: 12),
                  Text('Cart ($cartCount items)', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
            Expanded(
              child: cartItems.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('🛒', style: TextStyle(fontSize: 48)),
                          SizedBox(height: 12),
                          Text('Cart is empty', style: TextStyle(color: muted, fontSize: 18, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    )
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: cartItems.map((item) {
                        final price = item['price'] as int;
                        final qty = item['qty'] as int;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                decoration: const BoxDecoration(color: Color(0xFFE3EAF8), borderRadius: BorderRadius.all(Radius.circular(10))),
                                child: Center(child: Text(item['emoji'] as String, style: const TextStyle(fontSize: 20))),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(item['name'] as String, style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                                    const SizedBox(height: 4),
                                    Text('KSh $price each', style: const TextStyle(color: muted, fontSize: 11)),
                                  ],
                                ),
                              ),
                              Row(
                                children: [
                                  InkWell(
                                    onTap: () => updateQty(item['name'] as String, -1),
                                    child: Container(
                                      width: 28,
                                      height: 28,
                                      decoration: BoxDecoration(color: const Color(0xFFF0F3F9), borderRadius: BorderRadius.circular(8)),
                                      child: const Center(child: Icon(Icons.remove, size: 16, color: ink)),
                                    ),
                                  ),
                                  SizedBox(
                                    width: 28,
                                    child: Center(
                                      child: Text('$qty', style: const TextStyle(color: ink, fontSize: 15, fontWeight: FontWeight.w800)),
                                    ),
                                  ),
                                  InkWell(
                                    onTap: () => updateQty(item['name'] as String, 1),
                                    child: Container(
                                      width: 28,
                                      height: 28,
                                      decoration: BoxDecoration(color: navy, borderRadius: BorderRadius.circular(8)),
                                      child: const Center(child: Icon(Icons.add, size: 16, color: Colors.white)),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(width: 12),
                              Text('KSh ${price * qty}', style: const TextStyle(color: ink, fontSize: 12, fontWeight: FontWeight.w800)),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: Color(0xFFE8ECF4))),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Subtotal ($cartCount items)', style: const TextStyle(color: muted, fontSize: 14)),
                      Text('KSh $subtotal', style: const TextStyle(color: ink, fontSize: 14, fontWeight: FontWeight.w800)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: cartItems.isEmpty ? null : () => setState(() => view = 'payment'),
                    style: TextButton.styleFrom(
                      backgroundColor: cartItems.isEmpty ? const Color(0xFFE8ECF4) : navy,
                      foregroundColor: cartItems.isEmpty ? const Color(0xFFB0BAD3) : Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Proceed to Payment →', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      color: const Color(0xFFF5F7FA),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 52, 16, 14),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy]),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: 44,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.search, color: Color(0xCCFFFFFF), size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                onChanged: (value) => setState(() => search = value),
                                style: const TextStyle(color: Colors.white, fontSize: 14),
                                decoration: const InputDecoration(
                                  hintText: 'Search products...',
                                  hintStyle: TextStyle(color: Color(0xCCFFFFFF)),
                                  border: InputBorder.none,
                                  isDense: true,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    InkWell(
                      onTap: () => setState(() => view = 'cart'),
                      child: Container(
                        width: 52,
                        height: 44,
                        decoration: BoxDecoration(
                          color: gold,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            const Icon(Icons.shopping_bag_outlined, color: ink, size: 20),
                            if (cartCount > 0)
                              Positioned(
                                right: 8,
                                top: 6,
                                child: Container(
                                  width: 18,
                                  height: 18,
                                  decoration: BoxDecoration(color: const Color(0xFFD32F2F), shape: BoxShape.circle),
                                  child: Center(child: Text('$cartCount', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800))),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _metricTile('$cartCount', 'Items', Colors.white),
                    const SizedBox(width: 8),
                    _metricTile('KSh $subtotal', 'Subtotal', const Color(0xFFE0C35B)),
                    const SizedBox(width: 8),
                    _metricTile('KSh $total', 'Total', const Color(0xFFB8F0C3)),
                  ],
                ),
              ],
            ),
          ),
          Container(
            color: Colors.white,
            child: SizedBox(
              height: 48,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                itemCount: categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final value = categories[index];
                  final selected = category == value;
                  return _pill(
                    value,
                    selected,
                    navy,
                    onTap: () => setState(() => category = value),
                  );
                },
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              children: visibleProducts.map((product) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: const BoxDecoration(color: Color(0xFFE3EAF8), borderRadius: BorderRadius.all(Radius.circular(12))),
                        child: Center(child: Text(product.emoji, style: const TextStyle(fontSize: 22))),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(product.name, style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            Text(product.category, style: const TextStyle(color: muted, fontSize: 11)),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('KSh ${product.price}', style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          Text(
                            '${product.stock} in stock',
                            style: TextStyle(
                              color: product.stock <= 5 ? const Color(0xFFD32F2F) : muted,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 10),
                      TextButton(
                        onPressed: () => addToCart(product),
                        style: TextButton.styleFrom(
                          backgroundColor: navy,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(64, 36),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('Add', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
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
  String filter = 'all';
  final Map<String, int> cart = {};
  Product? selected;
  bool showAddProduct = false;
  bool showAddCategory = false;
  Product? editProduct;
  final Map<String, String> productForm = {
    'name': '',
    'category': 'Flour',
    'cost': '',
    'price': '',
    'stock': '',
    'reorder': '',
    'emoji': '📦',
  };
  String newCategoryName = '';
  String newCategoryEmoji = '📦';

  Color _statusBadgeBg(String status) {
    switch (status) {
      case 'critical':
        return const Color(0xFFFFF1F1);
      case 'low':
        return const Color(0xFFFFF7E6);
      default:
        return const Color(0xFFE9F7EE);
    }
  }

  Color _statusBadgeText(String status) {
    switch (status) {
      case 'critical':
        return const Color(0xFFD32F2F);
      case 'low':
        return const Color(0xFFF9A825);
      default:
        return const Color(0xFF2E7D32);
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'critical':
        return 'Critical';
      case 'low':
        return 'Low Stock';
      default:
        return 'In Stock';
    }
  }

  void _resetProductForm() {
    productForm
      ..update('name', (_) => '')
      ..update('category', (_) => 'Flour')
      ..update('cost', (_) => '')
      ..update('price', (_) => '')
      ..update('stock', (_) => '')
      ..update('reorder', (_) => '')
      ..update('emoji', (_) => '📦');
  }

  void _saveProduct() {
    final name = productForm['name']?.trim() ?? '';
    final categoryValue = productForm['category'] ?? 'Flour';
    final cost = int.tryParse(productForm['cost'] ?? '') ?? 0;
    final price = int.tryParse(productForm['price'] ?? '') ?? 0;
    final stock = int.tryParse(productForm['stock'] ?? '') ?? 0;
    final reorder = int.tryParse(productForm['reorder'] ?? '') ?? 10;
    final emoji = productForm['emoji'] ?? '📦';
    if (name.isEmpty) return;

    final status = stock == 0
        ? 'critical'
        : stock <= reorder * 0.3
            ? 'critical'
            : stock < reorder
                ? 'low'
                : 'good';

    final nextProduct = Product(name, categoryValue, cost, price, stock, reorder, emoji, status: status);
    setState(() {
      if (editProduct != null) {
        final index = products.indexWhere((item) => item.name == editProduct!.name && item.category == editProduct!.category);
        if (index >= 0) {
          products[index] = nextProduct;
        }
      } else {
        products.insert(0, nextProduct);
      }
      showAddProduct = false;
      editProduct = null;
      _resetProductForm();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.title == 'Inventory & Stock') {
      if (showAddCategory) return _inventoryAddCategory();
      if (showAddProduct) return _inventoryAddProduct();
      if (selected != null) return _inventoryDetail(selected!);
      return _inventoryList();
    }

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

  Widget _inventoryList() {
    final criticalCount = products.where((p) => p.status == 'critical').length;
    final lowCount = products.where((p) => p.status == 'low').length;
    final filtered = products.where((p) {
      final matchSearch = p.name.toLowerCase().contains(search.toLowerCase());
      final matchFilter = filter == 'all' || p.status == filter || (filter == 'low' && (p.status == 'low' || p.status == 'critical'));
      return matchSearch && matchFilter;
    }).toList();

    return Container(
      color: const Color(0xFFF5F7FA),
      child: Stack(
        children: [
          Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(colors: [ink, navy]),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Inventory',
                          style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
                        ),
                        Row(
                          children: [
                            TextButton(
                              onPressed: () => setState(() => showAddCategory = true),
                              style: TextButton.styleFrom(
                                backgroundColor: Colors.white.withValues(alpha: 0.12),
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              ),
                              child: const Text('+ Category', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                            ),
                            const SizedBox(width: 8),
                            TextButton(
                              onPressed: () {
                                _resetProductForm();
                                editProduct = null;
                                setState(() => showAddProduct = true);
                              },
                              style: TextButton.styleFrom(
                                backgroundColor: gold,
                                foregroundColor: ink,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              ),
                              child: const Text('+ Product', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        _inventoryMetric('Total SKUs', '${products.length}', Colors.white),
                        const SizedBox(width: 8),
                        _inventoryMetric('Critical', '$criticalCount', const Color(0xFFFF6B6B)),
                        const SizedBox(width: 8),
                        _inventoryMetric('Low Stock', '$lowCount', const Color(0xFFFFD93D)),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: TextField(
                        onChanged: (value) => setState(() => search = value),
                        style: const TextStyle(color: Colors.white, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Search products...',
                          hintStyle: const TextStyle(color: Color(0x99FFFFFF)),
                          prefixIcon: const Icon(Icons.search, color: Color(0xCCFFFFFF)),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: double.infinity,
                color: Colors.white,
                child: Row(
                  children: ['all', 'low', 'critical'].map((value) {
                    final label = value == 'all' ? 'All Products' : value == 'low' ? 'Low Stock' : 'Critical';
                    final selected = filter == value;
                    return Expanded(
                      child: InkWell(
                        onTap: () => setState(() => filter = value),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            border: Border(bottom: BorderSide(color: selected ? navy : Colors.transparent, width: 2)),
                          ),
                          child: Text(
                            label,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: selected ? navy : muted,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 88),
                  children: filtered.map((product) {
                    final badgeColor = _statusBadgeBg(product.status);
                    final badgeTextColor = _statusBadgeText(product.status);
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                      ),
                      child: InkWell(
                        onTap: () => setState(() => selected = product),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: const Color(0xFFE3EAF8),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Center(child: Text(product.emoji, style: const TextStyle(fontSize: 22))),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    product.name,
                                    style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${product.category} · Cost: KSh ${product.cost}',
                                    style: const TextStyle(color: muted, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  'KSh ${product.price}',
                                  style: const TextStyle(color: navy, fontSize: 14, fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: 5),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: badgeColor,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    '${product.stock} units',
                                    style: TextStyle(color: badgeTextColor, fontSize: 10, fontWeight: FontWeight.w800),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
          Positioned(
            right: 16,
            bottom: 80,
            child: FloatingActionButton(
              onPressed: () {
                _resetProductForm();
                editProduct = null;
                setState(() => showAddProduct = true);
              },
              backgroundColor: const Color(0xFFD4AF37),
              foregroundColor: ink,
              tooltip: 'Add Product',
              child: const Icon(Icons.add),
            ),
          ),
        ],
      ),
    );
  }

  Widget _inventoryMetric(String label, String value, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            children: [
              Text(value, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 3),
              Text(label, style: const TextStyle(color: Color(0x99FFFFFF), fontSize: 10)),
            ],
          ),
        ),
      );

  Widget _inventoryDetail(Product product) {
    final margin = ((product.price - product.cost) / product.price * 100).round();
    return Container(
      color: const Color(0xFFF5F7FA),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy]),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: () => setState(() => selected = null),
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: 0.12),
                        foregroundColor: Colors.white,
                        fixedSize: const Size(36, 36),
                      ),
                      icon: const Icon(Icons.arrow_back),
                    ),
                    const SizedBox(width: 12),
                    const Text('Product Details', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Center(child: Text(product.emoji, style: const TextStyle(fontSize: 32))),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(product.name, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 4),
                          Text(product.category, style: const TextStyle(color: Colors.white60, fontSize: 13)),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 1.7,
                  children: [
                    _detailStatCard('Cost Price', 'KSh ${product.cost}', const Color(0xFFD32F2F)),
                    _detailStatCard('Selling Price', 'KSh ${product.price}', navy),
                    _detailStatCard('Profit Margin', '$margin%', const Color(0xFF2E7D32)),
                    _detailStatCard('Current Stock', '${product.stock} units', _statusBadgeText(product.status)),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Stock Information', style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 12),
                      _stockRow('Reorder Level', '${product.reorder} units'),
                      _stockRow('Stock Status', _statusLabel(product.status)),
                      _stockRow('Units Below Reorder', product.stock < product.reorder ? '${product.reorder - product.stock} units' : 'None'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: () {
                          productForm.updateAll((key, value) => switch (key) {
                                'name' => product.name,
                                'category' => product.category,
                                'cost' => product.cost.toString(),
                                'price' => product.price.toString(),
                                'stock' => product.stock.toString(),
                                'reorder' => product.reorder.toString(),
                                'emoji' => product.emoji,
                                _ => value,
                              });
                          editProduct = product;
                          setState(() => showAddProduct = true);
                        },
                        style: TextButton.styleFrom(
                          backgroundColor: const Color(0xFFE9EEFF),
                          foregroundColor: navy,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('Edit Product', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextButton(
                        onPressed: () {},
                        style: TextButton.styleFrom(
                          backgroundColor: navy,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('Purchase Order', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailStatCard(String label, String value, Color color) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 6, offset: Offset(0, 2))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: muted, fontSize: 11)),
            const SizedBox(height: 6),
            Text(value, style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.w800)),
          ],
        ),
      );

  Widget _stockRow(String label, String value) => Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(0xFFF0F3F9))),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(color: muted, fontSize: 12)),
            Text(value, style: const TextStyle(color: ink, fontSize: 12, fontWeight: FontWeight.w700)),
          ],
        ),
      );

  Widget _inventoryAddCategory() => Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [ink, navy]),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() => showAddCategory = false),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.12),
                      foregroundColor: Colors.white,
                      fixedSize: const Size(36, 36),
                    ),
                    icon: const Icon(Icons.arrow_back),
                  ),
                  const SizedBox(width: 12),
                  const Text('Add Category', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Category Name *', style: TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        TextField(
                          onChanged: (value) => setState(() => newCategoryName = value),
                          decoration: const InputDecoration(
                            hintText: 'e.g. Beverages',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 18),
                        const Text('Icon / Emoji', style: TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: ['🌾', '🫙', '🍬', '🧈', '🥛', '🌶️', '💊', '🧺', '🪥', '🍞', '🥚', '☕', '📦'].map((emoji) {
                            final selected = newCategoryEmoji == emoji;
                            return ChoiceChip(
                              label: Text(emoji),
                              selected: selected,
                              onSelected: (_) => setState(() => newCategoryEmoji = emoji),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () {
                      if (newCategoryName.trim().isNotEmpty) {
                        setState(() {
                          inventoryCategories.add(newCategoryName.trim());
                          newCategoryName = '';
                          newCategoryEmoji = '📦';
                          showAddCategory = false;
                        });
                      }
                    },
                    style: TextButton.styleFrom(
                      backgroundColor: navy,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Save Category', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _inventoryAddProduct() => Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [ink, navy]),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() {
                      showAddProduct = false;
                      editProduct = null;
                    }),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.12),
                      foregroundColor: Colors.white,
                      fixedSize: const Size(36, 36),
                    ),
                    icon: const Icon(Icons.arrow_back),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    editProduct != null ? 'Edit Product' : 'Add Product',
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Product Icon', style: TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: ['🌾', '🫙', '🍬', '🧈', '🥛', '🌶️', '💊', '🧺', '🪥', '🍞', '🥚', '☕', '📦'].map((emoji) {
                            final selected = (productForm['emoji'] ?? '📦') == emoji;
                            return ChoiceChip(
                              label: Text(emoji, style: const TextStyle(fontSize: 18)),
                              selected: selected,
                              onSelected: (_) => setState(() => productForm['emoji'] = emoji),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Product Details', style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 14),
                        _textFieldLabel('Product Name *', value: productForm['name'] ?? '', onChanged: (value) => setState(() => productForm['name'] = value)),
                        const SizedBox(height: 14),
                        const Text('Category *', style: TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        DropdownButtonFormField<String>(
                          initialValue: productForm['category'] ?? inventoryCategories.first,
                          items: inventoryCategories.map((categoryName) => DropdownMenuItem(value: categoryName, child: Text(categoryName))).toList(),
                          onChanged: (value) => setState(() => productForm['category'] = value ?? inventoryCategories.first),
                          decoration: const InputDecoration(border: OutlineInputBorder()),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Pricing & Stock', style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 14),
                        GridView.count(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 2.3,
                          children: [
                            _numberField('Cost Price (KSh) *', productForm['cost'] ?? '', (value) => setState(() => productForm['cost'] = value)),
                            _numberField('Selling Price (KSh) *', productForm['price'] ?? '', (value) => setState(() => productForm['price'] = value)),
                            _numberField('Current Stock *', productForm['stock'] ?? '', (value) => setState(() => productForm['stock'] = value)),
                            _numberField('Reorder Level', productForm['reorder'] ?? '', (value) => setState(() => productForm['reorder'] = value)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: _saveProduct,
                    style: TextButton.styleFrom(
                      backgroundColor: navy,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: Text(editProduct != null ? 'Save Changes' : 'Add Product', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _textFieldLabel(String label, {required String value, required ValueChanged<String> onChanged}) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: TextEditingController(text: value)..selection = TextSelection.collapsed(offset: value.length),
            onChanged: onChanged,
            decoration: const InputDecoration(border: OutlineInputBorder()),
          ),
        ],
      );

  Widget _numberField(String label, String value, ValueChanged<String> onChanged) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: muted, fontSize: 11, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            keyboardType: TextInputType.number,
            controller: TextEditingController(text: value)..selection = TextSelection.collapsed(offset: value.length),
            onChanged: onChanged,
            decoration: const InputDecoration(border: OutlineInputBorder()),
          ),
        ],
      );

  Widget _productDetails(Product product) => ListView(padding: const EdgeInsets.fromLTRB(16, 28, 16, 24), children: [
        Row(children: [IconButton(onPressed: () => setState(() => selected = null), icon: const Icon(Icons.arrow_back)), const Text('Product Details', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold))]),
        Card(color: navy, child: ListTile(leading: Text(product.emoji, style: const TextStyle(fontSize: 36)), title: Text(product.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)), subtitle: Text(product.category, style: const TextStyle(color: Colors.white70)))),
        const SizedBox(height: 12),
        Row(children: [_infoCard('Cost Price', 'KSh ${product.cost}', Colors.red), _infoCard('Selling Price', 'KSh ${product.price}', navy)]),
        Row(children: [_infoCard('Stock', '${product.stock} units', product.stock <= 5 ? Colors.red : Colors.green), _infoCard('Reorder', '${product.reorder} units', gold)]),
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

class CustomerEntry {
  const CustomerEntry({
    required this.initials,
    required this.name,
    required this.phone,
    required this.credit,
    required this.purchases,
    required this.lastVisit,
    required this.color,
  });

  final String initials;
  final String name;
  final String phone;
  final int credit;
  final int purchases;
  final String lastVisit;
  final Color color;
}

class CustomerTransaction {
  const CustomerTransaction({
    required this.date,
    required this.type,
    required this.amount,
    required this.method,
    required this.items,
  });

  final String date;
  final String type;
  final int amount;
  final String method;
  final int items;
}

class CustomerScreen extends StatefulWidget {
  const CustomerScreen({super.key});

  @override
  State<CustomerScreen> createState() => _CustomerScreenState();
}

class _CustomerScreenState extends State<CustomerScreen> {
  String search = '';
  String tab = 'all';
  String? selected;

  static const List<CustomerEntry> _customers = [
    CustomerEntry(initials: 'JM', name: 'Jane Mwangi', phone: '0712 345 678', credit: 3400, purchases: 28, lastVisit: '2h ago', color: Color(0xFF123A8F)),
    CustomerEntry(initials: 'PO', name: 'Peter Otieno', phone: '0723 456 789', credit: 5200, purchases: 45, lastVisit: 'Yesterday', color: Color(0xFF2E7D32)),
    CustomerEntry(initials: 'MW', name: 'Mary Wanjiku', phone: '0734 567 890', credit: 0, purchases: 32, lastVisit: '3 days ago', color: Color(0xFFD32F2F)),
    CustomerEntry(initials: 'JK', name: 'James Kariuki', phone: '0745 678 901', credit: 1800, purchases: 19, lastVisit: '1 week ago', color: Color(0xFFD4AF37)),
    CustomerEntry(initials: 'GA', name: 'Grace Achieng', phone: '0756 789 012', credit: 9600, purchases: 67, lastVisit: 'Today', color: Color(0xFF7B1FA2)),
    CustomerEntry(initials: 'DK', name: 'David Kamau', phone: '0767 890 123', credit: 0, purchases: 14, lastVisit: '2 weeks ago', color: Color(0xFFF57C00)),
    CustomerEntry(initials: 'SN', name: 'Sarah Njeri', phone: '0778 901 234', credit: 2100, purchases: 38, lastVisit: '4 days ago', color: Color(0xFF00796B)),
  ];

  static const List<CustomerTransaction> _transactions = [
    CustomerTransaction(date: 'Today 14:18', type: 'Sale', amount: 3400, method: 'M-Pesa', items: 8),
    CustomerTransaction(date: 'Yesterday', type: 'Credit', amount: 1200, method: 'Credit', items: 4),
    CustomerTransaction(date: '5 Jul', type: 'Payment', amount: -2000, method: 'Cash', items: 0),
    CustomerTransaction(date: '3 Jul', type: 'Sale', amount: 4800, method: 'Cash', items: 12),
  ];

  @override
  Widget build(BuildContext context) {
    final filtered = _customers.where((customer) {
      final matchesSearch = customer.name.toLowerCase().contains(search.toLowerCase());
      final matchesTab = tab == 'all' || (tab == 'credit' && customer.credit > 0);
      return matchesSearch && matchesTab;
    }).toList();

    final totalCredit = _customers.fold<int>(0, (sum, customer) => sum + customer.credit);

    if (selected != null) {
      final customer = _customers.firstWhere((item) => item.name == selected);
      final outstanding = customer.credit > 0;

      return Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [ink, navy]),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      IconButton(
                        onPressed: () => setState(() => selected = null),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.12),
                          foregroundColor: Colors.white,
                          fixedSize: const Size(36, 36),
                        ),
                        icon: const Icon(Icons.arrow_back),
                      ),
                      const SizedBox(width: 12),
                      const Text('Customer Profile', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          color: customer.color,
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(customer.initials, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(customer.name, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                            const SizedBox(height: 3),
                            Text(customer.phone, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                            const SizedBox(height: 3),
                            Text('Last visit: ${customer.lastVisit}', style: const TextStyle(color: Color(0x99FFFFFF), fontSize: 11)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 3,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: 1.35,
                    children: [
                      _detailStatCard('Credit', 'KSh ${customer.credit.toString()}', customer.credit > 0 ? const Color(0xFFD32F2F) : const Color(0xFF2E7D32)),
                      _detailStatCard('Purchases', '${customer.purchases}', navy),
                      _detailStatCard('This Month', 'KSh 9.2K', gold),
                    ],
                  ),
                  const SizedBox(height: 14),
                  if (outstanding)
                    Container(
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF1F1),
                        border: Border.all(color: const Color(0xFFEF9A9A)),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Outstanding Balance', style: TextStyle(color: Color(0xFFB71C1C), fontSize: 13, fontWeight: FontWeight.w700)),
                                const SizedBox(height: 4),
                                Text('KSh ${customer.credit}', style: const TextStyle(color: Color(0xFFD32F2F), fontSize: 24, fontWeight: FontWeight.w900)),
                              ],
                            ),
                          ),
                          TextButton(
                            onPressed: () {},
                            style: TextButton.styleFrom(
                              backgroundColor: const Color(0xFFD32F2F),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            ),
                            child: const Text('Record Payment', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: TextButton(
                          onPressed: () {},
                          style: TextButton.styleFrom(
                            backgroundColor: navy,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: const Text('New Sale', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextButton(
                          onPressed: () {},
                          style: TextButton.styleFrom(
                            backgroundColor: const Color(0xFFE9EEFF),
                            foregroundColor: navy,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: const Text('Statement', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE3EAF8),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Center(child: Text('📞', style: TextStyle(fontSize: 18))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Transaction History', style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 12),
                        ..._transactions.map((transaction) {
                          final isPositive = transaction.amount >= 0;
                          final badgeColor = transaction.amount < 0 ? const Color(0xFFE8F5E9) : transaction.method == 'Credit' ? const Color(0xFFFFEBEE) : const Color(0xFFE3EAF8);
                          final icon = transaction.amount < 0 ? '✅' : transaction.method == 'Credit' ? '📋' : transaction.method == 'M-Pesa' ? '📱' : '💵';
                          return Container(
                            padding: const EdgeInsets.only(bottom: 12),
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: const BoxDecoration(
                              border: Border(bottom: BorderSide(color: Color(0xFFF0F3F9))),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 38,
                                  height: 38,
                                  decoration: BoxDecoration(
                                    color: badgeColor,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Center(child: Text(icon, style: const TextStyle(fontSize: 16))),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${transaction.type}${transaction.items > 0 ? ' · ${transaction.items} items' : ''}',
                                        style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w600),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(transaction.date, style: const TextStyle(color: muted, fontSize: 11)),
                                    ],
                                  ),
                                ),
                                Text(
                                  '${isPositive ? '' : '-'}KSh ${isPositive ? transaction.amount : transaction.amount.abs()}'.replaceAll(RegExp(r'-KSh 0'), 'KSh 0'),
                                  style: TextStyle(
                                    color: isPositive ? ink : const Color(0xFF2E7D32),
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      color: const Color(0xFFF5F7FA),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 52, 16, 16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy]),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Customers', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                    TextButton(
                      onPressed: () {},
                      style: TextButton.styleFrom(
                        backgroundColor: gold,
                        foregroundColor: ink,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      child: const Text('+ Add Customer', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _summaryMetric('Total Customers', '${_customers.length}', Colors.white),
                    const SizedBox(width: 8),
                    _summaryMetric('Total Credit', 'KSh $totalCredit', const Color(0xFFFF6B6B)),
                    const SizedBox(width: 8),
                    _summaryMetric('Credit Accounts', '${_customers.where((customer) => customer.credit > 0).length}', const Color(0xFFFFD93D)),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: TextField(
                    onChanged: (value) => setState(() => search = value),
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Search customers...',
                      hintStyle: const TextStyle(color: Color(0x99FFFFFF)),
                      prefixIcon: const Icon(Icons.search, color: Color(0xCCFFFFFF)),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Container(
            color: Colors.white,
            child: Row(
              children: ['all', 'credit'].map((value) {
                final label = value == 'all' ? 'All Customers' : 'Credit Accounts';
                final selected = tab == value;
                return Expanded(
                  child: InkWell(
                    onTap: () => setState(() => tab = value),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        border: Border(bottom: BorderSide(color: selected ? navy : Colors.transparent, width: 2)),
                      ),
                      child: Text(
                        label,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: selected ? navy : muted,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              children: filtered.map((customer) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: InkWell(
                    onTap: () => setState(() => selected = customer.name),
                    child: Row(
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: customer.color,
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text(customer.initials, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(customer.name, style: const TextStyle(color: ink, fontSize: 14, fontWeight: FontWeight.w800)),
                              const SizedBox(height: 2),
                              Text('${customer.phone} · ${customer.purchases} purchases', style: const TextStyle(color: muted, fontSize: 12)),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: customer.credit > 0
                              ? [
                                  Text('KSh ${customer.credit}', style: const TextStyle(color: Color(0xFFD32F2F), fontSize: 13, fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 2),
                                  const Text('Credit', style: TextStyle(color: Color(0xFFD32F2F), fontSize: 11, fontWeight: FontWeight.w700)),
                                ]
                              : [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE9F7EE),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: const Text('Cleared', style: TextStyle(color: Color(0xFF2E7D32), fontSize: 10, fontWeight: FontWeight.w800)),
                                  ),
                                ],
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryMetric(String label, String value, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            children: [
              Text(label, style: const TextStyle(color: Color(0x99FFFFFF), fontSize: 10)),
              const SizedBox(height: 3),
              Text(value, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w800)),
            ],
          ),
        ),
      );

  Widget _detailStatCard(String label, String value, Color color) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 6, offset: Offset(0, 2))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: muted, fontSize: 11)),
            const SizedBox(height: 6),
            Text(value, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w800)),
          ],
        ),
      );
}

class MoreScreen extends StatelessWidget {
  const MoreScreen({required this.onOpen, required this.onLogout});
  final ValueChanged<String> onOpen;
  final VoidCallback onLogout;

  final List<Map<String, dynamic>> _menuSections = const [
    {
      'section': 'Sales & Finance',
      'items': [
        {'label': 'Sales History', 'icon': '🧾', 'color': Color(0xFF123A8F), 'screen': 'Reports & Analytics'},
        {'label': 'Purchase Orders', 'icon': '📦', 'color': Color(0xFF2E7D32), 'screen': 'Purchase Orders'},
        {'label': 'Suppliers', 'icon': '🏭', 'color': Color(0xFF00796B), 'screen': 'Suppliers'},
        {'label': 'Credit Book', 'icon': '📋', 'color': Color(0xFFD32F2F), 'screen': 'Credit Book'},
        {'label': 'Expense Tracking', 'icon': '💸', 'color': Color(0xFFF57C00), 'screen': 'Expense Tracking'},
      ],
    },
    {
      'section': 'People',
      'items': [
        {'label': 'Employees', 'icon': '👥', 'color': Color(0xFF5E35B1), 'screen': 'Employees'},
        {'label': 'Customer List', 'icon': '🙂', 'color': Color(0xFF0288D1), 'screen': 'customers'},
      ],
    },
    {
      'section': 'System',
      'items': [
        {'label': 'Notifications', 'icon': '🔔', 'color': Color(0xFFE91E63), 'screen': 'Notifications', 'badge': '3'},
        {'label': 'Backup & Cloud Sync', 'icon': '☁️', 'color': Color(0xFF0288D1), 'screen': 'Backup & Cloud Sync'},
        {'label': 'Settings', 'icon': '⚙️', 'color': Color(0xFF546E7A), 'screen': 'Settings'},
        {'label': 'User Profile', 'icon': '👤', 'color': Color(0xFF123A8F), 'screen': 'User Profile'},
      ],
    },
  ];

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(0, 28, 0, 18),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy]),
            ),
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const CircleAvatar(
                      radius: 28,
                      backgroundColor: gold,
                      child: Text('A', style: TextStyle(color: ink, fontWeight: FontWeight.bold, fontSize: 20)),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Admin User', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
                          SizedBox(height: 2),
                          Text('admin@mobiduka.co.ke', style: TextStyle(color: Colors.white60, fontSize: 12)),
                          SizedBox(height: 6),
                          DecoratedBox(
                            decoration: BoxDecoration(
                              color: Color(0x40D4AF37),
                              borderRadius: BorderRadius.all(Radius.circular(999)),
                            ),
                            child: Padding(
                              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              child: Text('Store Manager', style: TextStyle(color: Color(0xFFF4D46A), fontSize: 10, fontWeight: FontWeight.w700)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => onOpen('User Profile'),
                      icon: const Icon(Icons.edit, color: Colors.white),
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: 0.12),
                        fixedSize: const Size(36, 36),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    children: [
                      Expanded(
                        child: Column(
                          children: [
                            Text('Store', style: TextStyle(color: Colors.white60, fontSize: 10)),
                            SizedBox(height: 2),
                            Text('MobiDuka Store', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          children: [
                            Text('Branch', style: TextStyle(color: Colors.white60, fontSize: 10)),
                            SizedBox(height: 2),
                            Text('Nairobi CBD', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          children: [
                            Text('Shift', style: TextStyle(color: Colors.white60, fontSize: 10)),
                            SizedBox(height: 2),
                            Text('Morning', style: TextStyle(color: gold, fontWeight: FontWeight.w700, fontSize: 12)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          ..._menuSections.map((section) => _menuSection(section['section'] as String, section['items'] as List<Map<String, dynamic>>)),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: onLogout,
            icon: const Icon(Icons.logout, color: Color(0xFFD32F2F)),
            label: const Text('Logout', style: TextStyle(color: Color(0xFFD32F2F), fontSize: 15, fontWeight: FontWeight.w700)),
            style: TextButton.styleFrom(
              backgroundColor: const Color(0xFFFFF5F5),
              foregroundColor: const Color(0xFFD32F2F),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: const BorderSide(color: Color(0xFFFFCDD2)),
              ),
            ),
          ),
          const SizedBox(height: 14),
          const Center(
            child: Text(
              'MobiDuka POS v2.4.1\n© 2026 MobiTech Solutions Ltd · Kenya',
              textAlign: TextAlign.center,
              style: TextStyle(color: muted, fontSize: 11, height: 1.5),
            ),
          ),
        ],
      );

  Widget _menuSection(String title, List<Map<String, dynamic>> items) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 10, 4, 6),
            child: Text(
              title.toUpperCase(),
              style: const TextStyle(
                color: muted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1,
              ),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
            ),
            child: Column(
              children: items.asMap().entries.map((entry) {
                final i = entry.key;
                final item = entry.value;
                final badge = item['badge'];
                return Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => onOpen(item['screen'] as String),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: i < items.length - 1 ? const Color(0xFFF0F3F9) : Colors.transparent,
                            width: 1,
                          ),
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: Color.alphaBlend((item['color'] as Color).withValues(alpha: 0.12), Colors.white),
                              borderRadius: BorderRadius.circular(11),
                            ),
                            child: Center(
                              child: Text(item['icon'] as String, style: const TextStyle(fontSize: 18)),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(
                              item['label'] as String,
                              style: const TextStyle(color: ink, fontSize: 14, fontWeight: FontWeight.w600),
                            ),
                          ),
                          if (badge != null)
                            Container(
                              width: 20,
                              height: 20,
                              decoration: const BoxDecoration(
                                color: Color(0xFFD32F2F),
                                shape: BoxShape.circle,
                              ),
                              child: Center(
                                child: Text(
                                  badge as String,
                                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                                ),
                              ),
                            ),
                          if (badge == null)
                            const Icon(Icons.chevron_right, color: Color(0xFFB0BAD3), size: 18),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),
        ],
      );
}

class SettingsDetailScreen extends StatefulWidget {
  const SettingsDetailScreen({required this.onBack, super.key});
  final VoidCallback onBack;

  @override
  State<SettingsDetailScreen> createState() => _SettingsDetailScreenState();
}

class _SettingsDetailScreenState extends State<SettingsDetailScreen> {
  bool receiptPrint = true;
  bool lowStockAlerts = true;
  bool dailyReport = false;
  bool autoBackup = true;
  bool mpesaEnabled = true;

  Widget _toggle(bool value, ValueChanged<bool> onChanged) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 46,
        height: 26,
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          color: value ? navy : const Color(0xFFD0D7E8),
        ),
        child: Align(
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 20,
            height: 20,
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [BoxShadow(color: Color(0x22000000), blurRadius: 2, offset: Offset(0, 1))],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF5F7FA),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 52, 16, 20),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy]),
            ),
            child: Row(
              children: [
                IconButton(
                  onPressed: widget.onBack,
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.12),
                    foregroundColor: Colors.white,
                    fixedSize: const Size(36, 36),
                  ),
                  icon: const Icon(Icons.arrow_back),
                ),
                const SizedBox(width: 12),
                const Text('Settings', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
              children: [
                const Text('Business Information', style: TextStyle(color: muted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: Column(
                    children: [
                      _settingsRow('Business Name', 'MobiDuka Store'),
                      _settingsRow('Location', 'Nairobi CBD, Kenya'),
                      _settingsRow('Phone', '+254 712 345 678'),
                      _settingsRow('Tax PIN', 'A123456789B'),
                      _settingsRow('Currency', 'KES (Kenyan Shilling)', isLast: true),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Preferences', style: TextStyle(color: muted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: Column(
                    children: [
                      _settingsToggleRow('Auto-print Receipt', 'Print receipt after every sale', receiptPrint, (value) => setState(() => receiptPrint = value)),
                      _settingsToggleRow('Low Stock Alerts', 'Notify when stock is below reorder level', lowStockAlerts, (value) => setState(() => lowStockAlerts = value)),
                      _settingsToggleRow('Daily Report Email', 'Send end-of-day report to email', dailyReport, (value) => setState(() => dailyReport = value)),
                      _settingsToggleRow('Auto Cloud Backup', 'Backup data daily at midnight', autoBackup, (value) => setState(() => autoBackup = value)),
                      _settingsToggleRow('M-Pesa Integration', 'Accept M-Pesa payments', mpesaEnabled, (value) => setState(() => mpesaEnabled = value), isLast: true),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Payment Methods', style: TextStyle(color: muted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: Column(
                    children: [
                      _paymentMethodRow('💵', 'Cash', true, '', false),
                      _paymentMethodRow('📱', 'M-Pesa', mpesaEnabled, '2.8% fee', false),
                      _paymentMethodRow('📋', 'Credit / Tab', true, '', false),
                      _paymentMethodRow('🏦', 'Bank Transfer', false, 'Offline', true),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Data Management', style: TextStyle(color: muted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: Column(
                    children: [
                      _actionRow('☁️', 'Backup Now', 'Last backup: Today 06:00 AM', const Color(0xFF0288D1), false),
                      _actionRow('📤', 'Export Data (CSV)', 'Download all transactions', const Color(0xFF2E7D32), false),
                      _actionRow('🗑️', 'Clear Cache', '12.4 MB used', const Color(0xFFF57C00), true),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const Center(
                  child: Text(
                    'MobiDuka POS v2.4.1 · Build 20260708',
                    style: TextStyle(color: Color(0xFFB0BAD3), fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _settingsRow(String label, String value, {bool isLast = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: isLast ? Colors.transparent : const Color(0xFFF0F3F9), width: 1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: muted, fontSize: 13, fontWeight: FontWeight.w600)),
          SizedBox(
            width: 180,
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _settingsToggleRow(String label, String sub, bool value, ValueChanged<bool> onChanged, {bool isLast = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: isLast ? Colors.transparent : const Color(0xFFF0F3F9), width: 1)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(sub, style: const TextStyle(color: muted, fontSize: 11)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          _toggle(value, onChanged),
        ],
      ),
    );
  }

  Widget _paymentMethodRow(String icon, String label, bool enabled, String tag, bool isLast) {
    final badgeColor = enabled ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE);
    final badgeText = enabled ? const Color(0xFF2E7D32) : const Color(0xFFD32F2F);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: isLast ? Colors.transparent : const Color(0xFFF0F3F9), width: 1)),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: const Color(0xFFEEF3FF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(child: Text(icon, style: const TextStyle(fontSize: 18))),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label, style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w700)),
          ),
          if (tag.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: badgeColor, borderRadius: BorderRadius.circular(999)),
              child: Text(tag, style: TextStyle(color: badgeText, fontSize: 10, fontWeight: FontWeight.w700)),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: enabled ? badgeColor : const Color(0xFFFFEBEE), borderRadius: BorderRadius.circular(999)),
              child: Text(enabled ? 'Active' : 'Inactive', style: TextStyle(color: enabled ? badgeText : const Color(0xFFD32F2F), fontSize: 10, fontWeight: FontWeight.w700)),
            ),
        ],
      ),
    );
  }

  Widget _actionRow(String icon, String label, String sub, Color color, bool isLast) {
    return InkWell(
      onTap: () {},
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: isLast ? Colors.transparent : const Color(0xFFF0F3F9), width: 1)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Color.alphaBlend(color.withValues(alpha: 0.12), Colors.white),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Center(child: Text(icon, style: const TextStyle(fontSize: 18))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(sub, style: const TextStyle(color: muted, fontSize: 11)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Color(0xFFB0BAD3), size: 18),
          ],
        ),
      ),
    );
  }
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
        return [PurchaseOrdersScreen(onBack: widget.onBack)];
      case 'Suppliers':
        return [SupplierScreen(onBack: widget.onBack)];
      case 'Credit Book':
        return [CreditBookScreen(onBack: widget.onBack)];
      case 'Expense Tracking':
        return _cards([('Electricity Bill', 'Utilities · M-Pesa · 8 Jul 2026', 'RECURRING', 'KSh 8,500'), ('Staff Salaries', 'Payroll · Bank · 7 Jul 2026', 'RECURRING', 'KSh 75,000'), ('Shop Rent', 'Rent · Bank · 1 Jul 2026', 'RECURRING', 'KSh 35,000'), ('Plastic Bags & Packaging', 'Supplies · Cash · 6 Jul 2026', '', 'KSh 2,300')]);
      case 'Employees':
        return [EmployeeScreen(onBack: widget.onBack)];
      case 'Notifications':
        return [NotificationsScreen(onBack: widget.onBack)];
      case 'Backup & Cloud Sync':
        return [const Card(child: ListTile(leading: Icon(Icons.cloud_done, color: Colors.green), title: Text('Cloud Backup'), subtitle: Text('Last backup: Today, 06:00 AM\nAll data synced'))), FilledButton.icon(onPressed: () {}, icon: const Icon(Icons.cloud_upload), label: const Text('Backup Now')), SwitchListTile(title: const Text('Auto Backup'), subtitle: const Text('Every day at 6:00 AM'), value: autoBackup, onChanged: (value) => setState(() => autoBackup = value)), SwitchListTile(title: const Text('Wi-Fi Only'), value: wifiOnly, onChanged: (value) => setState(() => wifiOnly = value))];
      case 'Settings':
        return [SettingsDetailScreen(onBack: widget.onBack)];
      case 'User Profile':
        return [UserProfileDetailScreen(onBack: widget.onBack)];
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

class UserProfileDetailScreen extends StatefulWidget {
  const UserProfileDetailScreen({required this.onBack, super.key});
  final VoidCallback onBack;

  @override
  State<UserProfileDetailScreen> createState() => _UserProfileDetailScreenState();
}

class _UserProfileDetailScreenState extends State<UserProfileDetailScreen> {
  bool editing = false;
  bool changingPin = false;
  bool saved = false;
  final Map<String, String> form = {
    'name': 'Admin User',
    'phone': '0712 345 678',
    'email': 'admin@mobiduka.co.ke',
    'store': 'MobiDuka Store',
    'branch': 'Nairobi CBD',
  };
  final Map<String, String> pinForm = {
    'current': '',
    'newPin': '',
    'confirm': '',
  };

  void _saveProfile() {
    setState(() {
      saved = true;
      editing = false;
    });
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => saved = false);
    });
  }

  Widget _field(String label, String value, ValueChanged<String> onChanged, {bool isPassword = false}) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          editing
              ? TextField(
                  obscureText: isPassword,
                  controller: TextEditingController(text: value)..selection = TextSelection.collapsed(offset: value.length),
                  onChanged: onChanged,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                )
              : Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: SizedBox(
                    width: double.infinity,
                    child: Text(
                      value,
                      style: const TextStyle(color: ink, fontSize: 14, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
        ],
      );

  Widget _securityRow(String icon, String label, String sub, VoidCallback onTap, {bool last = false}) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: last ? Colors.transparent : const Color(0xFFF0F3F9), width: 1)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFE3EAF8),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Center(child: Text(icon, style: const TextStyle(fontSize: 18))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(sub, style: const TextStyle(color: muted, fontSize: 11)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Color(0xFFB0BAD3), size: 18),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (changingPin) {
      return Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [ink, navy]),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() => changingPin = false),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.12),
                      foregroundColor: Colors.white,
                      fixedSize: const Size(36, 36),
                    ),
                    icon: const Icon(Icons.arrow_back),
                  ),
                  const SizedBox(width: 12),
                  const Text('Change PIN', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      children: [
                        _pinField('Current PIN', 'current'),
                        const SizedBox(height: 20),
                        _pinField('New PIN', 'newPin'),
                        const SizedBox(height: 20),
                        _pinField('Confirm New PIN', 'confirm'),
                        const SizedBox(height: 20),
                        TextButton(
                          onPressed: () => setState(() => changingPin = false),
                          style: TextButton.styleFrom(
                            backgroundColor: navy,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 15),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text('Update PIN', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      color: const Color(0xFFF5F7FA),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 52, 16, 28),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy]),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: widget.onBack,
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: 0.12),
                        foregroundColor: Colors.white,
                        fixedSize: const Size(36, 36),
                      ),
                      icon: const Icon(Icons.arrow_back),
                    ),
                    const SizedBox(width: 12),
                    const Text('User Profile', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                    const Spacer(),
                    TextButton(
                      onPressed: () => setState(() => editing = !editing),
                      style: TextButton.styleFrom(
                        backgroundColor: editing ? gold : Colors.white.withValues(alpha: 0.12),
                        foregroundColor: editing ? ink : Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text(editing ? 'Cancel' : 'Edit', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Center(
                  child: Stack(
                    children: [
                      Container(
                        width: 80,
                        height: 80,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(colors: [gold, Color(0xFFF0D060)]),
                          shape: BoxShape.circle,
                          border: Border.fromBorderSide(BorderSide(color: Color(0x55FFFFFF), width: 3)),
                        ),
                        child: const Center(child: Text('A', style: TextStyle(color: ink, fontSize: 30, fontWeight: FontWeight.w800))),
                      ),
                      if (editing)
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Container(
                            width: 26,
                            height: 26,
                            decoration: const BoxDecoration(
                              color: gold,
                              shape: BoxShape.circle,
                              border: Border.fromBorderSide(BorderSide(color: Colors.white, width: 2)),
                            ),
                            child: const Center(child: Text('✏️', style: TextStyle(fontSize: 12))),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Text(form['name'] ?? 'Admin User', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text('Store Manager', style: TextStyle(color: Color(0xFFD4AF37), fontSize: 11, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
              children: [
                if (saved)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      border: Border.all(color: const Color(0xFFC8E6C9)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: const [
                        Text('✅', style: TextStyle(fontSize: 18)),
                        SizedBox(width: 10),
                        Text('Profile updated successfully', style: TextStyle(color: Color(0xFF2E7D32), fontSize: 13, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                const Text('Personal Information', style: TextStyle(color: muted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: Column(
                    children: [
                      _field('Full Name', form['name'] ?? '', (value) => setState(() => form['name'] = value)),
                      const SizedBox(height: 14),
                      _field('Phone Number', form['phone'] ?? '', (value) => setState(() => form['phone'] = value)),
                      const SizedBox(height: 14),
                      _field('Email Address', form['email'] ?? '', (value) => setState(() => form['email'] = value)),
                      if (editing)
                        Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: TextButton(
                            onPressed: _saveProfile,
                            style: TextButton.styleFrom(
                              backgroundColor: navy,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text('Save Changes', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Store Information', style: TextStyle(color: muted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: Column(
                    children: [
                      _field('Store Name', form['store'] ?? '', (value) => setState(() => form['store'] = value)),
                      const SizedBox(height: 14),
                      _field('Branch', form['branch'] ?? '', (value) => setState(() => form['branch'] = value)),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Security', style: TextStyle(color: muted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: Column(
                    children: [
                      _securityRow('🔐', 'Change PIN', 'Update your 4-digit login PIN', () => setState(() => changingPin = true)),
                      _securityRow('📱', 'Active Sessions', '1 device currently logged in', () {}),
                      _securityRow('🛡️', 'Two-Factor Auth', 'Not enabled', () {}, last: true),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                const Center(
                  child: Column(
                    children: [
                      Text('Member since January 2024', style: TextStyle(color: Color(0xFFB0BAD3), fontSize: 12)),
                      SizedBox(height: 2),
                      Text('MobiDuka POS · Store Manager', style: TextStyle(color: Color(0xFFB0BAD3), fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _pinField(String label, String key) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            keyboardType: TextInputType.number,
            maxLength: 4,
            obscureText: true,
            textAlign: TextAlign.center,
            controller: TextEditingController(text: pinForm[key] ?? '')..selection = TextSelection.collapsed(offset: (pinForm[key] ?? '').length),
            onChanged: (value) => setState(() => pinForm[key] = value),
            style: const TextStyle(fontSize: 28, letterSpacing: 12, fontWeight: FontWeight.w800),
            decoration: const InputDecoration(
              hintText: '••••',
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
          ),
        ],
      );
}

class PurchaseOrdersScreen extends StatefulWidget {
  const PurchaseOrdersScreen({required this.onBack, super.key});
  final VoidCallback onBack;

  @override
  State<PurchaseOrdersScreen> createState() => _PurchaseOrdersScreenState();
}

class _PurchaseOrdersScreenState extends State<PurchaseOrdersScreen> {
  String filter = 'all';
  _PurchaseOrderEntry? selected;
  bool showNew = false;
  final List<_PurchaseOrderEntry> orders = const [
    _PurchaseOrderEntry(id: 'PO-2026-084', supplier: 'Unga Limited', date: '8 Jul 2026', items: 6, total: 48000, status: 'pending', dueDate: '10 Jul 2026'),
    _PurchaseOrderEntry(id: 'PO-2026-083', supplier: 'Bidco Africa', date: '7 Jul 2026', items: 4, total: 32500, status: 'delivered', dueDate: '9 Jul 2026'),
    _PurchaseOrderEntry(id: 'PO-2026-082', supplier: 'Procter & Gamble', date: '5 Jul 2026', items: 8, total: 67200, status: 'partial', dueDate: '7 Jul 2026'),
    _PurchaseOrderEntry(id: 'PO-2026-081', supplier: 'Dawa Limited', date: '3 Jul 2026', items: 12, total: 24800, status: 'delivered', dueDate: '5 Jul 2026'),
    _PurchaseOrderEntry(id: 'PO-2026-080', supplier: 'Brookside Dairy', date: '1 Jul 2026', items: 3, total: 18600, status: 'cancelled', dueDate: '3 Jul 2026'),
  ];

  final List<Map<String, dynamic>> orderItems = const [
    {'name': 'Unga Jogoo 2kg', 'qty': 50, 'unit': 'Bags', 'cost': 160, 'total': 8000},
    {'name': 'Unga Pembe 2kg', 'qty': 40, 'unit': 'Bags', 'cost': 155, 'total': 6200},
    {'name': 'Sembe 2kg', 'qty': 60, 'unit': 'Bags', 'cost': 110, 'total': 6600},
    {'name': 'Unga Dola 1kg', 'qty': 80, 'unit': 'Bags', 'cost': 80, 'total': 6400},
    {'name': 'Maize Meal 2kg', 'qty': 50, 'unit': 'Bags', 'cost': 100, 'total': 5000},
    {'name': 'Rice Pishori 1kg', 'qty': 40, 'unit': 'Packs', 'cost': 190, 'total': 7600},
  ];

  final List<String> suppliers = const ['Unga Limited', 'Bidco Africa', 'Procter & Gamble', 'Dawa Limited', 'Brookside Dairy'];

  final Map<String, String> newForm = {'supplier': '', 'notes': ''};

  List<_PurchaseOrderEntry> get filteredOrders {
    if (filter == 'pending') return orders.where((o) => o.status == 'pending' || o.status == 'partial').toList();
    if (filter == 'delivered') return orders.where((o) => o.status == 'delivered').toList();
    return orders;
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'pending': return const Color(0xFFF9A825);
      case 'delivered': return const Color(0xFF2E7D32);
      case 'partial': return const Color(0xFF0288D1);
      case 'cancelled': return const Color(0xFFD32F2F);
      default: return const Color(0xFF123A8F);
    }
  }

  String _statusLabel(String status) => status[0].toUpperCase() + status.substring(1);

  Widget _statusBadge(String status) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: _statusColor(status).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: _statusColor(status).withValues(alpha: 0.25)),
        ),
        child: Text(
          _statusLabel(status),
          style: TextStyle(color: _statusColor(status), fontSize: 10, fontWeight: FontWeight.w800),
        ),
      );

  Widget _orderCard(_PurchaseOrderEntry order) => InkWell(
        onTap: () => setState(() => selected = order),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
          ),
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(order.id, style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 2),
                        Text(order.supplier, style: const TextStyle(color: muted, fontSize: 12)),
                      ],
                    ),
                  ),
                  _statusBadge(order.status),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('${order.items} items · Due ${order.dueDate}', style: const TextStyle(color: muted, fontSize: 11)),
                  Text('KSh ${order.total.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}', style: const TextStyle(color: navy, fontSize: 14, fontWeight: FontWeight.w800)),
                ],
              ),
              const SizedBox(height: 10),
              Container(
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFF0F3F9),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: order.status == 'delivered'
                      ? 1.0
                      : order.status == 'partial'
                          ? 0.6
                          : 0.1,
                  child: Container(
                    decoration: BoxDecoration(
                      color: _statusColor(order.status),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _topMetric(String value, String label, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
          ),
          child: Column(
            children: [
              Text(value, style: TextStyle(color: color, fontSize: 15, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(label, style: const TextStyle(color: muted, fontSize: 10)),
            ],
          ),
        ),
      );

  Widget _filterButton(String label) {
    final active = filter == label;
    return Expanded(
      child: TextButton(
        onPressed: () => setState(() => filter = label),
        style: TextButton.styleFrom(
          backgroundColor: active ? gold : Colors.white.withValues(alpha: 0.12),
          foregroundColor: active ? ink : Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
        child: Text(label.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: active ? ink : Colors.white)),
      ),
    );
  }

  Widget _newPurchaseOrderView() {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy]),
            ),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => setState(() => showNew = false),
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.12),
                    foregroundColor: Colors.white,
                    fixedSize: const Size(36, 36),
                  ),
                  icon: const Icon(Icons.arrow_back),
                ),
                const SizedBox(width: 12),
                const Text('New Purchase Order', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Order Details', style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        initialValue: newForm['supplier']!.isEmpty ? null : newForm['supplier'],
                        decoration: const InputDecoration(
                          labelText: 'Supplier *',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        ),
                        items: suppliers.map((supplier) => DropdownMenuItem(value: supplier, child: Text(supplier))).toList(),
                        onChanged: (value) => setState(() => newForm['supplier'] = value ?? ''),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        keyboardType: TextInputType.datetime,
                        decoration: const InputDecoration(
                          labelText: 'Expected Delivery Date *',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        minLines: 3,
                        maxLines: 5,
                        decoration: const InputDecoration(
                          labelText: 'Notes',
                          hintText: 'Optional notes...',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        ),
                        onChanged: (value) => setState(() => newForm['notes'] = value),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Order Items', style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                ...orderItems.take(4).map((item) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item['name'] as String, style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w700)),
                                Text('KSh ${item['cost']} / ${item['unit']}', style: const TextStyle(color: muted, fontSize: 11)),
                              ],
                            ),
                          ),
                          SizedBox(
                            width: 62,
                            child: TextField(
                              textAlign: TextAlign.center,
                              keyboardType: TextInputType.number,
                              controller: TextEditingController(text: item['qty'].toString())..selection = TextSelection.collapsed(offset: item['qty'].toString().length),
                              decoration: const InputDecoration(
                                contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          SizedBox(
                            width: 80,
                            child: Text(
                              'KSh ${item['total']}',
                              textAlign: TextAlign.right,
                              style: const TextStyle(color: navy, fontSize: 12, fontWeight: FontWeight.w800),
                            ),
                          ),
                        ],
                      ),
                    )),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF123A8F), width: 1.5, style: BorderStyle.solid),
                  ),
                  child: const Center(
                    child: Text('+ Add Item', style: TextStyle(color: navy, fontSize: 13, fontWeight: FontWeight.w700)),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: Column(
                    children: [
                      _totalsRow('Subtotal', 'KSh 34,200'),
                      _totalsRow('Tax (16% VAT)', 'KSh 5,472'),
                      _totalsRow('Total', 'KSh 39,672', bold: true),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                TextButton(
                  onPressed: () => setState(() => showNew = false),
                  style: TextButton.styleFrom(
                    backgroundColor: navy,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text('Submit Purchase Order', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _totalsRow(String label, String value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: TextStyle(color: bold ? ink : muted, fontSize: bold ? 14 : 13, fontWeight: bold ? FontWeight.w800 : FontWeight.w500)),
            Text(value, style: TextStyle(color: bold ? navy : ink, fontSize: bold ? 14 : 13, fontWeight: bold ? FontWeight.w800 : FontWeight.w700)),
          ],
        ),
      );

  Widget _detailView(_PurchaseOrderEntry order) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy]),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: () => setState(() => selected = null),
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: 0.12),
                        foregroundColor: Colors.white,
                        fixedSize: const Size(36, 36),
                      ),
                      icon: const Icon(Icons.arrow_back),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(order.id, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                          Text(order.supplier, style: const TextStyle(color: Colors.white60, fontSize: 12)),
                        ],
                      ),
                    ),
                    _statusBadge(order.status),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    _headerMetric('Order Date', order.date),
                    const SizedBox(width: 8),
                    _headerMetric('Due Date', order.dueDate),
                    const SizedBox(width: 8),
                    _headerMetric('Items', order.items.toString()),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text('Order Items', style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                ...orderItems.map((item) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item['name'] as String, style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w700)),
                                Text('${item['qty']} ${item['unit']} × KSh ${item['cost']}', style: const TextStyle(color: muted, fontSize: 11)),
                              ],
                            ),
                          ),
                          Text('KSh ${item['total']}', style: const TextStyle(color: navy, fontSize: 13, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    )),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: Column(
                    children: [
                      _totalsRow('Subtotal', 'KSh ${order.total.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}'),
                      _totalsRow('Received', order.status == 'delivered' ? 'KSh ${order.total.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}' : 'KSh 0'),
                      _totalsRow('Balance', order.status == 'delivered' ? 'KSh 0' : 'KSh ${order.total.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}'),
                    ],
                  ),
                ),
                if (order.status == 'pending') ...[
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: TextButton(
                          onPressed: () {},
                          style: TextButton.styleFrom(
                            foregroundColor: navy,
                            backgroundColor: const Color(0x1A123A8F),
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text('Edit Order', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextButton(
                          onPressed: () => setState(() => selected = null),
                          style: TextButton.styleFrom(
                            foregroundColor: Colors.white,
                            backgroundColor: const Color(0xFF2E7D32),
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text('Mark Received', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _headerMetric(String label, String value) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: Colors.white60, fontSize: 9)),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800)),
            ],
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    if (showNew) return _newPurchaseOrderView();
    if (selected != null) return _detailView(selected!);

    return SizedBox(
      height: MediaQuery.of(context).size.height - 150,
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy]),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text('Purchase Orders', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                      ],
                    ),
                    TextButton(
                      onPressed: () => setState(() => showNew = true),
                      style: TextButton.styleFrom(
                        backgroundColor: gold,
                        foregroundColor: ink,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      child: const Text('+ New PO', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _filterButton('all'),
                    const SizedBox(width: 8),
                    _filterButton('pending'),
                    const SizedBox(width: 8),
                    _filterButton('delivered'),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              children: [
                Row(
                  children: [
                    _topMetric('KSh 191K', 'This Month', navy),
                    const SizedBox(width: 8),
                    _topMetric('3', 'Pending', const Color(0xFFF9A825)),
                    const SizedBox(width: 8),
                    _topMetric('2', 'Delivered', const Color(0xFF2E7D32)),
                  ],
                ),
                const SizedBox(height: 12),
                ...filteredOrders.map(_orderCard),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PurchaseOrderEntry {
  const _PurchaseOrderEntry({
    required this.id,
    required this.supplier,
    required this.date,
    required this.items,
    required this.total,
    required this.status,
    required this.dueDate,
  });

  final String id;
  final String supplier;
  final String date;
  final int items;
  final int total;
  final String status;
  final String dueDate;
}

class SupplierEntry {
  const SupplierEntry({
    required this.id,
    required this.name,
    required this.category,
    required this.contact,
    required this.phone,
    required this.email,
    required this.orders,
    required this.outstanding,
    required this.initials,
    required this.color,
    required this.rating,
    required this.terms,
  });

  final int id;
  final String name;
  final String category;
  final String contact;
  final String phone;
  final String email;
  final int orders;
  final int outstanding;
  final String initials;
  final Color color;
  final int rating;
  final String terms;
}

class SupplierScreen extends StatefulWidget {
  const SupplierScreen({required this.onBack, super.key});
  final VoidCallback onBack;

  @override
  State<SupplierScreen> createState() => _SupplierScreenState();
}

class _SupplierScreenState extends State<SupplierScreen> {
  final List<SupplierEntry> _suppliers = const [
    SupplierEntry(id: 1, name: 'Unga Limited', category: 'Flour & Grains', contact: 'James Mwenda', phone: '+254 20 330 0000', email: 'orders@unga.com', orders: 12, outstanding: 48000, initials: 'UL', color: Color(0xFF123A8F), rating: 5, terms: 'Net 30'),
    SupplierEntry(id: 2, name: 'Bidco Africa', category: 'Oils & Fats', contact: 'Sarah Kamau', phone: '+254 51 350 5000', email: 'supply@bidco.co.ke', orders: 8, outstanding: 0, initials: 'BA', color: Color(0xFF2E7D32), rating: 4, terms: 'Net 14'),
    SupplierEntry(id: 3, name: 'Procter & Gamble', category: 'FMCG', contact: 'Peter Otieno', phone: '+254 20 421 0000', email: 'kenya@pg.com', orders: 15, outstanding: 32500, initials: 'PG', color: Color(0xFF0288D1), rating: 5, terms: 'Net 21'),
    SupplierEntry(id: 4, name: 'Dawa Limited', category: 'Pharmaceuticals', contact: 'Dr. Mary Njeri', phone: '+254 20 802 8000', email: 'orders@dawa.co.ke', orders: 6, outstanding: 0, initials: 'DL', color: Color(0xFFD32F2F), rating: 4, terms: 'Prepaid'),
    SupplierEntry(id: 5, name: 'Brookside Dairy', category: 'Dairy Products', contact: 'Alice Wambui', phone: '+254 722 111 000', email: 'trade@brookside.co.ke', orders: 22, outstanding: 12000, initials: 'BD', color: Color(0xFF00796B), rating: 5, terms: 'COD'),
    SupplierEntry(id: 6, name: 'Kapa Oil', category: 'Cooking Oil', contact: 'David Kariuki', phone: '+254 20 534 5600', email: 'sales@kapaoil.co.ke', orders: 5, outstanding: 0, initials: 'KO', color: Color(0xFFF57C00), rating: 3, terms: 'Net 7'),
  ];

  String search = '';
  SupplierEntry? selected;
  bool showAdd = false;
  final Map<String, String> form = {
    'name': '',
    'category': '',
    'contact': '',
    'phone': '',
    'email': '',
    'terms': 'Net 30',
  };

  int get totalOutstanding => _suppliers.fold<int>(0, (sum, supplier) => sum + supplier.outstanding);

  List<SupplierEntry> get filteredSuppliers => _suppliers.where((supplier) {
    final query = search.toLowerCase();
    return supplier.name.toLowerCase().contains(query) || supplier.category.toLowerCase().contains(query);
  }).toList();

  void _resetForm() {
    form
      ..update('name', (_) => '')
      ..update('category', (_) => '')
      ..update('contact', (_) => '')
      ..update('phone', (_) => '')
      ..update('email', (_) => '')
      ..update('terms', (_) => 'Net 30');
  }

  void _saveSupplier() {
    final name = form['name']?.trim() ?? '';
    if (name.isEmpty) return;
    setState(() => showAdd = false);
  }

  @override
  Widget build(BuildContext context) {
    if (showAdd) {
      return Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [ink, navy]),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() => showAdd = false),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.12),
                      foregroundColor: Colors.white,
                      fixedSize: const Size(36, 36),
                    ),
                    icon: const Icon(Icons.arrow_back),
                  ),
                  const SizedBox(width: 12),
                  const Text('Add Supplier', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _formField('Business Name *', 'e.g. Unga Limited', form['name'] ?? '', (value) => setState(() => form['name'] = value)),
                        const SizedBox(height: 14),
                        _formField('Category *', 'e.g. Flour & Grains', form['category'] ?? '', (value) => setState(() => form['category'] = value)),
                        const SizedBox(height: 14),
                        _formField('Contact Person', 'Full name', form['contact'] ?? '', (value) => setState(() => form['contact'] = value)),
                        const SizedBox(height: 14),
                        _formField('Phone Number', '+254 ...', form['phone'] ?? '', (value) => setState(() => form['phone'] = value)),
                        const SizedBox(height: 14),
                        _formField('Email Address', 'supplier@email.com', form['email'] ?? '', (value) => setState(() => form['email'] = value)),
                        const SizedBox(height: 16),
                        const Text('Payment Terms', style: TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFFE8ECF4)),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              isExpanded: true,
                              value: form['terms'] ?? 'Net 30',
                              items: ['COD', 'Prepaid', 'Net 7', 'Net 14', 'Net 21', 'Net 30', 'Net 60'].map((value) {
                                return DropdownMenuItem<String>(value: value, child: Text(value));
                              }).toList(),
                              onChanged: (value) => setState(() => form['terms'] = value ?? 'Net 30'),
                              style: const TextStyle(color: ink, fontSize: 14, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: _saveSupplier,
                    style: TextButton.styleFrom(
                      backgroundColor: navy,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Save Supplier', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (selected != null) {
      final supplier = selected!;
      return Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [ink, navy]),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      IconButton(
                        onPressed: () => setState(() => selected = null),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.12),
                          foregroundColor: Colors.white,
                          fixedSize: const Size(36, 36),
                        ),
                        icon: const Icon(Icons.arrow_back),
                      ),
                      const SizedBox(width: 12),
                      const Text('Supplier Profile', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                      const Spacer(),
                      IconButton(
                        onPressed: () => setState(() => showAdd = true),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.12),
                          foregroundColor: Colors.white,
                          fixedSize: const Size(34, 34),
                        ),
                        icon: const Icon(Icons.edit, size: 17),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          color: supplier.color,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Center(
                          child: Text(supplier.initials, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(supplier.name, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            Text(supplier.category, style: const TextStyle(color: Color(0x99FFFFFF), fontSize: 12)),
                            const SizedBox(height: 6),
                            Row(
                              children: List.generate(5, (index) => Icon(
                                Icons.star,
                                size: 11,
                                color: index < supplier.rating ? gold : const Color(0x40FFFFFF),
                              )),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.9,
                    children: [
                      _statCard('Total Orders', '${supplier.orders}', navy),
                      _statCard('Outstanding', supplier.outstanding > 0 ? 'KSh ${supplier.outstanding.toString()}' : 'Cleared', supplier.outstanding > 0 ? const Color(0xFFD32F2F) : const Color(0xFF2E7D32)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Contact Information', style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 12),
                        _detailRow('Contact Person', supplier.contact),
                        _detailRow('Phone', supplier.phone),
                        _detailRow('Email', supplier.email),
                        _detailRow('Payment Terms', supplier.terms, isLast: true),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: TextButton(
                          onPressed: () {},
                          style: TextButton.styleFrom(
                            backgroundColor: navy,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text('New Order', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE8F5E9),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Center(child: Text('📞', style: TextStyle(fontSize: 20))),
                      ),
                      const SizedBox(width: 10),
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE3EAF8),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Center(child: Text('✉️', style: TextStyle(fontSize: 20))),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      color: const Color(0xFFF5F7FA),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 52, 16, 16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy]),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        IconButton(
                          onPressed: widget.onBack,
                          style: IconButton.styleFrom(
                            foregroundColor: Colors.white,
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(20, 20),
                          ),
                          icon: const Icon(Icons.arrow_back, size: 18),
                        ),
                        const SizedBox(height: 2),
                        const Text('Suppliers', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                      ],
                    ),
                    TextButton(
                      onPressed: () => setState(() {
                        _resetForm();
                        showAdd = true;
                      }),
                      style: TextButton.styleFrom(
                        backgroundColor: gold,
                        foregroundColor: ink,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      child: const Text('+ Add', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _metricCard('Total', '${_suppliers.length}', Colors.white),
                    const SizedBox(width: 8),
                    _metricCard('Outstanding', 'KSh ${(totalOutstanding / 1000).toStringAsFixed(0)}K', const Color(0xFFFF6B6B)),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.search, color: Color(0xCCFFFFFF), size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          onChanged: (value) => setState(() => search = value),
                          style: const TextStyle(color: Colors.white, fontSize: 14),
                          decoration: const InputDecoration(
                            hintText: 'Search suppliers...',
                            hintStyle: TextStyle(color: Color(0xCCFFFFFF)),
                            border: InputBorder.none,
                            isDense: true,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              children: filteredSuppliers.map((supplier) {
                final hasOutstanding = supplier.outstanding > 0;
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: InkWell(
                    onTap: () => setState(() => selected = supplier),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: supplier.color,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Center(
                            child: Text(supplier.initials, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(supplier.name, style: const TextStyle(color: ink, fontSize: 14, fontWeight: FontWeight.w800)),
                              const SizedBox(height: 3),
                              Text('${supplier.category} · ${supplier.terms}', style: const TextStyle(color: muted, fontSize: 11)),
                              const SizedBox(height: 4),
                              Row(
                                children: List.generate(5, (index) => Icon(
                                  Icons.star,
                                  size: 10,
                                  color: index < supplier.rating ? gold : const Color(0xFFE8ECF4),
                                )),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('${supplier.orders} orders', style: const TextStyle(color: muted, fontSize: 10)),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: hasOutstanding ? const Color(0xFFFFEBEE) : const Color(0xFFE8F5E9),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                hasOutstanding ? 'KSh ${(supplier.outstanding / 1000).toStringAsFixed(0)}K' : 'Settled',
                                style: TextStyle(
                                  color: hasOutstanding ? const Color(0xFFD32F2F) : const Color(0xFF2E7D32),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _metricCard(String label, String value, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 10)),
            ],
          ),
        ),
      );

  Widget _formField(String label, String hint, String value, ValueChanged<String> onChanged) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: TextEditingController(text: value)..selection = TextSelection.collapsed(offset: value.length),
            onChanged: onChanged,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(color: Color(0xFFB0BAD3)),
              border: const OutlineInputBorder(),
            ),
          ),
        ],
      );

  Widget _statCard(String label, String value, Color color) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label, style: const TextStyle(color: muted, fontSize: 11)),
            const SizedBox(height: 6),
            Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
          ],
        ),
      );

  Widget _detailRow(String label, String value, {bool isLast = false}) => Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: isLast ? Colors.transparent : const Color(0xFFF0F3F9), width: 1)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(color: muted, fontSize: 12)),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                value,
                textAlign: TextAlign.right,
                style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      );
}

class EmployeeEntry {
  const EmployeeEntry({
    required this.id,
    required this.name,
    required this.role,
    required this.phone,
    required this.email,
    required this.pin,
    required this.shift,
    required this.salary,
    required this.startDate,
    required this.active,
    required this.initials,
    required this.color,
  });

  final int id;
  final String name;
  final String role;
  final String phone;
  final String email;
  final String pin;
  final String shift;
  final int salary;
  final String startDate;
  final bool active;
  final String initials;
  final Color color;
}

class EmployeeScreen extends StatefulWidget {
  const EmployeeScreen({required this.onBack, super.key});
  final VoidCallback onBack;

  @override
  State<EmployeeScreen> createState() => _EmployeeScreenState();
}

class _EmployeeScreenState extends State<EmployeeScreen> {
  final List<EmployeeEntry> _employees = const [
    EmployeeEntry(id: 1, name: 'Admin User', role: 'Store Manager', phone: '0712 345 678', email: 'admin@mobiduka.co.ke', pin: '1234', shift: 'Morning', salary: 55000, startDate: '1 Jan 2024', active: true, initials: 'AU', color: Color(0xFF123A8F)),
    EmployeeEntry(id: 2, name: 'Kevin Ochieng', role: 'Cashier', phone: '0723 456 789', email: 'kevin@mobiduka.co.ke', pin: '2345', shift: 'Morning', salary: 28000, startDate: '15 Mar 2024', active: true, initials: 'KO', color: Color(0xFF2E7D32)),
    EmployeeEntry(id: 3, name: 'Fatuma Hassan', role: 'Stock Keeper', phone: '0734 567 890', email: 'fatuma@mobiduka.co.ke', pin: '3456', shift: 'Afternoon', salary: 30000, startDate: '1 Jun 2024', active: true, initials: 'FH', color: Color(0xFF00796B)),
    EmployeeEntry(id: 4, name: 'Brian Mutua', role: 'Cashier', phone: '0745 678 901', email: 'brian@mobiduka.co.ke', pin: '4567', shift: 'Evening', salary: 26000, startDate: '20 Aug 2024', active: false, initials: 'BM', color: Color(0xFFF57C00)),
    EmployeeEntry(id: 5, name: 'Linda Auma', role: 'Supervisor', phone: '0756 789 012', email: 'linda@mobiduka.co.ke', pin: '5678', shift: 'Morning', salary: 38000, startDate: '10 Feb 2025', active: true, initials: 'LA', color: Color(0xFF7B1FA2)),
  ];

  final Map<String, Color> _roleColors = const {
    'Store Manager': Color(0xFF123A8F),
    'Cashier': Color(0xFF2E7D32),
    'Stock Keeper': Color(0xFF00796B),
    'Supervisor': Color(0xFF7B1FA2),
    'Accountant': Color(0xFFD4AF37),
  };

  final Map<String, List<String>> _rolePermissions = const {
    'Store Manager': ['Full Access', 'Edit Settings', 'Manage Staff', 'View Reports', 'Process Sales', 'Manage Inventory', 'Add Expenses'],
    'Supervisor': ['View Reports', 'Process Sales', 'Manage Inventory', 'Override Discount', 'View Expenses'],
    'Cashier': ['Process Sales', 'View Products', 'View Customers'],
    'Stock Keeper': ['Manage Inventory', 'View Products', 'Create Purchase Orders'],
    'Accountant': ['View Reports', 'View Expenses', 'Export Data', 'Manage Credit'],
  };

  bool _showForm = false;
  EmployeeEntry? _editing;
  EmployeeEntry? _selected;
  final Map<String, dynamic> _form = {
    'name': '',
    'role': 'Cashier',
    'phone': '',
    'email': '',
    'pin': '',
    'shift': 'Morning',
    'salary': '',
  };

  void _openAdd() {
    setState(() {
      _editing = null;
      _selected = null;
      _showForm = true;
      _form['name'] = '';
      _form['role'] = 'Cashier';
      _form['phone'] = '';
      _form['email'] = '';
      _form['pin'] = '';
      _form['shift'] = 'Morning';
      _form['salary'] = '';
    });
  }

  void _openEdit(EmployeeEntry employee) {
    setState(() {
      _editing = employee;
      _showForm = true;
      _selected = null;
      _form['name'] = employee.name;
      _form['role'] = employee.role;
      _form['phone'] = employee.phone;
      _form['email'] = employee.email;
      _form['pin'] = employee.pin;
      _form['shift'] = employee.shift;
      _form['salary'] = employee.salary.toString();
    });
  }

  void _saveForm() {
    final name = (_form['name'] as String).trim();
    if (name.isEmpty) return;

    setState(() {
      _showForm = false;
      _selected = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_showForm) {
      final isEdit = _editing != null;
      final role = _form['role'] as String;
      return Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [ink, navy]),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => setState(() => _showForm = false),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.12),
                      foregroundColor: Colors.white,
                      fixedSize: const Size(36, 36),
                    ),
                    icon: const Icon(Icons.arrow_back),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    isEdit ? 'Edit Employee' : 'Add Employee',
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Personal Information', style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 14),
                        _fieldLabel('Full Name *', value: _form['name'], onChanged: (value) => setState(() => _form['name'] = value)),
                        const SizedBox(height: 14),
                        _fieldLabel('Phone Number *', value: _form['phone'], onChanged: (value) => setState(() => _form['phone'] = value)),
                        const SizedBox(height: 14),
                        _fieldLabel('Email Address', value: _form['email'], onChanged: (value) => setState(() => _form['email'] = value)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Role & Access', style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 14),
                        const Text('Role *', style: TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: ['Store Manager', 'Supervisor', 'Cashier', 'Stock Keeper', 'Accountant'].map((option) {
                            final selected = role == option;
                            return ChoiceChip(
                              label: Text(option),
                              selected: selected,
                              onSelected: (_) => setState(() => _form['role'] = option),
                              selectedColor: _roleColors[option],
                              labelStyle: TextStyle(color: selected ? Colors.white : muted, fontWeight: FontWeight.w700),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: const BoxDecoration(
                            color: Color(0xFFF0F3F9),
                            borderRadius: BorderRadius.all(Radius.circular(10)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('PERMISSIONS FOR ${role.toUpperCase()}', style: const TextStyle(color: muted, fontSize: 11, fontWeight: FontWeight.w800)),
                              const SizedBox(height: 8),
                              ...(_rolePermissions[role] ?? const ['Full Access']).map((permission) => Padding(
                                    padding: const EdgeInsets.only(bottom: 4),
                                    child: Row(
                                      children: [
                                        Container(width: 5, height: 5, decoration: BoxDecoration(color: _roleColors[role], shape: BoxShape.circle)),
                                        const SizedBox(width: 8),
                                        Text(permission, style: const TextStyle(color: ink, fontSize: 11)),
                                      ],
                                    ),
                                  )),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Work Details', style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 14),
                        const Text('Shift', style: TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Row(
                          children: ['Morning', 'Afternoon', 'Evening'].map((option) {
                            final selected = (_form['shift'] as String) == option;
                            return Expanded(
                              child: Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ChoiceChip(
                                  label: Text(option),
                                  selected: selected,
                                  onSelected: (_) => setState(() => _form['shift'] = option),
                                  selectedColor: navy,
                                  labelStyle: TextStyle(color: selected ? Colors.white : muted, fontWeight: FontWeight.w700),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 14),
                        _fieldLabel('Monthly Salary (KSh)', value: _form['salary'], keyboardType: TextInputType.number, onChanged: (value) => setState(() => _form['salary'] = value)),
                        const SizedBox(height: 14),
                        _fieldLabel('PIN (4 digits) *', value: _form['pin'], keyboardType: TextInputType.number, onChanged: (value) => setState(() => _form['pin'] = value), maxLength: 4),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: _saveForm,
                    style: TextButton.styleFrom(
                      backgroundColor: navy,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: Text(isEdit ? 'Save Changes' : 'Add Employee', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (_selected != null) {
      final employee = _employees.firstWhere((item) => item.id == _selected!.id);
      return Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [ink, navy]),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      IconButton(
                        onPressed: () => setState(() => _selected = null),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.12),
                          foregroundColor: Colors.white,
                          fixedSize: const Size(36, 36),
                        ),
                        icon: const Icon(Icons.arrow_back),
                      ),
                      const SizedBox(width: 12),
                      const Text('Employee Profile', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          color: employee.color,
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(employee.initials, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(employee.name, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: _roleColors[employee.role],
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(employee.role, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: employee.active ? const Color(0xFF2E7D32) : const Color(0xFFD32F2F),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(employee.active ? 'Active' : 'Inactive', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      children: [
                        _profileRow('Phone', employee.phone),
                        _profileRow('Email', employee.email),
                        _profileRow('Shift', employee.shift),
                        _profileRow('Monthly Salary', 'KSh ${employee.salary.toString()}'),
                        _profileRow('Start Date', employee.startDate),
                        _profileRow('PIN', '••••'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Permissions', style: TextStyle(color: ink, fontSize: 12, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 6,
                          runSpacing: 8,
                          children: (_rolePermissions[employee.role] ?? const ['View Products']).map((permission) => Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE9EEFF),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(permission, style: const TextStyle(color: navy, fontSize: 10, fontWeight: FontWeight.w700)),
                              )).toList(),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: TextButton(
                          onPressed: () => _openEdit(employee),
                          style: TextButton.styleFrom(
                            backgroundColor: navy,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text('Edit Details', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextButton(
                          onPressed: () => setState(() => _selected = null),
                          style: TextButton.styleFrom(
                            backgroundColor: employee.active ? const Color(0xFFFFF5F5) : const Color(0xFFE8F5E9),
                            foregroundColor: employee.active ? const Color(0xFFD32F2F) : const Color(0xFF2E7D32),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                              side: BorderSide(color: employee.active ? const Color(0xFFFFCDD2) : const Color(0xFFC8E6C9)),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(employee.active ? 'Deactivate' : 'Activate', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      color: const Color(0xFFF5F7FA),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 52, 16, 16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy]),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        IconButton(
                          onPressed: widget.onBack,
                          style: IconButton.styleFrom(
                            foregroundColor: Colors.white,
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(20, 20),
                          ),
                          icon: const Icon(Icons.arrow_back, size: 18),
                        ),
                        const SizedBox(height: 2),
                        const Text('Employees', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                      ],
                    ),
                    TextButton(
                      onPressed: _openAdd,
                      style: TextButton.styleFrom(
                        backgroundColor: gold,
                        foregroundColor: ink,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      child: const Text('+ Add', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _summaryMetric('Total', '${_employees.length}', Colors.white),
                    const SizedBox(width: 8),
                    _summaryMetric('Active', '${_employees.where((employee) => employee.active).length}', const Color(0xFF4CAF50)),
                    const SizedBox(width: 8),
                    _summaryMetric('Inactive', '${_employees.where((employee) => !employee.active).length}', const Color(0xFFFF6B6B)),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              children: _employees.map((employee) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: InkWell(
                    onTap: () => setState(() => _selected = employee),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: employee.color,
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text(employee.initials, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(employee.name, style: const TextStyle(color: ink, fontSize: 14, fontWeight: FontWeight.w800)),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: Color.alphaBlend(_roleColors[employee.role]!.withValues(alpha: 0.12), Colors.white),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(employee.role, style: TextStyle(color: _roleColors[employee.role], fontSize: 10, fontWeight: FontWeight.w800)),
                                  ),
                                  const SizedBox(width: 8),
                                  Text('${employee.shift} shift', style: const TextStyle(color: muted, fontSize: 10)),
                                ],
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('KSh ${(employee.salary / 1000).toStringAsFixed(0)}K', style: const TextStyle(color: ink, fontSize: 12, fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            Text(employee.active ? '● Active' : '● Inactive', style: TextStyle(color: employee.active ? const Color(0xFF2E7D32) : const Color(0xFFD32F2F), fontSize: 10, fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryMetric(String label, String value, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            children: [
              Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 3),
              Text(label, style: const TextStyle(color: Color(0x99FFFFFF), fontSize: 10)),
            ],
          ),
        ),
      );

  Widget _fieldLabel(
    String label, {
    required String value,
    required ValueChanged<String> onChanged,
    TextInputType keyboardType = TextInputType.text,
    int maxLength = 999,
  }) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            keyboardType: keyboardType,
            maxLength: maxLength,
            controller: TextEditingController(text: value)..selection = TextSelection.collapsed(offset: value.length),
            onChanged: onChanged,
            decoration: const InputDecoration(border: OutlineInputBorder()),
          ),
        ],
      );

  Widget _profileRow(String label, String value) => Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(0xFFF0F3F9))),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: muted, fontSize: 12)),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                value,
                textAlign: TextAlign.right,
                style: const TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      );
}

class NotificationEntry {
  const NotificationEntry({
    required this.type,
    required this.title,
    required this.body,
    required this.time,
    required this.date,
    required this.read,
    required this.icon,
  });

  final String type;
  final String title;
  final String body;
  final String time;
  final String date;
  final bool read;
  final String icon;
}

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({required this.onBack});
  final VoidCallback onBack;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final List<NotificationEntry> _items = const [
    NotificationEntry(
      type: 'critical',
      title: 'Critical Stock Alert',
      body: 'Panadol 500mg has only 3 units remaining. Reorder level is 50 units.',
      time: '14:30',
      date: 'Today',
      read: false,
      icon: '🔴',
    ),
    NotificationEntry(
      type: 'warning',
      title: 'Low Stock Warning',
      body: 'Royco 75g is running low (5 units). Consider placing a purchase order.',
      time: '13:55',
      date: 'Today',
      read: false,
      icon: '⚠️',
    ),
    NotificationEntry(
      type: 'success',
      title: 'Daily Sales Target Achieved',
      body: "Congratulations! Today's sales of KSh 84,250 exceeded the daily target of KSh 70,000.",
      time: '13:00',
      date: 'Today',
      read: false,
      icon: '🎯',
    ),
    NotificationEntry(
      type: 'info',
      title: 'New Purchase Order Received',
      body: 'PO-2026-083 from Bidco Africa has been marked as delivered. 4 items received.',
      time: '11:20',
      date: 'Today',
      read: true,
      icon: '📦',
    ),
    NotificationEntry(
      type: 'warning',
      title: 'Credit Account Overdue',
      body: "Grace Achieng's credit balance of KSh 9,600 is overdue by 5 days.",
      time: '09:00',
      date: 'Today',
      read: true,
      icon: '💳',
    ),
    NotificationEntry(
      type: 'info',
      title: 'Backup Completed',
      body: 'Your data has been successfully backed up to the cloud. All records are safe.',
      time: '06:00',
      date: 'Today',
      read: true,
      icon: '☁️',
    ),
    NotificationEntry(
      type: 'success',
      title: 'New Customer Registered',
      body: 'Grace Achieng has been added as a new customer to your database.',
      time: '15:30',
      date: 'Yesterday',
      read: true,
      icon: '👤',
    ),
    NotificationEntry(
      type: 'info',
      title: 'Monthly Report Available',
      body: 'Your June 2026 monthly sales and profit report is ready to view.',
      time: '07:00',
      date: 'Yesterday',
      read: true,
      icon: '📊',
    ),
    NotificationEntry(
      type: 'warning',
      title: 'Low Cash in Till',
      body: 'Cash in till is below KSh 20,000. Consider topping up or depositing excess.',
      time: '16:00',
      date: 'Earlier',
      read: true,
      icon: '💵',
    ),
    NotificationEntry(
      type: 'critical',
      title: 'Expired Product Alert',
      body: 'Dawa Product Batch #DW2209 is approaching expiry in 7 days. Check pharmacy stock.',
      time: '10:00',
      date: 'Earlier',
      read: true,
      icon: '💊',
    ),
  ];

  String _filter = 'all';

  int get unreadCount => _items.where((item) => !item.read).length;

  bool _isVisible(NotificationEntry item) => _filter == 'all' || !item.read;

  List<NotificationEntry> _sectionItems(String date) => _items.where((item) => item.date == date && _isVisible(item)).toList();

  void _markAllRead() {
    setState(() {
      for (var i = 0; i < _items.length; i++) {
        _items[i] = NotificationEntry(
          type: _items[i].type,
          title: _items[i].title,
          body: _items[i].body,
          time: _items[i].time,
          date: _items[i].date,
          read: true,
          icon: _items[i].icon,
        );
      }
    });
  }

  void _markRead(String title) {
    setState(() {
      for (var i = 0; i < _items.length; i++) {
        if (_items[i].title == title) {
          _items[i] = NotificationEntry(
            type: _items[i].type,
            title: _items[i].title,
            body: _items[i].body,
            time: _items[i].time,
            date: _items[i].date,
            read: true,
            icon: _items[i].icon,
          );
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final today = _sectionItems('Today');
    final yesterday = _sectionItems('Yesterday');
    final earlier = _sectionItems('Earlier');

    return SizedBox(
      height: 760,
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [ink, navy],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    TextButton.icon(
                      onPressed: widget.onBack,
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 14, color: Colors.white70),
                      label: const Text('Back', style: TextStyle(color: Colors.white70, fontSize: 12)),
                      style: TextButton.styleFrom(padding: EdgeInsets.zero),
                    ),
                    if (unreadCount > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFD32F2F),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          '$unreadCount new',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Notifications',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _filterChip('All', 'all'),
                    const SizedBox(width: 8),
                    _filterChip('Unread', 'unread'),
                    const Spacer(),
                    if (unreadCount > 0)
                      TextButton(
                        onPressed: _markAllRead,
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.white70,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        ),
                        child: const Text('Mark all read', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                      ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 18),
              children: [
                if (today.isNotEmpty) _section('Today', today),
                if (yesterday.isNotEmpty) _section('Yesterday', yesterday),
                if (earlier.isNotEmpty) _section('Earlier', earlier),
                if (today.isEmpty && yesterday.isEmpty && earlier.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 48),
                    child: Center(
                      child: Text(
                        'No notifications',
                        style: TextStyle(color: muted, fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                const Padding(
                  padding: EdgeInsets.only(top: 18),
                  child: Center(
                    child: Text(
                      'MobiDuka POS · Interactive Prototype\n25+ screens · Android UI · Material Design 3',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: muted,
                        fontSize: 11,
                        height: 1.5,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, String value) {
    final selected = _filter == value;
    return GestureDetector(
      onTap: () => setState(() => _filter = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? gold : Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(100),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? ink : Colors.white.withValues(alpha: 0.82),
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _section(String title, List<NotificationEntry> items) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              title,
              style: const TextStyle(
                color: muted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
              ),
            ),
          ),
          ...items.map((item) => _notificationRow(item)).toList(),
        ],
      ),
    );
  }

  Widget _notificationRow(NotificationEntry item) {
    final palette = {
      'critical': {'bg': const Color(0xFFFFF5F5), 'border': const Color(0xFFFFCDD2), 'dot': const Color(0xFFD32F2F)},
      'warning': {'bg': const Color(0xFFFFF8E1), 'border': const Color(0xFFFFE082), 'dot': const Color(0xFFF9A825)},
      'success': {'bg': const Color(0xFFF1F8E9), 'border': const Color(0xFFC5E1A5), 'dot': const Color(0xFF2E7D32)},
      'info': {'bg': const Color(0xFFE3F2FD), 'border': const Color(0xFF90CAF9), 'dot': const Color(0xFF0288D1)},
    }[item.type]!;

    return GestureDetector(
      onTap: () => _markRead(item.title),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: item.read ? Colors.white : palette['bg'] as Color,
          borderRadius: BorderRadius.circular(14),
          border: Border(left: BorderSide(color: item.read ? Colors.transparent : palette['dot'] as Color, width: 3)),
          boxShadow: item.read
              ? const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))]
              : [
                  BoxShadow(
                    color: (palette['border'] as Color).withValues(alpha: 0.45),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              margin: const EdgeInsets.only(right: 12),
              decoration: BoxDecoration(
                color: item.read ? const Color(0xFFF5F7FA) : palette['bg'] as Color,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(item.icon, style: const TextStyle(fontSize: 18)),
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: item.read ? FontWeight.w600 : FontWeight.w700,
                            color: ink,
                          ),
                        ),
                      ),
                      if (!item.read)
                        Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(top: 4, left: 8),
                          decoration: BoxDecoration(
                            color: palette['dot'] as Color,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.body,
                    style: const TextStyle(fontSize: 12, color: muted, height: 1.5),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.time,
                    style: const TextStyle(fontSize: 11, color: Color(0xFFB0BAD3)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CreditBookScreen extends StatelessWidget {
  const CreditBookScreen({required this.onBack});
  final VoidCallback onBack;

  final List<_CreditAccount> _accounts = const [
    _CreditAccount(
      customer: 'Peter Otieno',
      phone: '0723 456 789',
      balance: 5200,
      lastTx: '8 Jul 2026',
      txCount: 4,
      initials: 'PO',
      color: Color(0xFF2E7D32),
      daysOld: 1,
    ),
    _CreditAccount(
      customer: 'Grace Achieng',
      phone: '0756 789 012',
      balance: 9600,
      lastTx: '8 Jul 2026',
      txCount: 7,
      initials: 'GA',
      color: Color(0xFF7B1FA2),
      daysOld: 0,
    ),
    _CreditAccount(
      customer: 'Jane Mwangi',
      phone: '0712 345 678',
      balance: 3400,
      lastTx: '7 Jul 2026',
      txCount: 2,
      initials: 'JM',
      color: Color(0xFF123A8F),
      daysOld: 1,
    ),
    _CreditAccount(
      customer: 'James Kariuki',
      phone: '0745 678 901',
      balance: 1800,
      lastTx: '5 Jul 2026',
      txCount: 1,
      initials: 'JK',
      color: Color(0xFFD4AF37),
      daysOld: 3,
    ),
    _CreditAccount(
      customer: 'Sarah Njeri',
      phone: '0778 901 234',
      balance: 2100,
      lastTx: '4 Jul 2026',
      txCount: 3,
      initials: 'SN',
      color: Color(0xFF00796B),
      daysOld: 4,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final total = _accounts.fold<int>(0, (sum, item) => sum + item.balance);

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(16, 28, 16, 20),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [ink, navy],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: onBack,
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Colors.white70),
                    splashRadius: 20,
                    padding: EdgeInsets.zero,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Credit Book',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.08),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Total Outstanding Credit',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'KSh ${total.toString()}',
                      style: const TextStyle(
                        color: Color(0xFFFF6B6B),
                        fontSize: 30,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${_accounts.length} active credit accounts',
                      style: const TextStyle(
                        color: Colors.white54,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
          child: Column(
            children: _accounts.map((account) {
              return Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x0F000000),
                      blurRadius: 8,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: account.color,
                        borderRadius: BorderRadius.circular(23),
                      ),
                      child: Center(
                        child: Text(
                          account.initials,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            account.customer,
                            style: const TextStyle(
                              color: ink,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${account.phone} · ${account.txCount} transactions',
                            style: const TextStyle(
                              color: muted,
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            account.daysOld == 0
                                ? 'Added today'
                                : '${account.daysOld}d outstanding',
                            style: TextStyle(
                              color: account.daysOld > 3 ? const Color(0xFFD32F2F) : const Color(0xFFF9A825),
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'KSh ${account.balance.toString()}',
                          style: const TextStyle(
                            color: Color(0xFFD32F2F),
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Last: ${account.lastTx}',
                          style: const TextStyle(
                            color: muted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}

class _CreditAccount {
  const _CreditAccount({
    required this.customer,
    required this.phone,
    required this.balance,
    required this.lastTx,
    required this.txCount,
    required this.initials,
    required this.color,
    required this.daysOld,
  });

  final String customer;
  final String phone;
  final int balance;
  final String lastTx;
  final int txCount;
  final String initials;
  final Color color;
  final int daysOld;
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
  final List<String> days = const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  final List<String> monthLabels = const ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final List<Map<String, dynamic>> categoryData = const [
    {'name': 'Flour & Grains', 'value': 28, 'color': Color(0xFF123A8F)},
    {'name': 'Dairy', 'value': 22, 'color': Color(0xFFD4AF37)},
    {'name': 'Oils & Fats', 'value': 18, 'color': Color(0xFF2E7D32)},
    {'name': 'Pharma', 'value': 15, 'color': Color(0xFFD32F2F)},
    {'name': 'Others', 'value': 17, 'color': Color(0xFF6B7A99)},
  ];

  @override
  Widget build(BuildContext context) {
    final weekSales = week.reduce((a, b) => a + b);
    final weekProfit = profit.reduce((a, b) => a + b);
    final avgMargin = weekSales > 0 ? (weekProfit / weekSales) * 100 : 0.0;

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(12, 28, 12, 18),
          decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [ink, navy]),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: widget.onBack,
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.12),
                      foregroundColor: Colors.white,
                      fixedSize: const Size(36, 36),
                    ),
                    icon: const Icon(Icons.arrow_back),
                  ),
                  const Expanded(
                    child: Text(
                      'Reports & Analytics',
                      style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0x334CAF50),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: const Color(0x664CAF50)),
                    ),
                    child: const Row(
                      children: [
                        CircleAvatar(radius: 4, backgroundColor: Color(0xFF4CAF50)),
                        SizedBox(width: 6),
                        Text('LIVE', style: TextStyle(color: Color(0xFF81C784), fontSize: 10, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                ],
              ),
              const Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: Text('Week of Sep 2026 · Up to Thu', style: TextStyle(color: Colors.white60, fontSize: 12)),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  _metricCard("Today's Sales", 'KSh ${(week[3] / 1000).round()}K', 'Thu'),
                  _metricCard('Week Sales', 'KSh ${(weekSales / 1000).round()}K', 'Mon – Thu'),
                  _metricCard('Avg Margin', '${avgMargin.toStringAsFixed(1)}%', 'This week'),
                ],
              ),
            ],
          ),
        ),
        Container(
          height: 52,
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFE8ECF4))),
          ),
          child: Row(
            children: [
              _tabButton('Daily', 0),
              _tabButton('Monthly', 1),
              _tabButton('Profit', 2),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (tab == 0) _daily(),
              if (tab == 1) _monthly(),
              if (tab == 2) _profit(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _tabButton(String label, int index) {
    final selected = tab == index;
    return Expanded(
      child: TextButton(
        onPressed: () => setState(() => tab = index),
        style: TextButton.styleFrom(
          foregroundColor: selected ? navy : const Color(0xFF6B7A99),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.zero),
          backgroundColor: Colors.transparent,
          padding: const EdgeInsets.symmetric(vertical: 12),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            color: selected ? navy : const Color(0xFF6B7A99),
          ),
        ),
      ),
    );
  }

  Widget _metricCard(String label, String value, String sub) => Expanded(
        child: Container(
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: Colors.white60, fontSize: 9, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(value, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(sub, style: const TextStyle(color: Colors.white54, fontSize: 9)),
            ],
          ),
        ),
      );

  Widget _daily() => Column(
        children: [
          Section(
            title: 'Sales & Profit — This Week',
            child: Column(
              children: [
                SizedBox(
                  height: 170,
                  child: LineChart(
                    LineChartData(
                      minY: 0,
                      maxY: 140000,
                      gridData: const FlGridData(show: true, drawVerticalLine: false),
                      titlesData: FlTitlesData(
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: true, reservedSize: 46, getTitlesWidget: (value, meta) => Text('${(value / 1000).round()}K', style: const TextStyle(color: Color(0xFF6B7A99), fontSize: 10))),
                        ),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: true, reservedSize: 22, getTitlesWidget: (value, meta) {
                            final index = value.toInt();
                            if (index < 0 || index >= days.length) return const Text('');
                            final label = days[index];
                            return Text(label, style: const TextStyle(color: Color(0xFF6B7A99), fontSize: 10));
                          }),
                        ),
                        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      ),
                      borderData: FlBorderData(show: false),
                      lineBarsData: [
                        _line(week, navy),
                        _line(profit, gold),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _legend(navy, 'Sales'),
                    const SizedBox(width: 18),
                    _legend(gold, 'Profit'),
                    const SizedBox(width: 18),
                    _legend(const Color(0xFFD4AF37), 'Today', dash: true),
                  ],
                ),
              ],
            ),
          ),
          _dailyBreakdown(),
          _categorySection(),
        ],
      );

  Widget _legend(Color color, String label, {bool dash = false}) => Row(
        children: [
          Container(width: 14, height: 3, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(color: Color(0xFF6B7A99), fontSize: 11)),
        ],
      );

  LineChartBarData _line(List<double> values, Color color) => LineChartBarData(
        spots: values.asMap().entries.map((entry) => FlSpot(entry.key.toDouble(), entry.value)).toList(),
        isCurved: true,
        color: color,
        barWidth: 2,
        belowBarData: BarAreaData(show: true, color: color.withValues(alpha: 0.12)),
        dotData: const FlDotData(show: false),
      );

  Widget _dailyBreakdown() => Section(
        title: 'Daily Breakdown',
        child: Column(
          children: List.generate(week.length, (index) {
            final value = week[index];
            final label = days[index];
            final width = (value / 130000).clamp(0.0, 1.0);
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  SizedBox(width: 34, child: Text(label, style: TextStyle(color: index == 3 ? navy : const Color(0xFF6B7A99), fontSize: 11, fontWeight: index == 3 ? FontWeight.w800 : FontWeight.w600))),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Stack(
                      alignment: Alignment.centerLeft,
                      children: [
                        Container(
                          height: 7,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0F3F9),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        FractionallySizedBox(
                          widthFactor: width,
                          child: Container(
                            height: 7,
                            decoration: BoxDecoration(
                              color: index == 3 ? gold : navy,
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 58,
                    child: Text(
                      index <= 3 ? 'KSh ${(value / 1000).round()}K' : '—',
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        color: index <= 3 ? const Color(0xFF0D1B3D) : const Color(0xFFC8D0E0),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ),
      );

  Widget _categorySection() => Section(
        title: 'Sales by Category',
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(
              width: 120,
              height: 120,
              child: PieChart(
                PieChartData(
                  centerSpaceRadius: 28,
                  sectionsSpace: 2,
                  sections: categoryData.map((item) {
                    return PieChartSectionData(
                      value: item['value'] as double,
                      color: item['color'] as Color,
                      radius: 18,
                      showTitle: false,
                    );
                  }).toList(),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: categoryData.map((item) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        Container(width: 10, height: 10, decoration: BoxDecoration(color: item['color'], borderRadius: BorderRadius.circular(3))),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${item['name']}  ${item['value']}%',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF0D1B3D), height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      );

  Widget _monthly() => Column(
        children: [
          Section(
            title: 'Monthly Sales 2026',
            child: SizedBox(
              height: 210,
              child: BarChart(
                BarChartData(
                  maxY: 5,
                  borderData: FlBorderData(show: false),
                  gridData: const FlGridData(show: true, drawVerticalLine: false),
                  titlesData: FlTitlesData(
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(showTitles: true, reservedSize: 36, getTitlesWidget: (value, meta) => Text('${value.toInt()}M', style: const TextStyle(color: Color(0xFF6B7A99), fontSize: 10))),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(showTitles: true, getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index < 0 || index >= monthLabels.length) return const Text('');
                        return Text(monthLabels[index], style: const TextStyle(color: Color(0xFF6B7A99), fontSize: 10));
                      }, reservedSize: 20),
                    ),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  ),
                  barGroups: months.asMap().entries.map((entry) {
                    return BarChartGroupData(
                      x: entry.key,
                      barRods: [
                        BarChartRodData(
                          toY: entry.value,
                          color: entry.key == 8 ? gold : navy,
                          width: 14,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                        ),
                      ],
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
          Section(
            title: 'Monthly Breakdown',
            child: Column(
              children: List.generate(monthLabels.length, (index) {
                final label = monthLabels[index];
                final value = months[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      SizedBox(width: 34, child: Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7A99), fontWeight: FontWeight.w700))),
                      Expanded(
                        child: Text(
                          'KSh ${value.toStringAsFixed(1)}M',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF0D1B3D), fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
          ),
        ],
      );

  Widget _profit() => Column(
        children: [
          Section(
            title: 'Profit This Week',
            child: SizedBox(
              height: 190,
              child: BarChart(
                BarChartData(
                  maxY: 45000,
                  borderData: FlBorderData(show: false),
                  gridData: const FlGridData(show: true, drawVerticalLine: false),
                  titlesData: FlTitlesData(
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(showTitles: true, reservedSize: 42, getTitlesWidget: (value, meta) => Text('${(value / 1000).round()}K', style: const TextStyle(color: Color(0xFF6B7A99), fontSize: 10))),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(showTitles: true, reservedSize: 22, getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index < 0 || index >= days.length) return const Text('');
                        return Text(days[index], style: const TextStyle(color: Color(0xFF6B7A99), fontSize: 10));
                      }),
                    ),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  ),
                  barGroups: profit.asMap().entries.map((entry) {
                    return BarChartGroupData(
                      x: entry.key,
                      barRods: [
                        BarChartRodData(
                          toY: entry.value,
                          color: entry.key == 3 ? gold : Colors.green,
                          width: 20,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(5)),
                        ),
                      ],
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
          Section(
            title: 'Net Profit (week to date)',
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEAF8EE),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Text('KSh 181,650', style: TextStyle(color: Color(0xFF1B5E20), fontSize: 16, fontWeight: FontWeight.w800)),
                ),
                const SizedBox(width: 12),
                const Text('26.0% margin', style: TextStyle(color: Color(0xFF2E7D32), fontSize: 12, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ],
      );
}

class Metric extends StatelessWidget {
  const Metric(this.label, this.value, this.sub);
  final String label, value, sub;
  @override
  Widget build(BuildContext context) => Expanded(child: Container(margin: const EdgeInsets.only(right: 6), padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(10)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(color: Colors.white60, fontSize: 9)), Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)), Text(sub, style: const TextStyle(color: Colors.white54, fontSize: 9))])));
}
