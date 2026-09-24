import 'dart:async';
import 'dart:ui' as ui;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:bluetooth_print_plus/bluetooth_print_plus.dart'
    show BluetoothDevice;
import 'package:pdf/pdf.dart' as pdf;
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'services/cash_service.dart';
import 'services/credit_service.dart';
import 'services/customer_service.dart';
import 'services/customer_api_service.dart';
import 'services/auth_service.dart';
import 'services/employee_repository.dart';
import 'services/reports_service.dart';
import 'services/notification_receiver.dart';
import 'services/notification_service.dart';
import 'services/roster_sync_worker.dart';
import 'services/cache_optimizer_service.dart';
import 'services/dashboard_service.dart';
import 'services/mpesa_service.dart';
import 'services/product_repository.dart';
import 'services/product_catalog_service.dart';
import 'services/inventory_api_service.dart';
import 'services/purchase_order_service.dart';
import 'services/printer_service.dart';
import 'services/receipt_pdf_downloader.dart';
import 'services/sms_watcher_service.dart';
import 'services/sync_service.dart';
import 'services/supplier_service.dart';
import 'services/expense_service.dart';
import 'services/settings_service.dart';
import 'services/profile_service.dart';
import 'widgets/barcode_scanner_view.dart';
import 'widgets/smart_scan_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FlutterError.onError = (details) {
    _lastFlutterError = details.exception.toString();
    FlutterError.presentError(details);
  };
  ui.PlatformDispatcher.instance.onError = (error, stack) {
    FlutterError.reportError(
      FlutterErrorDetails(
          exception: error, stack: stack, library: 'MobiDuka startup'),
    );
    return true;
  };
  ErrorWidget.builder = (details) => StartupErrorScreen(
        message: details.exception.toString(),
      );

  // Render the first screen before optional telemetry initialization.
  runApp(const MobiDukaApp());
  const sentryDsn = String.fromEnvironment('SENTRY_DSN');
  if (sentryDsn.isNotEmpty) {
    unawaited(SentryFlutter.init(
      (options) {
        options.dsn = sentryDsn;
        options.environment = const String.fromEnvironment(
          'SENTRY_ENVIRONMENT',
          defaultValue: 'production',
        );
        options.tracesSampleRate = 0.1;
        options.reportPackages = true;
      },
    ));
  }
}

String? _lastFlutterError;

const navy = Color(0xFF123A8F);
const ink = Color(0xFF0D1B3D);
const gold = Color(0xFFD4AF37);
const muted = Color(0xFF6B7A99);

class ActiveShiftNotice {
  const ActiveShiftNotice({required this.count, required this.employeeName});
  final int count;
  final String employeeName;
}

/// Updated by Shift Management and rendered by the app shell above every view.
final ValueNotifier<ActiveShiftNotice?> activeShiftNotice = ValueNotifier(null);

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
    this.barcode,
  });
  final String name;
  final String category;
  final int cost;
  final int price;
  final int stock;
  final int reorder;
  final String emoji;
  final String status;
  final String? barcode;
}

final List<Product> defaultProducts = <Product>[
  const Product('Unga Jogoo 2kg', 'Flour', 160, 200, 45, 20, '🌾'),
  const Product('Cooking Oil 1L', 'Oils', 150, 190, 32, 15, '🫙'),
  const Product('Sugar 1kg', 'Sugar', 100, 140, 28, 30, '🍬', status: 'low'),
  const Product('Blue Band 500g', 'Spreads', 110, 150, 18, 20, '🧈',
      status: 'low'),
  const Product('Milk 500ml', 'Dairy', 75, 100, 60, 40, '🥛'),
  const Product('Royco 75g', 'Spices', 30, 45, 5, 20, '🌶️',
      status: 'critical'),
  const Product('Panadol 500mg', 'Pharma', 20, 30, 3, 50, '💊',
      status: 'critical'),
  const Product('Omo 400g', 'Detergent', 130, 180, 8, 15, '🧺', status: 'low'),
  const Product('Colgate 100ml', 'Personal', 60, 85, 22, 20, '🪥'),
  const Product('Bread White', 'Bakery', 40, 55, 15, 20, '🍞', status: 'low'),
  const Product('Eggs (tray)', 'Dairy', 380, 480, 12, 10, '🥚'),
  const Product('Nescafé 100g', 'Beverages', 240, 320, 9, 12, '☕',
      status: 'low'),
];

// Products are loaded from the authenticated backend catalogue. The bundled
// examples remain available only as development fixtures, not POS data.
List<Product> products = <Product>[];

final inventoryCategories = <String>[];
final inventoryCategoryIds = <String, String>{};
final inventoryCategoryEmojis = <String, String>{};

class MobiDukaApp extends StatefulWidget {
  const MobiDukaApp({super.key});
  @override
  State<MobiDukaApp> createState() => _MobiDukaAppState();
}

class _MobiDukaAppState extends State<MobiDukaApp> {
  final CashService _cashService = CashService();
  final AuthService _authService = AuthService();
  final GlobalKey<_POSScreenState> _posScreenKey = GlobalKey<_POSScreenState>();
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  NotificationReceiverService? _notificationService;
  int tab = 0;
  bool loggedIn = false;
  bool showingSmartScan = false;
  bool showingGlobalShiftManagement = false;
  bool isDarkMode = false;
  String activeRole = 'CASHIER';
  String? detail;
  String? activeSessionId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(_loadCatalog());
      unawaited(_loadActiveRole());
      unawaited(_refreshActiveShiftNotice());
    });
  }

  Future<void> _loadActiveRole() async {
    String role = 'CASHIER';
    try {
      role = await _authService.getActiveUserRole();
    } on Object {
      role = 'CASHIER';
    }
    if (!mounted) return;
    setState(() {
      activeRole = role;
      if (role == 'CASHIER') tab = 1;
    });
  }

  Future<void> _loadCatalog() async {
    try {
      final remoteProducts = await ProductCatalogService().load();
      if (!mounted) return;
      setState(() {
        products = remoteProducts;
        for (final product in remoteProducts) {
          if (product.category != 'Uncategorized' &&
              !inventoryCategories.contains(product.category)) {
            inventoryCategories.add(product.category);
          }
        }
      });
      final categories = await InventoryApiService().loadCategories();
      if (mounted) {
        setState(() {
          inventoryCategories
            ..clear()
            ..addAll(categories.map((category) => category.name));
          inventoryCategoryIds
            ..clear()
            ..addEntries(categories
                .map((category) => MapEntry(category.name, category.id)));
          inventoryCategoryEmojis
            ..clear()
            ..addEntries(categories.map(
                (category) => MapEntry(category.name, category.emoji ?? '📦')));
        });
      }
      if (!kIsWeb) {
        await ProductRepository.instance.syncLocalCatalog(remoteProducts);
      }
      return;
    } on Object {
      // Use the last server-backed cache if the device is offline. Never seed
      // POS with demo items when the real catalogue cannot be reached.
    }

    if (!kIsWeb) {
      try {
        final cachedProducts = await ProductRepository.instance.loadProducts();
        if (cachedProducts.isNotEmpty) {
          if (!mounted) return;
          setState(() {
            products = List<Product>.from(cachedProducts);
          });
          return;
        }
      } on Object {
        // A cache is optional; the empty state below is intentional.
      }
    }
    if (!mounted) return;
    setState(() => products = <Product>[]);
  }

  Future<void> _refreshActiveShiftNotice() async {
    try {
      final sessions = await EmployeeRepository().loadCashSessions();
      final active =
          sessions.where((session) => session['closedAt'] == null).toList();
      if (active.isEmpty) {
        activeShiftNotice.value = null;
        return;
      }
      final cashier = active.first['cashier'] as Map?;
      activeShiftNotice.value = ActiveShiftNotice(
        count: active.length,
        employeeName: cashier?['fullName']?.toString() ?? 'Team member',
      );
    } catch (_) {
      // Retain the visible state while the shift API is briefly unavailable.
    }
  }

  Future<void> _handleLoginAttempt() async {
    if (!mounted) return;
    setState(() {
      loggedIn = true;
      tab = 0;
      detail = null;
      activeSessionId = null;
      showingGlobalShiftManagement = false;
    });
    unawaited(_loadCatalog());
    unawaited(_refreshActiveShiftNotice());

    final role = await _authService.getActiveUserRole();
    if (!mounted) return;
    setState(() => activeRole = role);

    final businessId = await _authService.getActiveBusinessId();
    final token = await _authService.readToken();
    if (businessId != null && token != null) {
      unawaited(RosterSyncWorker().synchronizeStoreRoster(
        businessId: businessId,
        jwtToken: token,
      ));
    }

    if (kIsWeb) return;

    final session = await _cashService.getActiveSession(
      businessId: 'demo-business',
      userId: 'demo-user',
    );

    if (session == null) {
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (sheetContext) => _CashShiftGateSheet(
          onOpened: (sessionId) {
            _activateNotifications();
            if (!mounted) return;
            setState(() {
              activeSessionId = sessionId;
            });
          },
        ),
      );
      return;
    }

    if (!mounted) return;
    _activateNotifications();
    setState(() {
      activeSessionId = session['id'] as String?;
    });
  }

  Future<void> _activateNotifications() async {
    final service = _notificationService ??= NotificationReceiverService();
    await service.initializeNotificationEngine(context);
    await service.subscribeToTenantAlerts('demo-business');
  }

  Future<void> _deactivateNotifications() async {
    await _notificationService?.unsubscribeFromTenantAlerts('demo-business');
  }

  Future<void> _handleCloseShift() async {
    final activeSession = await _cashService.getActiveSession(
      businessId: 'demo-business',
      userId: 'demo-user',
    );

    if (activeSession == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No open cash drawer session found for this cashier.'),
          backgroundColor: Color(0xFFD32F2F),
        ),
      );
      return;
    }

    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => SizedBox(
        height: MediaQuery.of(context).size.height * 0.9,
        child: _CloseShiftSheet(
          sessionId: activeSession['id'] as String,
          onBeforeFinalized: _deactivateNotifications,
          onFinalized: () {
            setState(() {
              loggedIn = false;
              detail = null;
              tab = 0;
              activeSessionId = null;
            });
            Navigator.of(context).pop();
          },
        ),
      ),
    );
  }

  bool _canOpen(String value) {
    if (activeRole == 'OWNER' || activeRole == 'ADMIN') return true;
    if (activeRole == 'CASHIER')
      return value == 'Expense Tracking' || value == 'Credit Book';
    if (activeRole == 'SUPERVISOR') {
      return value != 'Reports & Analytics' &&
          value != 'Settings' &&
          value != 'Backup & Cloud Sync';
    }
    if (activeRole == 'ACCOUNTANT') {
      return value == 'Reports & Analytics' ||
          value == 'Credit Book' ||
          value == 'Expense Tracking' ||
          value == 'User Profile';
    }
    return false;
  }

  void open(String value) {
    if (!_canOpen(value)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('This area is restricted to store managers.')));
      return;
    }
    setState(() => detail = value);
  }

  void _openUniversalScanner() {
    if (!loggedIn || detail != null) return;
    _showSmartScan();
  }

  void _showSmartScan() {
    setState(() {
      detail = null;
      showingSmartScan = true;
    });
  }

  void _handleDashboardQuickAction(String destination) {
    switch (destination) {
      case 'pos':
        setState(() {
          detail = null;
          tab = 1;
        });
      case 'inventory':
        setState(() {
          detail = null;
          tab = 2;
        });
      case 'expenses':
        open('Expense Tracking');
      case 'reports':
        open('Reports & Analytics');
    }
  }

  void _closeSmartScan() => setState(() => showingSmartScan = false);

  void _addScannedProductToPos(Product product) {
    const posTab = 1;
    if (tab != posTab) {
      setState(() => tab = posTab);
    }

    // SmartScan may currently be replacing the POS widget.  Deferring until
    // the next frame ensures the POS state is mounted before updating its
    // cart, whether the user opened SmartScan from Home or from POS itself.
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _posScreenKey.currentState?.addToCartAndOpenCart(product),
    );
  }

  Widget _navButton(int index, IconData icon, String label) {
    final selected = tab == index;
    return InkWell(
      onTap: () => setState(() => tab = index),
      child: SizedBox(
        height: 64,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: selected ? gold : Colors.white70, size: 22),
            const SizedBox(height: 2),
            Text(label,
                style: TextStyle(
                    color: selected ? gold : Colors.white70,
                    fontSize: 10,
                    fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }

  List<Widget> _navigationButtons() {
    switch (activeRole) {
      case 'CASHIER':
        return [
          Expanded(child: _navButton(1, Icons.shopping_bag_rounded, 'POS')),
          const SizedBox(width: 72),
          Expanded(child: _navButton(3, Icons.menu_rounded, 'More')),
        ];
      case 'SUPERVISOR':
        return [
          Expanded(child: _navButton(0, Icons.home_filled, 'Home')),
          Expanded(child: _navButton(1, Icons.shopping_bag_rounded, 'POS')),
          const SizedBox(width: 72),
          Expanded(child: _navButton(2, Icons.inventory_2_rounded, 'Stock')),
          Expanded(child: _navButton(3, Icons.menu_rounded, 'More')),
        ];
      case 'ACCOUNTANT':
      case 'ADMIN':
        return [
          Expanded(child: _navButton(0, Icons.home_filled, 'Home')),
          const SizedBox(width: 72),
          Expanded(child: _navButton(3, Icons.menu_rounded, 'More')),
        ];
      default:
        return [
          Expanded(child: _navButton(0, Icons.home_filled, 'Home')),
          Expanded(child: _navButton(1, Icons.shopping_bag_rounded, 'POS')),
          const SizedBox(width: 72),
          Expanded(child: _navButton(2, Icons.inventory_2_rounded, 'Stock')),
          Expanded(child: _navButton(3, Icons.menu_rounded, 'More')),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final Widget body;
    if (!loggedIn) {
      body = LoginScreen(onLogin: _handleLoginAttempt);
    } else if (showingGlobalShiftManagement) {
      body = ShiftManagementScreen(
        onBack: () => setState(() => showingGlobalShiftManagement = false),
      );
    } else if (showingSmartScan) {
      body = SmartScanScreen(
        onProductScanned: _addScannedProductToPos,
        onClose: _closeSmartScan,
      );
    } else if (detail != null) {
      body = DetailScreen(
        title: detail!,
        onBack: () => setState(() => detail = null),
        isDarkMode: isDarkMode,
        onThemeChanged: (value) => setState(() => isDarkMode = value),
      );
    } else if (activeRole == 'CASHIER') {
      body = tab == 3
          ? MoreScreen(
              onOpen: open,
              role: activeRole,
              isDarkMode: isDarkMode,
              onLogout: _logout,
              onCloseShift: _handleCloseShift,
            )
          : POSScreen(key: _posScreenKey);
    } else {
      switch (tab.clamp(0, 3).toInt()) {
        case 0:
          body = DashboardScreen(
            onProductScanned: _addScannedProductToPos,
            onOpenSmartScan: _showSmartScan,
            onQuickAction: _handleDashboardQuickAction,
            onOpenNotifications: () => open('Notifications'),
          );
        case 1:
          body = POSScreen(key: _posScreenKey);
        case 2:
          body = const ProductScreen(title: 'Inventory & Stock');
        default:
          body = MoreScreen(
            onOpen: open,
            role: activeRole,
            isDarkMode: isDarkMode,
            onLogout: _logout,
            onCloseShift: _handleCloseShift,
          );
      }
    }

    return MaterialApp(
      navigatorKey: _navigatorKey,
      debugShowCheckedModeBanner: false,
      builder: (context, child) => child ?? const StartupErrorScreen(),
      themeMode: isDarkMode ? ThemeMode.dark : ThemeMode.light,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: navy),
        scaffoldBackgroundColor: const Color(0xFFF5F7FA),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme:
            ColorScheme.fromSeed(seedColor: navy, brightness: Brightness.dark),
        scaffoldBackgroundColor: const Color(0xFF101522),
        cardColor: const Color(0xFF192235),
      ),
      home: Scaffold(
        body: DecoratedBox(
          decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy])),
          child: Center(
            child: Container(
              width: 393,
              height: 852,
              margin: const EdgeInsets.all(18),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                  color: const Color(0xFF0A0A0A),
                  borderRadius: BorderRadius.circular(54),
                  boxShadow: const [
                    BoxShadow(
                        color: Colors.black54,
                        blurRadius: 30,
                        offset: Offset(0, 20))
                  ]),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(44),
                child: Stack(children: [
                  Scaffold(
                    backgroundColor: Colors.transparent,
                    body: body,
                    bottomNavigationBar: loggedIn &&
                            detail == null &&
                            !showingSmartScan &&
                            !showingGlobalShiftManagement
                        ? BottomAppBar(
                            shape: const CircularNotchedRectangle(),
                            notchMargin: 7,
                            color: const Color(0xFF0A0A0A),
                            child: SizedBox(
                              height: 64,
                              child: Row(children: _navigationButtons()),
                            ),
                          )
                        : null,
                    floatingActionButtonLocation:
                        FloatingActionButtonLocation.centerDocked,
                    floatingActionButton:
                        loggedIn && detail == null && !showingSmartScan
                            ? Container(
                                width: 68,
                                height: 64,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(color: gold, width: 2.5),
                                  boxShadow: const [
                                    BoxShadow(
                                        color: Colors.black26,
                                        blurRadius: 10,
                                        offset: Offset(0, 5))
                                  ],
                                ),
                                child: FloatingActionButton(
                                  onPressed: _openUniversalScanner,
                                  backgroundColor: navy,
                                  foregroundColor: Colors.white,
                                  tooltip: 'Scan barcode or QR code',
                                  shape: const CircleBorder(),
                                  child: const Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.qr_code_scanner, size: 24),
                                      SizedBox(height: 2),
                                      Text('SCAN',
                                          style: TextStyle(
                                              color: gold,
                                              fontSize: 9,
                                              fontWeight: FontWeight.w900)),
                                    ],
                                  ),
                                ),
                              )
                            : null,
                  ),
                  if (loggedIn && !showingGlobalShiftManagement)
                    Positioned(
                      left: 12,
                      right: 12,
                      top: 42,
                      child: ValueListenableBuilder<ActiveShiftNotice?>(
                        valueListenable: activeShiftNotice,
                        builder: (context, notice, _) {
                          if (notice == null) return const SizedBox.shrink();
                          final label =
                              '${notice.count} ${notice.count == 1 ? 'shift' : 'shifts'} in progress · ${notice.employeeName}';
                          return Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: () => setState(
                                  () => showingGlobalShiftManagement = true),
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 11),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0F6634),
                                  borderRadius: BorderRadius.circular(10),
                                  boxShadow: const [
                                    BoxShadow(
                                        color: Color(0x33000000),
                                        blurRadius: 10,
                                        offset: Offset(0, 4))
                                  ],
                                ),
                                child: Row(children: [
                                  const Icon(Icons.access_time_filled,
                                      color: Color(0xFFA5D6A7), size: 17),
                                  const SizedBox(width: 9),
                                  Expanded(
                                      child: Text(label,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700))),
                                  const SizedBox(width: 8),
                                  const Text('Manage ›',
                                      style: TextStyle(
                                          color: Color(0xFFA5D6A7),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800)),
                                ]),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  // Keep the device-style top speaker detail above the app shell.
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
                              bottom: Radius.circular(20)),
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

  void _logout() {
    _deactivateNotifications();
    _authService.clearSession();
    activeShiftNotice.value = null;
    setState(() {
      loggedIn = false;
      detail = null;
      activeSessionId = null;
      showingGlobalShiftManagement = false;
      activeRole = 'CASHIER';
      tab = 0;
    });
  }
}

class _CashShiftGateSheet extends StatefulWidget {
  const _CashShiftGateSheet({required this.onOpened});
  final ValueChanged<String> onOpened;

  @override
  State<_CashShiftGateSheet> createState() => _CashShiftGateSheetState();
}

class _CashShiftGateSheetState extends State<_CashShiftGateSheet> {
  final TextEditingController _openingCashController =
      TextEditingController(text: '2500');
  final CashService _cashService = CashService();
  bool _submitting = false;

  void _appendDigit(String digit) {
    if (_submitting) return;
    setState(() {
      final value = _openingCashController.text;
      _openingCashController.text = value == '0' ? digit : '$value$digit';
      _openingCashController.selection =
          TextSelection.collapsed(offset: _openingCashController.text.length);
    });
  }

  void _deleteDigit() {
    if (_submitting) return;
    setState(() {
      final value = _openingCashController.text;
      if (value.length <= 1) {
        _openingCashController.text = '0';
      } else {
        _openingCashController.text = value.substring(0, value.length - 1);
      }
      _openingCashController.selection =
          TextSelection.collapsed(offset: _openingCashController.text.length);
    });
  }

  Future<void> _openShift() async {
    final value = double.tryParse(_openingCashController.text.trim());
    if (value == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid opening cash amount.'),
          backgroundColor: Color(0xFFD32F2F),
        ),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      final sessionId = await _cashService.openSession(
        businessId: 'demo-business',
        userId: 'demo-user',
        openingCash: value,
      );

      if (!mounted) return;
      widget.onOpened(sessionId);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Shift opened successfully. Drawer ID: $sessionId'),
          backgroundColor: const Color(0xFF2E7D32),
        ),
      );
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Unable to open shift: $error'),
          backgroundColor: const Color(0xFFD32F2F),
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      decoration: const BoxDecoration(
        color: Color(0xFFF5F7FA),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Cash Shift Ignition',
                  style: TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w800, color: ink)),
              const SizedBox(height: 8),
              const Text(
                  'Set the starting drawer float before you unlock the sales dashboard.',
                  style: TextStyle(color: muted, fontSize: 13)),
              const SizedBox(height: 20),
              TextField(
                controller: _openingCashController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(
                    fontSize: 22, fontWeight: FontWeight.w800, color: ink),
                decoration: InputDecoration(
                  labelText: 'Opening Cash (KES)',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFFE8ECF4)),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: 2.4,
                children: [
                  ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(
                    (digit) => OutlinedButton(
                      onPressed: () => _appendDigit(digit),
                      child: Text(digit,
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w700)),
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: _deleteDigit,
                    icon: const Icon(Icons.backspace_outlined),
                    label: const Text('Delete'),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _submitting ? null : _openShift,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2E7D32),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(
                      _submitting ? 'Opening Shift...' : 'Open Shift Drawer',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CloseShiftSheet extends StatefulWidget {
  const _CloseShiftSheet(
      {required this.sessionId,
      required this.onBeforeFinalized,
      required this.onFinalized});
  final String sessionId;
  final Future<void> Function() onBeforeFinalized;
  final VoidCallback onFinalized;

  @override
  State<_CloseShiftSheet> createState() => _CloseShiftSheetState();
}

class _CloseShiftSheetState extends State<_CloseShiftSheet> {
  final TextEditingController _closingCashController =
      TextEditingController(text: '0');
  final TextEditingController _notesController = TextEditingController();
  final CashService _cashService = CashService();
  bool _submitting = false;

  Future<void> _submitCloseout() async {
    final closingCash = double.tryParse(_closingCashController.text.trim());
    if (closingCash == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid counted cash amount.'),
          backgroundColor: Color(0xFFD32F2F),
        ),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      final summary = await _cashService.closeSession(
        sessionId: widget.sessionId,
        businessId: 'demo-business',
        userId: 'demo-user',
        closingCash: closingCash,
      );

      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Shift Closeout Summary'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Opening Float: KSh ${summary['openingCash']}'),
              const SizedBox(height: 8),
              Text(
                  'Offline Cash Sales Completed: KSh ${summary['totalCashSales']}'),
              const SizedBox(height: 8),
              Text(
                  'Cash Expenses Disbursed: KSh ${summary['totalCashExpenses'] ?? 0}'),
              const SizedBox(height: 8),
              Text(
                  'Expected Drawer Balance: KSh ${summary['expectedBalance']}'),
              const SizedBox(height: 8),
              Text('Physical Counted Total: KSh ${summary['actualCounted']}'),
              const SizedBox(height: 8),
              Text(
                'Variance: KSh ${summary['variance']}',
                style: TextStyle(
                  color: (summary['variance'] as num) < 0
                      ? const Color(0xFFD32F2F)
                      : const Color(0xFF2E7D32),
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Notes: ${_notesController.text.trim().isEmpty ? 'No closeout notes recorded.' : _notesController.text.trim()}',
                style: const TextStyle(color: muted),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Review'),
            ),
            FilledButton(
              onPressed: () => _finalizeCloseout(dialogContext, summary),
              child: const Text('Finalize Closeout'),
            ),
          ],
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Unable to close shift: $error'),
          backgroundColor: const Color(0xFFD32F2F),
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _finalizeCloseout(
      BuildContext dialogContext, Map<String, dynamic> summary) async {
    try {
      await SyncService().queueChange(
        id: 'sync-finalize-${widget.sessionId}',
        entityName: 'CashSession',
        operation: 'UPDATE',
        payload: {
          'action': 'FINALIZE_CLOSEOUT',
          'sessionId': widget.sessionId,
          'businessId': 'demo-business',
          'userId': 'demo-user',
          'summary': summary,
          'notes': _notesController.text.trim(),
        },
      );
      await widget.onBeforeFinalized();
      unawaited(CacheOptimizerService().optimizeLocalDatabaseCache());
      await AuthService().clearSession();
      if (!mounted) return;
      Navigator.of(dialogContext).pop();
      widget.onFinalized();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Unable to finalize closeout: $error'),
          backgroundColor: const Color(0xFFD32F2F),
        ),
      );
    }
  }

  @override
  void dispose() {
    _closingCashController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      decoration: const BoxDecoration(
        color: Color(0xFFF5F7FA),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Close Shift Session',
                  style: TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w800, color: ink)),
              const SizedBox(height: 8),
              const Text(
                  'Record the actual counted cash and finalize your drawer reconciliation.',
                  style: TextStyle(color: muted, fontSize: 13)),
              const SizedBox(height: 20),
              TextField(
                controller: _closingCashController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(
                    fontSize: 20, fontWeight: FontWeight.w800, color: ink),
                decoration: InputDecoration(
                  labelText: 'Counted Cash Amount (KES)',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFFE8ECF4)),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _notesController,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Closeout Notes',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFFE8ECF4)),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _submitting ? null : _submitCloseout,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: navy,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(_submitting ? 'Closing Shift...' : 'Close Shift',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({required this.onLogin});
  final Future<void> Function() onLogin;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class StartupErrorScreen extends StatelessWidget {
  const StartupErrorScreen({super.key, this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    final error = message ??
        _lastFlutterError ??
        'The app failed while rendering its first screen.';
    return Material(
      color: ink,
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.warning_amber_rounded, color: gold, size: 48),
                const SizedBox(height: 16),
                const Text(
                  'MobiDuka could not start',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                Text(
                  error,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LoginScreenState extends State<LoginScreen> {
  static const String _deviceToken = 'flutter-pos-hardware-token-12345';
  final AuthService _authService = AuthService();
  String step = 'splash';
  String pin = '';
  bool isAuthenticating = false;
  bool loginSucceeded = false;
  bool showPassword = false;
  String? loginError;
  final TextEditingController emailController =
      TextEditingController(text: 'naomi@lifecarecanteen.co.ke');
  final TextEditingController passwordController =
      TextEditingController(text: 'Lifecare@2026');
  final TextEditingController recoveryEmailController = TextEditingController();
  final TextEditingController recoveryOtpController = TextEditingController();
  final TextEditingController recoveryPasswordController =
      TextEditingController();
  final TextEditingController recoveryConfirmController =
      TextEditingController();
  String recoveryRole = 'Admin';
  String? recoveryError;

  BorderSide _inputBorder({required bool isPasswordField}) {
    if (loginSucceeded) {
      return const BorderSide(color: Color(0xFF2E7D32));
    }
    if (loginError != null) {
      return const BorderSide(color: Color(0xFFD32F2F));
    }
    return const BorderSide(color: Color(0xFFE8ECF4));
  }

  bool get hasLoginFeedback => loginError != null || loginSucceeded;

  void _clearLoginFeedback() {
    setState(() {
      loginError = null;
      loginSucceeded = false;
    });
  }

  void _handlePinPress(String digit) {
    if (isAuthenticating || pin.length >= 4) return;
    final next = pin + digit;
    setState(() => pin = next);
    if (next.length == 4) {
      _authenticateWithPin(next);
    }
  }

  void _handlePinDelete() {
    if (isAuthenticating) return;
    setState(() {
      if (pin.isEmpty) return;
      pin = pin.substring(0, pin.length - 1);
    });
  }

  Future<void> _authenticateWithPin(String inputCode) async {
    if (isAuthenticating) return;
    setState(() {
      isAuthenticating = true;
      loginError = null;
      loginSucceeded = false;
    });
    try {
      final result = await _authService.loginWithPIN(
        pin: inputCode,
        activeBusinessId: 'demo-business',
        deviceToken: _deviceToken,
        identifier: 'cashier1',
      );
      final session = result['session'];
      if (result['offline'] != true && session is! AuthSession) {
        throw Exception('Authentication returned an incomplete session.');
      }
      if (!mounted) return;
      setState(() {
        loginSucceeded = true;
        loginError = null;
        isAuthenticating = false;
      });
      if (result['offline'] == true) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(const SnackBar(
            backgroundColor: Color(0xFF2E7D32),
            content: Text('Logged in securely via local offline cache'),
          ));
      }
      await widget.onLogin();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        loginSucceeded = false;
        loginError = null;
        pin = '';
        isAuthenticating = false;
      });
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          backgroundColor: const Color(0xFFD32F2F),
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ));
    }
  }

  Future<void> _authenticateWithPassword() async {
    await _authenticate(() => _authService.loginWithPassword(
          identifier: emailController.text.trim(),
          password: passwordController.text,
          deviceToken: _deviceToken,
        ));
  }

  Future<void> _authenticate(Future<AuthSession> Function() request) async {
    if (isAuthenticating) return;
    setState(() {
      isAuthenticating = true;
      loginError = null;
      loginSucceeded = false;
    });
    try {
      await request();
      if (!mounted) return;
      setState(() {
        loginSucceeded = true;
        loginError = null;
      });
      await widget.onLogin();
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '');
      final isPinLogin = step == 'pin';
      setState(() {
        loginSucceeded = false;
        loginError = isPinLogin ? null : message;
        pin = '';
        emailController.clear();
        passwordController.clear();
        isAuthenticating = false;
      });
      if (isPinLogin) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFFD32F2F),
              content: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.white),
                  const SizedBox(width: 8),
                  Expanded(child: Text(message)),
                ],
              ),
            ),
          );
      }
    }
  }

  void _startPasswordRecovery() {
    recoveryEmailController.text = emailController.text.trim();
    recoveryOtpController.clear();
    recoveryPasswordController.clear();
    recoveryConfirmController.clear();
    setState(() {
      recoveryError = null;
      step = 'fp-email';
    });
  }

  void _sendRecoveryCode() {
    if (recoveryEmailController.text.trim().isEmpty) {
      setState(() => recoveryError = 'Please enter your registered email.');
      return;
    }
    setState(() {
      recoveryError = null;
      step = 'fp-otp';
    });
  }

  void _verifyRecoveryCode() {
    if (recoveryOtpController.text.trim().length != 6) {
      setState(() => recoveryError = 'Enter the 6-digit code to continue.');
      return;
    }
    setState(() {
      recoveryError = null;
      step = 'fp-reset';
    });
  }

  void _saveRecoveredPassword() {
    final password = recoveryPasswordController.text;
    if (password.length < 6) {
      setState(() => recoveryError = 'Password must be at least 6 characters.');
      return;
    }
    if (password != recoveryConfirmController.text) {
      setState(() => recoveryError = 'Passwords do not match.');
      return;
    }
    setState(() {
      recoveryError = null;
      step = 'fp-done';
    });
  }

  Widget _recoveryHeader(String title, String subtitle, VoidCallback onBack) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 52, 20, 24),
      decoration:
          const BoxDecoration(gradient: LinearGradient(colors: [ink, navy])),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            style: IconButton.styleFrom(
              backgroundColor: Colors.white.withValues(alpha: 0.12),
              foregroundColor: Colors.white,
              fixedSize: const Size(36, 36),
            ),
            icon: const Icon(Icons.arrow_back, size: 18),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(subtitle,
                  style:
                      const TextStyle(color: Color(0x99FFFFFF), fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _recoveryFieldLabel(String label) => Text(
        label,
        style: const TextStyle(
            fontSize: 13, fontWeight: FontWeight.w600, color: muted),
      );

  InputDecoration _recoveryInputDecoration({String? hintText}) =>
      InputDecoration(
        hintText: hintText,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFFE8ECF4))),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFFE8ECF4))),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: navy)),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      );

  Widget _recoveryError() {
    final error = recoveryError;
    if (error == null) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
          color: const Color(0xFFFFEBEE),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFFFCDD2))),
      child: Text(error,
          style: const TextStyle(color: Color(0xFFD32F2F), fontSize: 13)),
    );
  }

  Widget _recoveryButton(String label, VoidCallback? onPressed) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: onPressed == null ? const Color(0xFFE3EAF8) : navy,
          foregroundColor:
              onPressed == null ? const Color(0xFFB0BAD3) : Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        child: Text(label,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _buildRecoveryScreen() {
    if (step == 'fp-done') {
      return Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            _recoveryHeader(
                'Password Reset', '', () => setState(() => step = 'login')),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('🔓', style: TextStyle(fontSize: 64)),
                    const SizedBox(height: 20),
                    const Text('Password Updated!',
                        style: TextStyle(
                            color: ink,
                            fontSize: 22,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    const Text(
                        'Your new password has been saved.\nYou can now sign in.',
                        textAlign: TextAlign.center,
                        style:
                            TextStyle(color: muted, fontSize: 14, height: 1.6)),
                    const SizedBox(height: 32),
                    _recoveryButton('Back to Sign In',
                        () => setState(() => step = 'login')),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (step == 'fp-reset') {
      return Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            _recoveryHeader('Set New Password', 'Step 3 of 3',
                () => setState(() => step = 'fp-otp')),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                children: [
                  _recoveryFieldLabel('New Password'),
                  const SizedBox(height: 6),
                  TextField(
                      controller: recoveryPasswordController,
                      obscureText: true,
                      onChanged: (_) => setState(() => recoveryError = null),
                      decoration: _recoveryInputDecoration(
                          hintText: 'Min. 6 characters')),
                  const SizedBox(height: 16),
                  _recoveryFieldLabel('Confirm New Password'),
                  const SizedBox(height: 6),
                  TextField(
                      controller: recoveryConfirmController,
                      obscureText: true,
                      onChanged: (_) => setState(() => recoveryError = null),
                      decoration: _recoveryInputDecoration(
                          hintText: 'Repeat password')),
                  const SizedBox(height: 16),
                  _recoveryError(),
                  _recoveryButton('Save New Password', _saveRecoveredPassword),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (step == 'fp-otp') {
      final ready = recoveryOtpController.text.length == 6;
      return Container(
        color: const Color(0xFFF5F7FA),
        child: Column(
          children: [
            _recoveryHeader('Enter OTP', 'Step 2 of 3',
                () => setState(() => step = 'fp-email')),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                children: [
                  const Text('📲',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 40)),
                  const SizedBox(height: 12),
                  const Text('Check your phone',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: ink,
                          fontSize: 15,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  Text(
                      'A 6-digit code was sent to the number linked to ${recoveryEmailController.text}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          color: muted, fontSize: 13, height: 1.6)),
                  const SizedBox(height: 28),
                  _recoveryFieldLabel('6-Digit Code'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: recoveryOtpController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    onChanged: (_) => setState(() => recoveryError = null),
                    style: const TextStyle(
                        fontSize: 28,
                        letterSpacing: 12,
                        fontWeight: FontWeight.w800),
                    decoration:
                        _recoveryInputDecoration(hintText: '• • • • • •')
                            .copyWith(counterText: ''),
                  ),
                  const SizedBox(height: 8),
                  _recoveryError(),
                  _recoveryButton(
                      'Verify Code →', ready ? _verifyRecoveryCode : null),
                  const SizedBox(height: 12),
                  TextButton(
                      onPressed: () {},
                      child: const Text('Resend code',
                          style: TextStyle(
                              color: navy,
                              fontSize: 13,
                              fontWeight: FontWeight.w600))),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final hasEmail = recoveryEmailController.text.trim().isNotEmpty;
    return Container(
      color: const Color(0xFFF5F7FA),
      child: Column(
        children: [
          _recoveryHeader('Forgot Password', 'Step 1 of 3',
              () => setState(() => step = 'login')),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
              children: [
                const Text('Reset your password',
                    style: TextStyle(
                        color: ink, fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                const Text(
                    'Enter your registered email. A one-time code will be sent to your linked phone number.',
                    style: TextStyle(color: muted, fontSize: 13, height: 1.6)),
                const SizedBox(height: 20),
                _recoveryFieldLabel('Email Address'),
                const SizedBox(height: 6),
                TextField(
                    controller: recoveryEmailController,
                    keyboardType: TextInputType.emailAddress,
                    onChanged: (_) => setState(() => recoveryError = null),
                    decoration:
                        _recoveryInputDecoration(hintText: 'your@email.com')),
                const SizedBox(height: 16),
                _recoveryFieldLabel('Account Role'),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children:
                      ['Admin', 'Manager', 'Cashier', 'Supervisor'].map((role) {
                    final selected = recoveryRole == role;
                    return ChoiceChip(
                        label: Text(role),
                        selected: selected,
                        onSelected: (_) => setState(() => recoveryRole = role),
                        selectedColor: const Color(0xFFE3EAF8),
                        labelStyle: TextStyle(
                            color: selected ? navy : muted,
                            fontWeight: FontWeight.w600));
                  }).toList(),
                ),
                const SizedBox(height: 24),
                _recoveryError(),
                _recoveryButton(
                    'Send Reset Code →', hasEmail ? _sendRecoveryCode : null),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    recoveryEmailController.dispose();
    recoveryOtpController.dispose();
    recoveryPasswordController.dispose();
    recoveryConfirmController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (step.startsWith('fp-')) return _buildRecoveryScreen();

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
                      if (loginSucceeded) ...[
                        const SizedBox(height: 18),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: loginSucceeded
                                ? const Color(0x332E7D32)
                                : const Color(0x33D32F2F),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: loginSucceeded
                                  ? const Color(0xFF66BB6A)
                                  : const Color(0xFFEF9A9A),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                loginSucceeded
                                    ? Icons.check_circle_outline
                                    : Icons.error_outline,
                                color: loginSucceeded
                                    ? const Color(0xFFA5D6A7)
                                    : const Color(0xFFFFCDD2),
                                size: 18,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'PIN accepted. Redirecting...',
                                  style: TextStyle(
                                    color: loginSucceeded
                                        ? const Color(0xFFA5D6A7)
                                        : const Color(0xFFFFCDD2),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 48),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(
                            4,
                            (index) => Container(
                                  width: 16,
                                  height: 16,
                                  margin: EdgeInsets.only(
                                      right: index == 3 ? 0 : 20),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    backgroundBlendMode: BlendMode.srcOver,
                                    color: index < pin.length
                                        ? gold
                                        : const Color(0x33FFFFFF),
                                    border: Border.all(
                                      color: index < pin.length
                                          ? gold
                                          : const Color(0x4DFFFFFF),
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
                            ...[
                              '1',
                              '2',
                              '3',
                              '4',
                              '5',
                              '6',
                              '7',
                              '8',
                              '9',
                              '',
                              '0',
                              '⌫'
                            ].map((key) {
                              if (key.isEmpty) return const SizedBox();
                              final isDelete = key == '⌫';
                              return Material(
                                color: isDelete
                                    ? Colors.transparent
                                    : const Color(0x1AFFFFFF),
                                borderRadius: BorderRadius.circular(16),
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(16),
                                  onTap: isAuthenticating
                                      ? null
                                      : () => isDelete
                                          ? _handlePinDelete()
                                          : _handlePinPress(key),
                                  child: Center(
                                    child: isAuthenticating && key == '0'
                                        ? const SizedBox(
                                            width: 22,
                                            height: 22,
                                            child: CircularProgressIndicator(
                                                strokeWidth: 2, color: gold),
                                          )
                                        : Text(
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
                  onPressed: () {
                    _clearLoginFeedback();
                    setState(() => step = 'login');
                  },
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
                borderRadius:
                    BorderRadius.vertical(bottom: Radius.circular(32)),
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
                            child: SvgPicture.asset(
                              'assets/mobiduka_icon.svg',
                              fit: BoxFit.contain,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text('MobiDuka POS',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800)),
                          Text('Business Management',
                              style: TextStyle(
                                  color: Color(0xCCF0D060),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text('Welcome back',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  const Text('Sign in to your account',
                      style: TextStyle(color: Color(0x99FFFFFF), fontSize: 13)),
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
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF6B7A99)),
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (hasLoginFeedback)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: loginSucceeded
                              ? const Color(0xFFE8F5E9)
                              : const Color(0xFFFFEBEE),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: loginSucceeded
                                ? const Color(0xFF66BB6A)
                                : const Color(0xFFEF9A9A),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              loginSucceeded
                                  ? Icons.check_circle_outline
                                  : Icons.error_outline,
                              color: loginSucceeded
                                  ? const Color(0xFF1B5E20)
                                  : const Color(0xFFB71C1C),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                loginSucceeded
                                    ? 'Signed in successfully. Redirecting...'
                                    : loginError ?? '',
                                style: TextStyle(
                                  color: loginSucceeded
                                      ? const Color(0xFF1B5E20)
                                      : const Color(0xFFB71C1C),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    TextField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF0D1B3D)),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: _inputBorder(isPasswordField: false),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: _inputBorder(isPasswordField: false),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: loginSucceeded
                              ? const BorderSide(color: Color(0xFF2E7D32))
                              : loginError != null
                                  ? const BorderSide(color: Color(0xFFD32F2F))
                                  : const BorderSide(color: navy),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 16),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Password',
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF6B7A99)),
                      ),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: passwordController,
                      obscureText: !showPassword,
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF0D1B3D)),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: _inputBorder(isPasswordField: true),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: _inputBorder(isPasswordField: true),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: loginSucceeded
                              ? const BorderSide(color: Color(0xFF2E7D32))
                              : loginError != null
                                  ? const BorderSide(color: Color(0xFFD32F2F))
                                  : const BorderSide(color: navy),
                        ),
                        suffixIcon: IconButton(
                          onPressed: () =>
                              setState(() => showPassword = !showPassword),
                          tooltip:
                              showPassword ? 'Hide password' : 'Show password',
                          icon: Icon(
                              showPassword
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              color: muted),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 16),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: _startPasswordRecovery,
                        child: const Text(
                          'Forgot Password?',
                          style: TextStyle(
                              color: navy,
                              fontSize: 13,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed:
                            isAuthenticating ? null : _authenticateWithPassword,
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
                        child: isAuthenticating
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                              )
                            : const Text(
                                'Sign In',
                                style: TextStyle(
                                    fontSize: 16, fontWeight: FontWeight.w700),
                              ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: 220,
                      child: TextButton(
                        onPressed: () {
                          _clearLoginFeedback();
                          setState(() => step = 'pin');
                        },
                        style: TextButton.styleFrom(
                          backgroundColor: const Color(0x0D123A8F),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text(
                          'Use PIN Login instead',
                          style: TextStyle(
                              color: navy,
                              fontSize: 14,
                              fontWeight: FontWeight.w600),
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
          begin: Alignment(-0.8, -1),
          end: Alignment(0.8, 1),
          colors: [ink, navy, Color(0xFF1A4FBF)],
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(32, 0, 32, 48),
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
                          colors: [
                            Color(0xFFD4AF37),
                            Color(0xFFF0D060),
                            Color(0xFFC9A227)
                          ],
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
                          child: SvgPicture.asset(
                            'assets/mobiduka_icon.svg',
                            fit: BoxFit.contain,
                          ),
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
                      'POINT OF SALE',
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
                    const SizedBox(height: 60),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(
                          3,
                          (index) => Container(
                                margin:
                                    EdgeInsets.only(right: index == 2 ? 0 : 8),
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: index == 0
                                      ? gold
                                      : const Color(0x4DFFFFFF),
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
                mainAxisSize: MainAxisSize.min,
                children: [
                  FractionallySizedBox(
                    widthFactor: 0.8,
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
                  const SizedBox(height: 16),
                  FractionallySizedBox(
                    widthFactor: 0.8,
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

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    required this.onProductScanned,
    required this.onOpenSmartScan,
    required this.onQuickAction,
    required this.onOpenNotifications,
  });

  final ValueChanged<Product> onProductScanned;
  final VoidCallback onOpenSmartScan;
  final ValueChanged<String> onQuickAction;
  final VoidCallback onOpenNotifications;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final DashboardService _dashboardService = DashboardService();
  final AuthService _authService = AuthService();
  DashboardSnapshot _dashboard = DashboardSnapshot.empty;
  bool _loading = true;
  String? _error;
  String _userName = 'there';
  int _unreadNotifications = 0;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
    _loadUnreadNotifications();
  }

  Future<void> _loadUnreadNotifications() async {
    try {
      final session = await _authService.readSession();
      if (session == null) return;
      final count = await NotificationService().unreadCount(session);
      if (mounted) setState(() => _unreadNotifications = count);
    } catch (_) {
      // Leave the badge hidden when notifications are temporarily unavailable.
    }
  }

  Future<void> _loadDashboard() async {
    try {
      final session = await _authService.readSession();
      final dashboard = await _dashboardService.load();
      if (!mounted) return;
      setState(() {
        _dashboard = dashboard;
        _userName = session?.user['name']?.toString().trim().isNotEmpty == true
            ? session!.user['name'].toString()
            : 'there';
        _loading = false;
        _error = null;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  num _number(Object? value) =>
      value is num ? value : num.tryParse(value?.toString() ?? '') ?? 0;

  String _money(Object? value) => 'KSh ${_number(value).toStringAsFixed(0)}';

  String _friendlyTransactionTime(Object? value) {
    final parsed = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    if (parsed == null) return value?.toString() ?? '';
    final time =
        '${parsed.hour.toString().padLeft(2, '0')}:${parsed.minute.toString().padLeft(2, '0')}';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final date = DateTime(parsed.year, parsed.month, parsed.day);
    final days = today.difference(date).inDays;
    if (days == 0) return time;
    if (days == 1) return 'Yesterday · $time';
    if (days < 7) return '$days days ago · $time';
    return '${parsed.day}/${parsed.month}/${parsed.year} · $time';
  }

  Widget _scanMetric(String value, String label, Color color,
      {bool isLast = false}) {
    return Expanded(
      child: Container(
        decoration: BoxDecoration(
          border: isLast
              ? null
              : const Border(right: BorderSide(color: Color(0xFFE8ECF3))),
        ),
        child: Column(
          children: [
            Text(value,
                style: TextStyle(
                    color: color, fontSize: 20, fontWeight: FontWeight.w800)),
            Text(label,
                style: const TextStyle(
                    color: muted, fontSize: 10, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }

  void _openSmartScan() {
    widget.onOpenSmartScan();
  }

  Widget _smartScanCard(Map scanCounts, List<Map<String, dynamic>> scans) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
              color: Color(0x11000000), blurRadius: 8, offset: Offset(0, 2))
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _openSmartScan,
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                decoration: const BoxDecoration(
                    gradient: LinearGradient(colors: [ink, navy])),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: gold.withValues(alpha: 0.20),
                        borderRadius: BorderRadius.circular(11),
                        border: Border.all(color: gold.withValues(alpha: 0.4)),
                      ),
                      child: const Icon(Icons.qr_code_scanner_rounded,
                          color: gold, size: 20),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Text('SmartScan™',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700)),
                            SizedBox(width: 7),
                            DecoratedBox(
                              decoration: BoxDecoration(
                                  color: Color(0x40D4AF37),
                                  borderRadius:
                                      BorderRadius.all(Radius.circular(99))),
                              child: Padding(
                                padding: EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 2),
                                child: Text('QUICK ACTION',
                                    style: TextStyle(
                                        color: gold,
                                        fontSize: 9,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 0.5)),
                              ),
                            ),
                          ]),
                          SizedBox(height: 2),
                          Text('Scan any product barcode instantly',
                              style: TextStyle(
                                  color: Color(0x99FFFFFF), fontSize: 11)),
                        ],
                      ),
                    ),
                    FilledButton(
                      onPressed: _openSmartScan,
                      style: FilledButton.styleFrom(
                          backgroundColor: gold,
                          foregroundColor: ink,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
                          minimumSize: const Size(0, 0)),
                      child: const Text('Scan',
                          style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(children: [
                  _scanMetric('${_number(scanCounts['FOUND']).toInt()}',
                      'Barcodes', navy),
                  _scanMetric('${_number(scanCounts['UNKNOWN']).toInt()}',
                      'Unknown', const Color(0xFFD32F2F)),
                  _scanMetric('${_number(scanCounts['MANUAL']).toInt()}',
                      'Manual', muted,
                      isLast: true),
                ]),
              ),
              const Divider(height: 1, color: Color(0xFFE8ECF3)),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('RECENT SCANS',
                        style: TextStyle(
                            color: muted,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5)),
                    const SizedBox(height: 8),
                    if (scans.isEmpty)
                      const Padding(
                          padding: EdgeInsets.only(bottom: 8),
                          child: Text('No scans recorded yet.',
                              style: TextStyle(color: muted, fontSize: 12))),
                    ...scans.take(10).map((scan) {
                      final isUnknown = scan['status']?.toString() == 'UNKNOWN';
                      final name = scan['name']?.toString() ??
                          (isUnknown ? 'Unknown Product' : 'Product');
                      return InkWell(
                        onTap: _openSmartScan,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 7),
                          child: Row(children: [
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                  color: isUnknown
                                      ? const Color(0xFFFFEBEE)
                                      : const Color(0xFFE3EAF8),
                                  borderRadius: BorderRadius.circular(9)),
                              child: Center(
                                  child: Text(
                                      scan['emoji']?.toString() ??
                                          (isUnknown ? '❓' : '📦'),
                                      style: const TextStyle(fontSize: 15))),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                  Text(name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                          color: isUnknown
                                              ? const Color(0xFFC62828)
                                              : ink,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600)),
                                  Text(scan['barcode']?.toString() ?? '',
                                      style: const TextStyle(
                                          color: muted,
                                          fontSize: 10,
                                          fontFamily: 'monospace')),
                                ])),
                            const SizedBox(width: 8),
                            Text(_friendlyTransactionTime(scan['createdAt']),
                                style: const TextStyle(
                                    color: Color(0xFF9AA6BA), fontSize: 10)),
                          ]),
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
    );
  }

  @override
  Widget build(BuildContext context) {
    final summary = _dashboard.summary;
    final paymentBreakdown = _dashboard.paymentBreakdown['MPESA'];
    final mpesa =
        paymentBreakdown is Map ? paymentBreakdown : const <String, dynamic>{};
    final quickStats = [
      {
        'label': 'Credit Out',
        'value': _money(summary['creditOut']),
        'sub': '${_number(summary['creditCustomerCount']).toInt()} customers',
        'icon': '🔴'
      },
      {
        'label': 'Stock Value',
        'value': _money(summary['inventoryValue']),
        'sub': '${_number(summary['activeSkuCount']).toInt()} SKUs',
        'icon': '📦'
      },
      {
        'label': 'Low Stock',
        'value': '${_number(summary['lowStockCount']).toInt()} items',
        'sub': 'Need reorder',
        'icon': '⚠️'
      },
      {
        'label': 'Transactions',
        'value': '${_number(summary['todayTransactionCount']).toInt()}',
        'sub': 'Today',
        'icon': '🧾'
      },
    ];

    final stats = [
      {
        'icon': '📈',
        'value': _money(summary['todayRevenue']),
        'label': "Today's Sales",
        'sub':
            '${_number(summary['todayTransactionCount']).toInt()} transactions',
        'bg': const LinearGradient(colors: [navy, Color(0xFF1A4FBF)])
      },
      {
        'icon': '💰',
        'value': _money(summary['todayProfit']),
        'label': "Today's Net Profit",
        'sub':
            '${_number(summary['profitMarginPercentage']).toStringAsFixed(1)}% margin',
        'bg':
            const LinearGradient(colors: [Color(0xFF2E7D32), Color(0xFF388E3C)])
      },
      {
        'icon': '💵',
        'value': _money(summary['cashInTill']),
        'label': 'Cash in Till',
        'sub': 'Open sessions',
        'bg': const LinearGradient(colors: [gold, Color(0xFFF0D060)])
      },
      {
        'icon': '📱',
        'value': _money(mpesa['amount']),
        'label': 'M-Pesa Sales',
        'sub': '${_number(mpesa['transactions']).toInt()} transactions',
        'bg':
            const LinearGradient(colors: [Color(0xFF005F2E), Color(0xFF00A651)])
      },
    ];

    final topProducts = _dashboard.topProducts
        .map((item) => {
              'name': item['name']?.toString() ?? 'Product',
              'sold': _number(item['units']).toInt(),
              'revenue': _money(item['revenue']),
              'change': 'Today',
            })
        .toList();

    final recentTx = _dashboard.recentTransactions.map((item) {
      final method = item['method']?.toString() ?? 'Unknown';
      return {
        'time': _friendlyTransactionTime(item['time']),
        'customer': item['customer']?.toString() ?? 'Walk-in',
        'amount': _money(item['amount']),
        'method': method,
        'items': _number(item['items']).toInt(),
        'icon': method == 'M-Pesa'
            ? '📱'
            : method == 'Credit'
                ? '📝'
                : '💵',
        'color': method == 'M-Pesa'
            ? const Color(0xFFE8F5E9)
            : method == 'Credit'
                ? const Color(0xFFFFEBEE)
                : const Color(0xFFE3EAF8),
      };
    }).toList();

    final scanActivity = _dashboard.scanActivity;
    final scanCounts = scanActivity['counts'] is Map
        ? scanActivity['counts'] as Map
        : const <dynamic, dynamic>{};
    final recentScans = (scanActivity['recent'] as List? ?? const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList()
      ..sort((left, right) {
        final leftTime =
            DateTime.tryParse(left['createdAt']?.toString() ?? '') ??
                DateTime(0);
        final rightTime =
            DateTime.tryParse(right['createdAt']?.toString() ?? '') ??
                DateTime(0);
        return rightTime.compareTo(leftTime);
      });

    return Column(
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
                      children: [
                        Text('${_dashboard.metadata['date'] ?? ''}',
                            style: TextStyle(
                                color: Color(0x99FFFFFF),
                                fontSize: 12,
                                fontWeight: FontWeight.w500)),
                        SizedBox(height: 2),
                        Text('Welcome, $_userName',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w800)),
                        SizedBox(height: 2),
                        Text(
                            '${_dashboard.metadata['name'] ?? 'MobiDuka Store'} · Live data',
                            style: TextStyle(
                                color: Color(0xFFE7C75B),
                                fontSize: 12,
                                fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      InkWell(
                        onTap: widget.onOpenNotifications,
                        borderRadius: BorderRadius.circular(12),
                        child: Ink(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Stack(
                            clipBehavior: Clip.none,
                            alignment: Alignment.center,
                            children: [
                              const Icon(Icons.notifications_none_rounded,
                                  color: Colors.white, size: 18),
                              if (_unreadNotifications > 0)
                                Positioned(
                                  top: -5,
                                  right: -5,
                                  child: Container(
                                    constraints:
                                        const BoxConstraints(minWidth: 18),
                                    height: 18,
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 4),
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFD32F2F),
                                      borderRadius: BorderRadius.circular(99),
                                    ),
                                    child: Text(
                                      _unreadNotifications > 99
                                          ? '99+'
                                          : '$_unreadNotifications',
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w800),
                                    ),
                                  ),
                                ),
                            ],
                          ),
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
                        child: const Icon(Icons.more_horiz,
                            color: Colors.white, size: 18),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 82,
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
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.12),
                            width: 1),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${item['icon']} ${item['label']}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Color(0x99FFFFFF), fontSize: 11),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item['value'] as String,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            item['sub'] as String,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Color(0x66FFFFFF), fontSize: 10),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
            children: [
              Padding(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    if (_loading) const LinearProgressIndicator(color: gold),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(_error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                color: Color(0xFFD32F2F), fontSize: 12)),
                      ),
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 1.42,
                      children: stats.map((item) {
                        final bg = item['bg'] as LinearGradient;
                        return Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            gradient: bg,
                            borderRadius: BorderRadius.circular(12),
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
                                  Text(item['icon'] as String,
                                      style: const TextStyle(fontSize: 22)),
                                  const Spacer(),
                                  Text(item['value'] as String,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w800,
                                          fontSize: 15)),
                                  const SizedBox(height: 2),
                                  Text(item['label'] as String,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          color: Color(0xCCFFFFFF),
                                          fontSize: 10)),
                                  const SizedBox(height: 2),
                                  Text(item['sub'] as String,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),
                    if (false)
                      Container(
                        clipBehavior: Clip.antiAlias,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: const [
                            BoxShadow(
                                color: Color(0x11000000),
                                blurRadius: 8,
                                offset: Offset(0, 2))
                          ],
                        ),
                        child: Column(
                          children: [
                            Container(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 14, 16, 14),
                              decoration: const BoxDecoration(
                                  gradient:
                                      LinearGradient(colors: [ink, navy])),
                              child: Row(
                                children: [
                                  Container(
                                    width: 38,
                                    height: 38,
                                    decoration: BoxDecoration(
                                      color: gold.withValues(alpha: 0.20),
                                      borderRadius: BorderRadius.circular(11),
                                      border: Border.all(
                                          color: gold.withValues(alpha: 0.4)),
                                    ),
                                    child: const Icon(
                                        Icons.qr_code_scanner_rounded,
                                        color: gold,
                                        size: 20),
                                  ),
                                  const SizedBox(width: 12),
                                  const Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Text('SmartScan™',
                                                style: TextStyle(
                                                    color: Colors.white,
                                                    fontSize: 13,
                                                    fontWeight:
                                                        FontWeight.w700)),
                                            SizedBox(width: 7),
                                            DecoratedBox(
                                              decoration: BoxDecoration(
                                                  color: Color(0x40D4AF37),
                                                  borderRadius:
                                                      BorderRadius.all(
                                                          Radius.circular(99))),
                                              child: Padding(
                                                padding: EdgeInsets.symmetric(
                                                    horizontal: 8, vertical: 2),
                                                child: Text('QUICK ACTION',
                                                    style: TextStyle(
                                                        color: gold,
                                                        fontSize: 9,
                                                        fontWeight:
                                                            FontWeight.w700,
                                                        letterSpacing: 0.5)),
                                              ),
                                            ),
                                          ],
                                        ),
                                        SizedBox(height: 2),
                                        Text(
                                            'Scan any product barcode instantly',
                                            style: TextStyle(
                                                color: Color(0x99FFFFFF),
                                                fontSize: 11)),
                                      ],
                                    ),
                                  ),
                                  FilledButton(
                                    onPressed: _openSmartScan,
                                    style: FilledButton.styleFrom(
                                      backgroundColor: gold,
                                      foregroundColor: ink,
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 14, vertical: 8),
                                      minimumSize: const Size(0, 0),
                                    ),
                                    child: const Text('Scan',
                                        style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700)),
                                  ),
                                ],
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Row(
                                children: [
                                  _scanMetric(
                                      '${_number(scanCounts['FOUND']).toInt()}',
                                      'Barcodes',
                                      navy),
                                  _scanMetric(
                                      '${_number(scanCounts['UNKNOWN']).toInt()}',
                                      'Unknown',
                                      const Color(0xFFD32F2F)),
                                  _scanMetric(
                                      '${_number(scanCounts['MANUAL']).toInt()}',
                                      'Manual',
                                      muted,
                                      isLast: true),
                                ],
                              ),
                            ),
                            const Divider(height: 1, color: Color(0xFFE8ECF3)),
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('RECENT SCANS',
                                      style: TextStyle(
                                          color: muted,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 0.5)),
                                  const SizedBox(height: 8),
                                  if (recentScans.isEmpty)
                                    const Padding(
                                      padding: EdgeInsets.only(bottom: 8),
                                      child: Text('No scans recorded yet.',
                                          style: TextStyle(
                                              color: muted, fontSize: 12)),
                                    ),
                                  ...recentScans
                                      .take(10)
                                      .toList()
                                      .asMap()
                                      .entries
                                      .map((entry) {
                                    final scan = entry.value;
                                    final isUnknown =
                                        scan['status']?.toString() == 'UNKNOWN';
                                    final name = scan['name']?.toString() ??
                                        (isUnknown
                                            ? 'Unknown Product'
                                            : 'Product');
                                    return InkWell(
                                      onTap: _openSmartScan,
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 7),
                                        child: Row(
                                          children: [
                                            Container(
                                              width: 32,
                                              height: 32,
                                              decoration: BoxDecoration(
                                                  color: isUnknown
                                                      ? const Color(0xFFFFEBEE)
                                                      : const Color(0xFFE3EAF8),
                                                  borderRadius:
                                                      BorderRadius.circular(9)),
                                              child: Center(
                                                  child: Text(
                                                      scan['emoji']
                                                              ?.toString() ??
                                                          (isUnknown
                                                              ? '❓'
                                                              : '📦'),
                                                      style: const TextStyle(
                                                          fontSize: 15))),
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(name,
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: TextStyle(
                                                          color: isUnknown
                                                              ? const Color(
                                                                  0xFFC62828)
                                                              : ink,
                                                          fontSize: 12,
                                                          fontWeight:
                                                              FontWeight.w600)),
                                                  Text(
                                                      scan['barcode']
                                                              ?.toString() ??
                                                          '',
                                                      style: const TextStyle(
                                                          color: muted,
                                                          fontSize: 10,
                                                          fontFamily:
                                                              'monospace')),
                                                ],
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Text(
                                                _friendlyTransactionTime(
                                                    scan['createdAt']),
                                                style: const TextStyle(
                                                    color: Color(0xFF9AA6BA),
                                                    fontSize: 10)),
                                          ],
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
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: const [
                          BoxShadow(
                              color: Color(0x11000000),
                              blurRadius: 8,
                              offset: Offset(0, 2))
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Quick Actions',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: ink)),
                          const SizedBox(height: 14),
                          GridView.count(
                            crossAxisCount: 4,
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            mainAxisSpacing: 10,
                            crossAxisSpacing: 10,
                            childAspectRatio: 0.72,
                            children: [
                              {
                                'label': 'New Sale',
                                'icon': '🛒',
                                'color': navy,
                                'screen': 'pos'
                              },
                              {
                                'label': 'Add Stock',
                                'icon': '📦',
                                'color': const Color(0xFF2E7D32),
                                'screen': 'inventory'
                              },
                              {
                                'label': 'Add Expense',
                                'icon': '💸',
                                'color': const Color(0xFFD32F2F),
                                'screen': 'expenses'
                              },
                              {
                                'label': 'View Report',
                                'icon': '📊',
                                'color': gold,
                                'screen': 'reports'
                              },
                            ].map((item) {
                              final color = item['color'] as Color;
                              return Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: () => widget
                                      .onQuickAction(item['screen'] as String),
                                  borderRadius: BorderRadius.circular(14),
                                  child: Ink(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 4, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: color.withValues(alpha: 0.08),
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    child: Column(
                                      children: [
                                        Container(
                                          width: 42,
                                          height: 42,
                                          decoration: BoxDecoration(
                                            color:
                                                color.withValues(alpha: 0.12),
                                            borderRadius:
                                                BorderRadius.circular(12),
                                          ),
                                          child: Center(
                                              child: Text(
                                                  item['icon'] as String,
                                                  style: const TextStyle(
                                                      fontSize: 20))),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          item['label'] as String,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w600,
                                              color: color,
                                              height: 1.2),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
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
                        boxShadow: const [
                          BoxShadow(
                              color: Color(0x11000000),
                              blurRadius: 8,
                              offset: Offset(0, 2))
                        ],
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              const Expanded(
                                  child: Text('Top Selling Today',
                                      style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                          color: ink))),
                              TextButton(
                                onPressed: () {},
                                child: const Text('See all',
                                    style: TextStyle(
                                        color: navy,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          if (topProducts.isEmpty)
                            const Padding(
                              padding: EdgeInsets.fromLTRB(4, 16, 4, 4),
                              child: Center(
                                child: Text(
                                  'No completed sales recorded today.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: muted, fontSize: 12),
                                ),
                              ),
                            ),
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
                                      gradient: LinearGradient(
                                          colors: [navy, Color(0xFF1A4FBF)]),
                                      borderRadius:
                                          BorderRadius.all(Radius.circular(10)),
                                    ),
                                    child: Center(
                                        child: Text('${i + 1}',
                                            style: const TextStyle(
                                                color: Colors.white,
                                                fontWeight: FontWeight.w700,
                                                fontSize: 13))),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(p['name'] as String,
                                            maxLines: 1,
                                            style: const TextStyle(
                                                color: ink,
                                                fontWeight: FontWeight.w600,
                                                fontSize: 13),
                                            overflow: TextOverflow.ellipsis),
                                        const SizedBox(height: 2),
                                        Text('${p['sold']} units sold',
                                            style: const TextStyle(
                                                color: muted, fontSize: 11)),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  SizedBox(
                                    width: 74,
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(p['revenue'] as String,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                                color: ink,
                                                fontWeight: FontWeight.w700,
                                                fontSize: 12)),
                                        const SizedBox(height: 2),
                                        Text(
                                          p['change'] as String,
                                          style: TextStyle(
                                            color: (p['change'] as String)
                                                    .startsWith('+')
                                                ? const Color(0xFF2E7D32)
                                                : const Color(0xFFD32F2F),
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
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
                        boxShadow: const [
                          BoxShadow(
                              color: Color(0x11000000),
                              blurRadius: 8,
                              offset: Offset(0, 2))
                        ],
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              const Expanded(
                                  child: Text('Recent Transactions',
                                      style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                          color: ink))),
                              TextButton(
                                onPressed: () {},
                                child: const Text('View all',
                                    style: TextStyle(
                                        color: navy,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600)),
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
                                    child: Center(
                                        child: Text(item['icon'] as String,
                                            style:
                                                const TextStyle(fontSize: 16))),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(item['customer'] as String,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                                color: ink,
                                                fontWeight: FontWeight.w600,
                                                fontSize: 13)),
                                        const SizedBox(height: 2),
                                        Text(
                                            '${item['items']} items · ${item['time']}',
                                            style: const TextStyle(
                                                color: muted, fontSize: 11)),
                                      ],
                                    ),
                                  ),
                                  SizedBox(
                                    width: 82,
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Text(item['amount'] as String,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                                color: ink,
                                                fontWeight: FontWeight.w700,
                                                fontSize: 13)),
                                        const SizedBox(height: 4),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: badgeColor,
                                            borderRadius:
                                                BorderRadius.circular(999),
                                          ),
                                          child: Text(
                                            method,
                                            style: TextStyle(
                                                color: badgeTextColor,
                                                fontSize: 10,
                                                fontWeight: FontWeight.w700),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    _smartScanCard(scanCounts, recentScans),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFF8E1),
                        borderRadius: BorderRadius.all(Radius.circular(16)),
                        border: Border.fromBorderSide(
                            BorderSide(color: Color(0xFFFFE082))),
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
                                  children: [
                                    Text(
                                        '${_number(summary['lowStockCount']).toInt()} Items Low on Stock',
                                        style: const TextStyle(
                                            color: Color(0xFF5D4037),
                                            fontSize: 13,
                                            fontWeight: FontWeight.w700)),
                                    SizedBox(height: 2),
                                    Text('Action needed before end of day',
                                        style: TextStyle(
                                            color: Color(0xFF8D6E63),
                                            fontSize: 11)),
                                  ],
                                ),
                              ),
                              TextButton(
                                onPressed: () {},
                                style: TextButton.styleFrom(
                                  backgroundColor: const Color(0xFFF9A825),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 8),
                                  minimumSize: const Size(0, 0),
                                ),
                                child: const Text('View',
                                    style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          ..._dashboard.lowStockItems
                              .take(10)
                              .toList()
                              .asMap()
                              .entries
                              .map((entry) {
                            final i = entry.key;
                            final item = entry.value;
                            return Padding(
                              padding: EdgeInsets.only(top: i > 0 ? 6 : 0),
                              child: Row(
                                children: [
                                  Container(
                                      width: 6,
                                      height: 6,
                                      decoration: const BoxDecoration(
                                          color: Color(0xFFF9A825),
                                          shape: BoxShape.circle)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                      child: Text(
                                          item['name']?.toString() ?? 'Product',
                                          style: const TextStyle(
                                              color: Color(0xFF5D4037),
                                              fontSize: 12))),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFEDB3),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                        '${_number(item['quantity']).toInt()} left',
                                        style: const TextStyle(
                                            color: Color(0xFF5D4037),
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700)),
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
  Widget build(BuildContext context) => Card(
      color: navy,
      child: Padding(
          padding: const EdgeInsets.all(12),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(icon, style: const TextStyle(fontSize: 20)),
            const Spacer(),
            Text(value,
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w800)),
            Text(label,
                style: const TextStyle(color: Colors.white70, fontSize: 11)),
            Text(subtitle,
                style: const TextStyle(color: Colors.white, fontSize: 10))
          ])));
}

class ActionIcon extends StatelessWidget {
  const ActionIcon(this.icon, this.label);
  final String icon, label;
  @override
  Widget build(BuildContext context) => Column(children: [
        Text(icon, style: const TextStyle(fontSize: 25)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 10))
      ]);
}

class Section extends StatelessWidget {
  const Section({required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style:
                    const TextStyle(color: ink, fontWeight: FontWeight.w800)),
            const SizedBox(height: 5),
            child
          ])));
}

class POSScreen extends StatefulWidget {
  const POSScreen({super.key});

  @override
  State<POSScreen> createState() => _POSScreenState();
}

class _POSScreenState extends State<POSScreen> {
  final AuthService _authService = AuthService();
  final CreditService _creditService = CreditService.instance;
  final CustomerService _customerService = CustomerService();
  final SyncService _syncService = SyncService();
  final MpesaService _mpesaService = MpesaService();
  final SmsWatcherService _smsWatcherService = SmsWatcherService();
  final PrinterService _printerService = PrinterService();
  final TextEditingController _mpesaPhoneController =
      TextEditingController(text: '254');
  List<BluetoothDevice> _pairedPrinters = const [];
  BluetoothDevice? _selectedPrinter;
  bool _isSearchingPrinters = false;
  String search = '';
  String category = 'All';
  String paymentMethod = 'cash';
  CreditAccount? _selectedCreditAccount;
  Map<String, dynamic> _lastReceiptSnapshot = const {};
  bool _mpesaRequestPending = false;
  String? _receiptToken;
  String? _completedSaleId;
  String? _receiptNumber;
  DateTime? _completedAt;
  List<Map<String, dynamic>> _completedSaleItems = const [];
  int _completedSubtotal = 0;
  int _completedDiscountAmount = 0;
  int _completedTotal = 0;
  int _completedDiscount = 0;
  String _completedPaymentMethod = 'cash';
  int discount = 0;
  String view = 'pos';
  bool showProductTiles = true;

  // Derive filters from the server-backed catalogue, like the web POS does.
  List<String> get categories => <String>[
        'All',
        ...products
            .map((product) => product.category)
            .where((name) => name.isNotEmpty && name != 'Uncategorized')
            .toSet(),
      ];

  final Map<String, int> cart = {};

  @override
  void initState() {
    super.initState();
    _loadPairedPrinters();
  }

  Future<void> _loadPairedPrinters() async {
    if (mounted) setState(() => _isSearchingPrinters = true);
    try {
      final printers = await _printerService.getPairedDevices();
      if (!mounted) return;
      setState(() {
        _pairedPrinters = printers;
        _selectedPrinter = printers.isEmpty ? null : printers.first;
      });
    } catch (_) {
      // Bluetooth may be unavailable on simulators or unsupported devices.
    } finally {
      if (mounted) setState(() => _isSearchingPrinters = false);
    }
  }

  Future<void> _openBarcodeScanner() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => SmartScanScreen(
          onProductScanned: addToCartAndOpenCart,
        ),
      ),
    );
  }

  void _printReceiptInBackground() {
    final printer = _selectedPrinter;
    if (printer == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Pair a Bluetooth printer before printing.')));
      return;
    }

    unawaited(_printerService
        .printReceipt(
      device: printer,
      storeName: 'MobiDuka Store',
      invoiceNo: _completedSaleId ??
          'RCPT-${DateTime.now().millisecondsSinceEpoch % 100000}',
      totalAmount: _completedTotal.toDouble(),
      paymentMode: _completedPaymentMethod == 'mpesa'
          ? 'MPESA (${_receiptToken ?? 'VERIFIED'})'
          : _completedPaymentMethod.toUpperCase(),
      items: receiptItems,
    )
        .then((_) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            backgroundColor: Color(0xFF2E7D32),
            content: Text('Receipt sent to printer.')));
    }).catchError((_) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            backgroundColor: Color(0xFFD32F2F),
            content: Text('Unable to print receipt.')));
    }));
  }

  Future<void> _downloadReceiptPdf() async {
    final receiptNumber = _receiptNumber ?? _receiptToken ?? 'Pending';
    final document = pw.Document();
    final generatedAt = _formatReceiptDate(_completedAt);
    final paymentLabel = _completedPaymentMethod == 'mpesa'
        ? 'M-Pesa'
        : _completedPaymentMethod == 'credit'
            ? 'Credit'
            : 'Cash';
    final green = pdf.PdfColor.fromInt(0xFF2E7D32);
    final mutedGrey = pdf.PdfColor.fromInt(0xFF6B7A99);
    final inkBlack = pdf.PdfColor.fromInt(0xFF0D1B3D);

    document.addPage(
      pw.Page(
        pageFormat: pdf.PdfPageFormat(
          80 * pdf.PdfPageFormat.mm,
          180 * pdf.PdfPageFormat.mm,
          marginAll: 5 * pdf.PdfPageFormat.mm,
        ),
        build: (context) => pw.Padding(
          padding: pw.EdgeInsets.zero,
          child: pw.Column(
            children: [
              pw.Container(
                width: double.infinity,
                padding:
                    const pw.EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                color: green,
                child: pw.Column(
                  children: [
                    pw.Text('MobiDuka POS',
                        style: pw.TextStyle(
                            color: pdf.PdfColors.white,
                            fontSize: 17,
                            fontWeight: pw.FontWeight.bold)),
                    pw.SizedBox(height: 3),
                    pw.Text('SALE COMPLETE',
                        style: pw.TextStyle(
                            color: pdf.PdfColors.white, fontSize: 10)),
                  ],
                ),
              ),
              pw.SizedBox(height: 10),
              pw.Text('MobiDuka Store · Nairobi CBD',
                  style: pw.TextStyle(
                      color: mutedGrey,
                      fontSize: 9,
                      fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 3),
              pw.Text('Receipt #$receiptNumber',
                  style: pw.TextStyle(
                      color: inkBlack,
                      fontSize: 10,
                      fontWeight: pw.FontWeight.bold)),
              pw.Text(generatedAt,
                  style: pw.TextStyle(color: mutedGrey, fontSize: 9)),
              pw.SizedBox(height: 8),
              pw.Divider(color: pdf.PdfColor.fromInt(0xFFE8ECF4)),
              pw.SizedBox(height: 5),
              ...receiptItems.map(
                (item) => pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 5),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Expanded(
                          child: pw.Text('${item['name']} x ${item['qty']}',
                              style:
                                  pw.TextStyle(color: inkBlack, fontSize: 9))),
                      pw.Text(
                          'KSh ${(item['price'] as int) * (item['qty'] as int)}',
                          style: pw.TextStyle(color: inkBlack, fontSize: 9)),
                    ],
                  ),
                ),
              ),
              pw.Divider(color: pdf.PdfColor.fromInt(0xFFE8ECF4)),
              pw.SizedBox(height: 5),
              pw.Align(
                  alignment: pw.Alignment.centerRight,
                  child: pw.Text('Subtotal  KSh $receiptSubtotal',
                      style: pw.TextStyle(color: mutedGrey, fontSize: 9))),
              if (receiptDiscountAmount > 0)
                pw.Align(
                    alignment: pw.Alignment.centerRight,
                    child: pw.Text('Discount  -KSh $receiptDiscountAmount',
                        style: pw.TextStyle(
                            color: pdf.PdfColors.red, fontSize: 9))),
              pw.SizedBox(height: 4),
              pw.Container(
                width: double.infinity,
                padding:
                    const pw.EdgeInsets.symmetric(vertical: 7, horizontal: 6),
                color: pdf.PdfColor.fromInt(0xFFE8F5E9),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('TOTAL',
                        style: pw.TextStyle(
                            color: inkBlack,
                            fontSize: 11,
                            fontWeight: pw.FontWeight.bold)),
                    pw.Text('KSh $receiptTotal',
                        style: pw.TextStyle(
                            color: green,
                            fontSize: 12,
                            fontWeight: pw.FontWeight.bold)),
                  ],
                ),
              ),
              pw.SizedBox(height: 8),
              pw.Text('Payment: $paymentLabel',
                  style: pw.TextStyle(color: mutedGrey, fontSize: 9)),
              pw.SizedBox(height: 12),
              pw.Text('Thank you for shopping with us.',
                  style: pw.TextStyle(color: mutedGrey, fontSize: 8)),
            ],
          ),
        ),
      ),
    );

    final pdfBytes = await document.save();
    if (kIsWeb) {
      await downloadReceiptPdf(pdfBytes, '$receiptNumber.pdf');
    } else {
      await Printing.sharePdf(bytes: pdfBytes, filename: '$receiptNumber.pdf');
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
          backgroundColor: Color(0xFF2E7D32),
          content: Text('Receipt PDF is ready to download or share.')),
    );
  }

  @override
  void dispose() {
    _smsWatcherService.stopSmsWatcher();
    _mpesaPhoneController.dispose();
    super.dispose();
  }

  void addToCart(Product product) {
    setState(() {
      _upsertProductForCart(product);
      cart[product.name] = (cart[product.name] ?? 0) + 1;
    });
  }

  void addToCartAndOpenCart(Product product) {
    setState(() {
      // A SmartScan lookup can return a product that has not been loaded into
      // the local POS catalogue yet. Cart calculations and rendering resolve
      // items from `products`, so make it available before showing Cart.
      _upsertProductForCart(product);
      cart[product.name] = (cart[product.name] ?? 0) + 1;
      view = 'cart';
    });
  }

  void _upsertProductForCart(Product product) {
    final index = products.indexWhere((item) {
      if (product.barcode != null && item.barcode == product.barcode) {
        return true;
      }
      return item.name == product.name;
    });

    if (index == -1) {
      products.add(product);
    } else {
      products[index] = product;
    }
  }

  void attachCreditAccount(CreditAccount account) {
    setState(() {
      _selectedCreditAccount = account;
      paymentMethod = 'credit';
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content: Text('Customer attached: ${account.customer}'),
          backgroundColor: const Color(0xFF2E7D32)),
    );
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
        final matchesSearch =
            product.name.toLowerCase().contains(search.toLowerCase());
        final matchesCategory =
            category == 'All' || product.category == category;
        return matchesSearch && matchesCategory;
      }).toList();

  int get cartCount => cart.values.fold<int>(0, (sum, count) => sum + count);

  int get subtotal => cart.entries.fold<int>(0, (sum, entry) {
        final product = products.firstWhere((item) => item.name == entry.key);
        return sum + (product.price * entry.value);
      });

  int get discountAmount => (subtotal * discount / 100).round();

  int get total => subtotal - discountAmount;

  Future<CreditAccount?> _selectCreditCustomer() async {
    if (kIsWeb) {
      return _webCreditCustomerSheet();
    }

    final accounts = await _creditService.loadCreditAccounts();
    if (!mounted) return null;
    return _showCreditCustomerSheet(accounts);
  }

  Future<CreditAccount?> _showCreditCustomerSheet(
      List<CreditAccount> accounts) {
    final searchController = TextEditingController();
    return showModalBottomSheet<CreditAccount>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => _CreditCustomerSelectorSheet(
        accounts: accounts,
        searchController: searchController,
        onSelected: (account) => Navigator.of(sheetContext).pop(account),
        onAddCustomer: () async {
          final account = await _onboardCreditCustomer(sheetContext);
          if (account != null && sheetContext.mounted)
            Navigator.of(sheetContext).pop(account);
        },
      ),
    );
  }

  Future<CreditAccount?> _webCreditCustomerSheet() async {
    final nameController = TextEditingController(text: 'Web Preview Customer');
    final name = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.fromLTRB(
            16, 8, 16, MediaQuery.of(sheetContext).viewInsets.bottom + 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Select Credit Customer',
                style: TextStyle(
                    color: ink, fontSize: 19, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            const Text(
                'Enter the customer name for this web preview credit sale.',
                style: TextStyle(color: muted, fontSize: 12)),
            const SizedBox(height: 14),
            TextField(
                controller: nameController,
                autofocus: true,
                decoration: const InputDecoration(
                    labelText: 'Customer name', border: OutlineInputBorder())),
            const SizedBox(height: 14),
            SizedBox(
                width: double.infinity,
                child: FilledButton(
                    onPressed: () => Navigator.of(sheetContext)
                        .pop(nameController.text.trim()),
                    child: const Text('Continue with Customer'))),
          ],
        ),
      ),
    );
    nameController.dispose();
    if (name == null || name.trim().isEmpty) return null;
    return CreditAccount(
        customerId: 'web-preview-credit-customer',
        customer: name.trim(),
        phone: '',
        balance: 0,
        lastTransactionAt: null,
        transactionCount: 0,
        initials: name.trim().substring(0, 1).toUpperCase(),
        colorValue: 0xFFF9A825);
  }

  Future<CreditAccount?> _onboardCreditCustomer(
      BuildContext sheetContext) async {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final result = await showDialog<List<String>>(
      context: sheetContext,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Add Credit Customer'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Customer name')),
          TextField(
              controller: phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone number')),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(
                  [nameController.text.trim(), phoneController.text.trim()]),
              child: const Text('Add Customer')),
        ],
      ),
    );
    nameController.dispose();
    phoneController.dispose();
    if (result == null || result.first.isEmpty) return null;
    final customerId = await _customerService.onboardOfflineCustomer(
        businessId: 'demo-business', name: result.first, phone: result.last);
    final account = CreditAccount(
        customerId: customerId,
        customer: result.first,
        phone: result.last,
        balance: 0,
        lastTransactionAt: null,
        transactionCount: 0,
        initials: result.first.substring(0, 1).toUpperCase(),
        colorValue: 0xFF123A8F);
    await _creditService.saveCreditAccount(account);
    return account;
  }

  void _openCreditLedgerProfile() {
    final customerId = _lastReceiptSnapshot['customerId']?.toString();
    Navigator.of(context).push(
      PageRouteBuilder<void>(
        pageBuilder: (_, animation, __) => CreditBookScreen(
          onBack: () => Navigator.of(context).pop(),
          initialCustomerId: customerId,
        ),
        transitionsBuilder: (_, animation, __, child) => SlideTransition(
          position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
              .animate(animation),
          child: child,
        ),
      ),
    );
  }

  Future<Map<String, dynamic>> _awaitMpesaConfirmation({
    required String checkoutRequestId,
    required double amount,
    required String phone,
  }) {
    final completer = Completer<Map<String, dynamic>>();
    var finishedSources = 0;
    Map<String, dynamic>? lastFailure;

    void handleResult(Map<String, dynamic> result) {
      if (completer.isCompleted) return;
      if (result['status'] == 'SUCCESS') {
        _smsWatcherService.stopSmsWatcher();
        completer.complete(result);
        return;
      }

      final status = result['status']?.toString();
      if (status == 'FAILED' || status == 'CANCELLED') {
        _smsWatcherService.stopSmsWatcher();
        completer.complete(result);
        return;
      }

      lastFailure = result;
      finishedSources++;
      if (finishedSources == 2) completer.complete(lastFailure!);
    }

    _mpesaService
        .pollTransactionStatus(checkoutRequestId: checkoutRequestId)
        .then(handleResult)
        .catchError((error) {
      handleResult({
        'status': 'FAILED',
        'message': 'Online M-Pesa verification failed: $error'
      });
    });
    _smsWatcherService
        .startSmsIncomingWatcher(
          targetAmount: amount,
          customerPhone: phone,
          onPaymentVerified: (_) {},
        )
        .then((code) => handleResult({
              'status': code == null ? 'TIMEOUT' : 'SUCCESS',
              'receipt': code,
              'message': code == null
                  ? 'Offline SMS verification timed out.'
                  : 'Payment verified from M-Pesa SMS.',
            }))
        .catchError((error) {
      handleResult({
        'status': 'FAILED',
        'message': 'Offline SMS verification failed: $error'
      });
    });

    return completer.future;
  }

  Future<void> _completeSale() async {
    if (cart.isEmpty) return;

    if (paymentMethod == 'credit') {
      _selectedCreditAccount ??= await _selectCreditCustomer();
      if (!mounted || _selectedCreditAccount == null) return;
    }

    if (paymentMethod == 'mpesa') {
      setState(() => _mpesaRequestPending = true);
      final businessId = await _authService.getActiveBusinessId();
      if (!mounted) return;
      if (businessId == null || businessId.isEmpty) {
        setState(() => _mpesaRequestPending = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFFD32F2F),
            content: Text(
                'Your session has no business account. Please sign in again.'),
          ),
        );
        return;
      }
      final result = await _mpesaService.initiateStkPush(
        phoneNumber: _mpesaPhoneController.text,
        amount: total.toDouble(),
        businessId: businessId,
        accountReference: 'MobiDuka POS',
      );
      if (!mounted) return;
      if (result['success'] != true) {
        setState(() => _mpesaRequestPending = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              backgroundColor: const Color(0xFFD32F2F),
              content: Text(
                  result['message'] as String? ?? 'M-Pesa request failed.')),
        );
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            backgroundColor: navy,
            content: Text('Awaiting Customer PIN Entry...')),
      );

      final checkoutRequestId = result['checkoutRequestId'] as String?;
      if (checkoutRequestId == null || checkoutRequestId.isEmpty) {
        setState(() => _mpesaRequestPending = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              backgroundColor: Color(0xFFD32F2F),
              content: Text('M-Pesa did not return a verification ID.')),
        );
        return;
      }

      if (mounted) {
        showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (dialogContext) => const AlertDialog(
            title: Text('Awaiting Customer PIN Entry...'),
            content: Row(
              children: [
                CircularProgressIndicator(color: navy),
                SizedBox(width: 16),
                Expanded(child: Text('Awaiting Customer PIN Entry... (60s)')),
              ],
            ),
          ),
        );
      }

      final confirmation = await _awaitMpesaConfirmation(
        checkoutRequestId: checkoutRequestId,
        amount: total.toDouble(),
        phone: _mpesaPhoneController.text,
      );
      if (!mounted) return;
      _smsWatcherService.stopSmsWatcher();
      if (Navigator.of(context).canPop()) Navigator.of(context).pop();
      setState(() => _mpesaRequestPending = false);
      if (confirmation['status'] != 'SUCCESS') {
        await showDialog<void>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Payment not confirmed',
                style: TextStyle(color: Color(0xFFD32F2F))),
            content: Text(confirmation['message'] as String? ??
                'Neither M-Pesa confirmation source verified this payment.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('Keep Cart'),
              ),
            ],
          ),
        );
        return;
      }
      _receiptToken = confirmation['receipt']?.toString() ?? 'MPESA_VERIFIED';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            backgroundColor: const Color(0xFF2E7D32),
            content: Text('Payment verified · Receipt ${_receiptToken!}')),
      );
    }

    final saleId = 'sale-${DateTime.now().millisecondsSinceEpoch}';
    final receiptNumber = 'RCPT-${saleId.substring(5)}';
    final saleItems = cartItems;
    final saleSubtotal = subtotal;
    final saleDiscountAmount = discountAmount;
    final saleTotal = total;
    final saleDiscount = discount;
    final salePaymentMethod = paymentMethod;
    final creditAccount = _selectedCreditAccount;
    final creditUpdatedAccount = salePaymentMethod == 'credit' && !kIsWeb
        ? await _creditService.recordOfflineCreditSale(
            customerId: creditAccount!.customerId,
            amount: saleTotal.toDouble(),
            invoiceNo: receiptNumber,
          )
        : salePaymentMethod == 'credit'
            ? creditAccount!.copyWith(
                balance: creditAccount.balance + saleTotal,
                lastTransactionAt: DateTime.now().toIso8601String(),
                transactionCount: creditAccount.transactionCount + 1,
              )
            : null;
    if (salePaymentMethod == 'credit' && creditUpdatedAccount == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            backgroundColor: Color(0xFFD32F2F),
            content: Text('Unable to update the customer credit ledger.')),
      );
      return;
    }
    if (salePaymentMethod == 'credit') {
      _lastReceiptSnapshot = {
        'invoiceNo': receiptNumber,
        'paymentMethod': 'STORE CREDIT',
        'customerId': creditAccount!.customerId,
        'customerName': creditAccount.customer,
        'outstandingBalance': creditUpdatedAccount!.balance,
      };
    } else {
      _lastReceiptSnapshot = const {};
    }
    final salePayload = {
      'id': saleId,
      'businessId': 'demo-business',
      'deviceId': 'mobile-device',
      'userId': 'demo-owner',
      'paymentMethod': salePaymentMethod,
      'customerId': creditAccount?.customerId,
      'saleNumber': receiptNumber,
      'paymentStatus': 'COMPLETED',
      'saleStatus': 'COMPLETED',
      'discount': saleDiscountAmount,
      'subtotal': saleSubtotal,
      'total': saleTotal,
      'mpesaRef': _receiptToken,
      'items': saleItems.map((item) {
        return {
          'name': item['name'],
          'price': item['price'],
          'qty': item['qty'],
        };
      }).toList(),
      'createdAt': DateTime.now().toIso8601String(),
    };

    if (salePaymentMethod == 'credit' && !kIsWeb) {
      await _syncService.queueChange(
        id: 'credit-sale-$receiptNumber',
        entityName: 'Credit',
        operation: 'CREATE',
        payload: {
          'id': 'credit-sale-$receiptNumber',
          'action': 'RECORD_SALE',
          'businessId': 'demo-business',
          'customerId': creditAccount!.customerId,
          'amount': saleTotal,
          'invoiceNo': receiptNumber,
        },
      );
    }

    if (!kIsWeb) {
      await _syncService.queueChange(
        id: saleId,
        entityName: 'Sale',
        operation: 'CREATE',
        payload: salePayload,
      );
    }

    for (final entry in cart.entries) {
      final index = products.indexWhere((item) => item.name == entry.key);
      if (index == -1) continue;
      final product = products[index];
      final updatedStock = product.stock - entry.value;
      products[index] = Product(
        product.name,
        product.category,
        product.cost,
        product.price,
        updatedStock < 0 ? 0 : updatedStock,
        product.reorder,
        product.emoji,
        status: updatedStock <= product.reorder ? 'low' : 'good',
      );
    }

    if (!kIsWeb) {
      await ProductRepository.instance.saveProducts(products);
      await _syncService.processCloudSync(
        businessId: 'demo-business',
        deviceId: 'mobile-device',
        userId: 'demo-owner',
      );
    }

    if (mounted) {
      setState(() {
        _completedSaleId = saleId;
        _receiptNumber = receiptNumber;
        _completedAt = DateTime.now();
        _completedSaleItems = saleItems;
        _completedSubtotal = saleSubtotal;
        _completedDiscountAmount = saleDiscountAmount;
        _completedTotal = saleTotal;
        _completedDiscount = saleDiscount;
        _completedPaymentMethod = salePaymentMethod;
        _selectedCreditAccount = null;
        cart.clear();
        discount = 0;
        view = 'receipt';
      });
    }
  }

  List<Map<String, dynamic>> get cartItems => cart.entries.map((entry) {
        final product = products.firstWhere((item) => item.name == entry.key);
        return {
          'name': product.name,
          'price': product.price,
          'qty': entry.value,
          'emoji': product.emoji,
        };
      }).toList();

  List<Map<String, dynamic>> get receiptItems => _completedSaleItems;

  int get receiptSubtotal => _completedSubtotal;

  int get receiptDiscountAmount => _completedDiscountAmount;

  int get receiptTotal => _completedTotal;

  String _formatReceiptDate(DateTime? value) {
    final date = value ?? DateTime.now();
    const months = <String>[
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
      'Dec',
    ];
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '${date.day} ${months[date.month - 1]} ${date.year}, $hour:$minute';
  }

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
            Text(value,
                style: TextStyle(
                    color: tint, fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 3),
            Text(label,
                style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 10)),
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

  Widget _productViewButton({
    required IconData icon,
    required bool selected,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? navy : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon,
              size: 18,
              color: selected ? Colors.white : const Color(0xFF61708B)),
        ),
      ),
    );
  }

  Widget _productTile(Product product) {
    final quantity = cart[product.name] ?? 0;
    final lowStock = product.stock <= 5;

    return InkWell(
      onTap: () => addToCart(product),
      borderRadius: BorderRadius.circular(16),
      child: Ink(
        // Matches the web tile's compact 10px rhythm while leaving room for
        // the stock label.
        padding: const EdgeInsets.fromLTRB(10, 10, 10, 9),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: quantity > 0 ? Border.all(color: navy, width: 2) : null,
          boxShadow: const [
            BoxShadow(
              color: Color(0x0F000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Stack(
          children: [
            if (lowStock)
              const Positioned(
                top: 0,
                right: 0,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Color(0xFFF9A825),
                    shape: BoxShape.circle,
                  ),
                  child: SizedBox(width: 8, height: 8),
                ),
              ),
            if (quantity > 0)
              Positioned(
                top: 0,
                left: 0,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: navy,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '×$quantity',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child:
                      Text(product.emoji, style: const TextStyle(fontSize: 28)),
                ),
                const Spacer(),
                Text(
                  product.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      color: ink, fontSize: 11, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text('KSh ${product.price}',
                    style: const TextStyle(
                        color: navy,
                        fontSize: 13,
                        fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(
                  lowStock
                      ? 'Low: ${product.stock}'
                      : '${product.stock} in stock',
                  style: TextStyle(
                    color: lowStock ? const Color(0xFFF9A825) : muted,
                    fontSize: 10,
                    fontWeight: lowStock ? FontWeight.w700 : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _paymentOption(
      String key, String label, String subtitle, String icon, Color color,
      {VoidCallback? onTap}) {
    final selected = paymentMethod == key;
    return GestureDetector(
      onTap: onTap ?? () => setState(() => paymentMethod = key),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.10) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: selected ? color : const Color(0xFFE8ECF4),
              width: selected ? 2 : 1.2),
          boxShadow: const [
            BoxShadow(
                color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))
          ],
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
              child: Center(
                  child: Text(icon, style: const TextStyle(fontSize: 20))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          color: ink,
                          fontSize: 15,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 3),
                  Text(subtitle,
                      style: const TextStyle(color: muted, fontSize: 11)),
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
                gradient: LinearGradient(
                    colors: [Color(0xFF2E7D32), Color(0xFF388E3C)]),
              ),
              child: Column(
                children: [
                  const Text('✅', style: TextStyle(fontSize: 48)),
                  const SizedBox(height: 8),
                  const Text('Sale Complete!',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(
                      'Receipt #${_receiptNumber ?? _receiptToken ?? 'Pending'}',
                      style: const TextStyle(
                          color: Color(0xCCFFFFFF), fontSize: 13)),
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
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      children: [
                        const Text('MobiDuka Store · Nairobi CBD',
                            style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        Text(_formatReceiptDate(_completedAt),
                            style: const TextStyle(color: muted, fontSize: 11)),
                        const SizedBox(height: 18),
                        const Divider(color: Color(0xFFE8ECF4), thickness: 1),
                        const SizedBox(height: 12),
                        ...receiptItems.map((item) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Row(
                                children: [
                                  Expanded(
                                      child: Text(
                                          '${item['name']} × ${item['qty']}',
                                          style: const TextStyle(
                                              color: ink,
                                              fontSize: 13,
                                              fontWeight: FontWeight.w600))),
                                  Text(
                                      'KSh ${(item['price'] as int) * (item['qty'] as int)}',
                                      style: const TextStyle(
                                          color: ink,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700)),
                                ],
                              ),
                            )),
                        const SizedBox(height: 12),
                        const Divider(color: Color(0xFFE8ECF4), thickness: 1),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Subtotal',
                                style: TextStyle(color: muted, fontSize: 13)),
                            Text('KSh $receiptSubtotal',
                                style: const TextStyle(
                                    color: ink,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        if (receiptDiscountAmount > 0)
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Discount ($_completedDiscount%)',
                                  style: const TextStyle(
                                      color: Color(0xFFD32F2F),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700)),
                              Text('-KSh $receiptDiscountAmount',
                                  style: const TextStyle(
                                      color: Color(0xFFD32F2F),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700)),
                            ],
                          ),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('TOTAL',
                                style: TextStyle(
                                    color: ink,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800)),
                            Text('KSh $receiptTotal',
                                style: const TextStyle(
                                    color: navy,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800)),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Payment',
                                style: TextStyle(color: muted, fontSize: 12)),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(999),
                                color: _completedPaymentMethod == 'mpesa'
                                    ? const Color(0xFFE8F5E9)
                                    : _completedPaymentMethod == 'credit'
                                        ? const Color(0xFFFFEBEE)
                                        : const Color(0xFFE3EAF8),
                              ),
                              child: Text(
                                _completedPaymentMethod == 'mpesa'
                                    ? 'M-Pesa'
                                    : _completedPaymentMethod == 'credit'
                                        ? 'Credit'
                                        : 'Cash',
                                style: TextStyle(
                                  color: _completedPaymentMethod == 'mpesa'
                                      ? const Color(0xFF2E7D32)
                                      : _completedPaymentMethod == 'credit'
                                          ? const Color(0xFFD32F2F)
                                          : navy,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (_lastReceiptSnapshot['paymentMethod'] ==
                            'STORE CREDIT') ...[
                          const SizedBox(height: 14),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF8E1),
                              borderRadius: BorderRadius.circular(12),
                              border:
                                  Border.all(color: const Color(0xFFFFE082)),
                            ),
                            child: Text(
                              'KSh $receiptTotal added to ${_lastReceiptSnapshot['customerName']}\'s ledger. Outstanding balance: KSh ${(_lastReceiptSnapshot['outstandingBalance'] as num).toStringAsFixed(0)}.',
                              style: const TextStyle(
                                  color: Color(0xFF8D6E63),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _isSearchingPrinters
                            ? const LinearProgressIndicator(color: navy)
                            : _pairedPrinters.isEmpty
                                ? const Text('No paired printers found',
                                    style:
                                        TextStyle(color: muted, fontSize: 12))
                                : const SizedBox.shrink(),
                      ),
                      IconButton(
                        tooltip: 'Refresh paired printers',
                        onPressed:
                            _isSearchingPrinters ? null : _loadPairedPrinters,
                        icon:
                            const Icon(Icons.refresh, color: Color(0xFF2E7D32)),
                      ),
                    ],
                  ),
                  if (_pairedPrinters.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    DropdownButtonFormField<BluetoothDevice>(
                      value: _selectedPrinter,
                      decoration: const InputDecoration(
                          labelText: 'Receipt printer',
                          prefixIcon: Icon(Icons.print_outlined),
                          border: OutlineInputBorder()),
                      items: _pairedPrinters
                          .map((printer) => DropdownMenuItem(
                              value: printer,
                              child: Text(printer.name.isEmpty
                                  ? 'Bluetooth printer'
                                  : printer.name)))
                          .toList(),
                      onChanged: (printer) =>
                          setState(() => _selectedPrinter = printer),
                    ),
                    const SizedBox(height: 10),
                  ],
                  Row(
                    children: [
                      Expanded(
                        child: TextButton.icon(
                          onPressed: _downloadReceiptPdf,
                          icon: const Icon(Icons.picture_as_pdf_outlined,
                              size: 18),
                          label: const Text('Download PDF'),
                          style: TextButton.styleFrom(
                            backgroundColor: const Color(0xFFE8F5E9),
                            foregroundColor: const Color(0xFF2E7D32),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextButton(
                          onPressed: _printReceiptInBackground,
                          style: TextButton.styleFrom(
                            backgroundColor: const Color(0xFFEEF2FF),
                            foregroundColor: navy,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text('Print Receipt',
                              style: TextStyle(
                                  fontSize: 14, fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ),
                  if (_lastReceiptSnapshot['paymentMethod'] ==
                      'STORE CREDIT') ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _openCreditLedgerProfile,
                        icon: const Icon(Icons.menu_book_outlined),
                        label: const Text('View Credit Ledger Profile',
                            style: TextStyle(fontWeight: FontWeight.w800)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF9A825),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextButton(
                          onPressed: () {
                            setState(() {
                              cart.clear();
                              discount = 0;
                              _receiptToken = null;
                              _completedSaleId = null;
                              _receiptNumber = null;
                              _completedAt = null;
                              _lastReceiptSnapshot = const {};
                              _completedSaleItems = const [];
                              view = 'pos';
                              paymentMethod = 'cash';
                            });
                          },
                          style: TextButton.styleFrom(
                            backgroundColor: navy,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text('New Sale',
                              style: TextStyle(
                                  fontSize: 14, fontWeight: FontWeight.w700)),
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
                  const Text('Payment',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800)),
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
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      children: [
                        const Text('Total Amount Due',
                            style: TextStyle(color: muted, fontSize: 12)),
                        const SizedBox(height: 8),
                        Text('KSh $total',
                            style: const TextStyle(
                                color: Color(0xFFD4AF37),
                                fontSize: 36,
                                fontWeight: FontWeight.w900)),
                        const SizedBox(height: 6),
                        Text('$cartCount items',
                            style: const TextStyle(color: muted, fontSize: 12)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text('Select Payment Method',
                      style: TextStyle(
                          color: muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  _paymentOption(
                      'cash', 'Cash', 'Physical cash payment', '💵', navy),
                  _paymentOption('mpesa', 'M-Pesa', 'Mobile money transfer',
                      '📱', const Color(0xFF2E7D32)),
                  if (paymentMethod == 'mpesa') ...[
                    const SizedBox(height: 2),
                    TextField(
                      controller: _mpesaPhoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Customer phone number',
                        hintText: '2547XXXXXXXX',
                        prefixIcon: Icon(Icons.phone_android),
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  _paymentOption(
                    'credit',
                    'Credit / Tab',
                    'Add to customer account',
                    '📋',
                    const Color(0xFFD32F2F),
                    onTap: () async {
                      setState(() => paymentMethod = 'credit');
                      final account = await _selectCreditCustomer();
                      if (mounted && account == null)
                        setState(() => paymentMethod = 'cash');
                      if (mounted && account != null)
                        setState(() => _selectedCreditAccount = account);
                    },
                  ),
                  const SizedBox(height: 20),
                  const Text('Discount',
                      style: TextStyle(
                          color: muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w800)),
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
                            border: Border.all(
                                color:
                                    selected ? navy : const Color(0xFFE8ECF4)),
                          ),
                          child: Center(
                            child: Text('${value}%',
                                style: TextStyle(
                                    color: selected ? Colors.white : muted,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700)),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 18),
                  TextButton(
                    onPressed: _mpesaRequestPending ? null : _completeSale,
                    style: TextButton.styleFrom(
                      backgroundColor: navy,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    child: _mpesaRequestPending
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2))
                        : Text('Complete Sale · KSh $total',
                            style: const TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (view == 'cart') {
      final hasCartItems = cartItems.isNotEmpty;
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
                  Text('Cart ($cartCount items)',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800)),
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
                          Text('Cart is empty',
                              style: TextStyle(
                                  color: muted,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700)),
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
                            boxShadow: const [
                              BoxShadow(
                                  color: Color(0x0F000000),
                                  blurRadius: 8,
                                  offset: Offset(0, 2))
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                decoration: const BoxDecoration(
                                    color: Color(0xFFE3EAF8),
                                    borderRadius:
                                        BorderRadius.all(Radius.circular(10))),
                                child: Center(
                                    child: Text(item['emoji'] as String,
                                        style: const TextStyle(fontSize: 20))),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(item['name'] as String,
                                        style: const TextStyle(
                                            color: ink,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w800)),
                                    const SizedBox(height: 4),
                                    Text('KSh $price each',
                                        style: const TextStyle(
                                            color: muted, fontSize: 11)),
                                  ],
                                ),
                              ),
                              Row(
                                children: [
                                  InkWell(
                                    onTap: () =>
                                        updateQty(item['name'] as String, -1),
                                    child: Container(
                                      width: 28,
                                      height: 28,
                                      decoration: BoxDecoration(
                                          color: const Color(0xFFF0F3F9),
                                          borderRadius:
                                              BorderRadius.circular(8)),
                                      child: const Center(
                                          child: Icon(Icons.remove,
                                              size: 16, color: ink)),
                                    ),
                                  ),
                                  SizedBox(
                                    width: 28,
                                    child: Center(
                                      child: Text('$qty',
                                          style: const TextStyle(
                                              color: ink,
                                              fontSize: 15,
                                              fontWeight: FontWeight.w800)),
                                    ),
                                  ),
                                  InkWell(
                                    onTap: () =>
                                        updateQty(item['name'] as String, 1),
                                    child: Container(
                                      width: 28,
                                      height: 28,
                                      decoration: BoxDecoration(
                                          color: navy,
                                          borderRadius:
                                              BorderRadius.circular(8)),
                                      child: const Center(
                                          child: Icon(Icons.add,
                                              size: 16, color: Colors.white)),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(width: 12),
                              Text('KSh ${price * qty}',
                                  style: const TextStyle(
                                      color: ink,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800)),
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
                      Text('Subtotal ($cartCount items)',
                          style: const TextStyle(color: muted, fontSize: 14)),
                      Text('KSh $subtotal',
                          style: const TextStyle(
                              color: ink,
                              fontSize: 14,
                              fontWeight: FontWeight.w800)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: hasCartItems ? null : const Color(0xFFE8ECF4),
                        gradient: hasCartItems
                            ? const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [Color(0xFF123A8F), Color(0xFF1A4FBF)],
                              )
                            : null,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: hasCartItems
                            ? const [
                                BoxShadow(
                                  color: Color(0x4D123A8F),
                                  blurRadius: 16,
                                  offset: Offset(0, 4),
                                ),
                              ]
                            : null,
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: hasCartItems
                              ? () => setState(() => view = 'payment')
                              : null,
                          borderRadius: BorderRadius.circular(14),
                          child: Center(
                            child: Text(
                              'Proceed to Payment →',
                              style: TextStyle(
                                color: hasCartItems
                                    ? Colors.white
                                    : const Color(0xFFB0BAD3),
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
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
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.12)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.search,
                                color: Color(0xCCFFFFFF), size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                onChanged: (value) =>
                                    setState(() => search = value),
                                style: const TextStyle(
                                    color: Colors.white, fontSize: 14),
                                decoration: const InputDecoration(
                                  hintText: 'Search products...',
                                  hintStyle:
                                      TextStyle(color: Color(0xCCFFFFFF)),
                                  border: InputBorder.none,
                                  isDense: true,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: _openBarcodeScanner,
                      tooltip: 'Open SmartScan',
                      color: gold,
                      icon: const Icon(Icons.qr_code_scanner),
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
                            const Icon(Icons.shopping_cart_outlined,
                                color: ink, size: 20),
                            if (cartCount > 0)
                              Positioned(
                                right: 8,
                                top: 6,
                                child: Container(
                                  width: 18,
                                  height: 18,
                                  decoration: BoxDecoration(
                                      color: const Color(0xFFD32F2F),
                                      shape: BoxShape.circle),
                                  child: Center(
                                      child: Text('$cartCount',
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 10,
                                              fontWeight: FontWeight.w800))),
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
                    _metricTile(
                        'KSh $subtotal', 'Subtotal', const Color(0xFFE0C35B)),
                    const SizedBox(width: 8),
                    _metricTile('KSh $total', 'Total', const Color(0xFFB8F0C3)),
                  ],
                ),
              ],
            ),
          ),
          Container(
            color: Colors.white,
            height: 48,
            child: Row(
              children: [
                Expanded(
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
                Container(
                  margin: const EdgeInsets.only(right: 12, top: 6, bottom: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0F3F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      _productViewButton(
                        icon: Icons.grid_view_rounded,
                        selected: showProductTiles,
                        tooltip: 'Tile view',
                        onTap: () => setState(() => showProductTiles = true),
                      ),
                      _productViewButton(
                        icon: Icons.view_list_rounded,
                        selected: !showProductTiles,
                        tooltip: 'List view',
                        onTap: () => setState(() => showProductTiles = false),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: showProductTiles
                ? LayoutBuilder(
                    builder: (context, constraints) {
                      // Three cards match the web POS at normal mobile widths.
                      // Compact devices need two wider cards so names, prices,
                      // and stock labels always fit without overflow.
                      final compact = constraints.maxWidth < 360;
                      return GridView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: compact ? 2 : 3,
                          // A fixed height safely accommodates the tallest
                          // two-line names, price, and stock label. Deriving
                          // height from narrow card widths caused overflow.
                          mainAxisExtent: 140,
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                        ),
                        itemCount: visibleProducts.isEmpty
                            ? 1
                            : visibleProducts.length,
                        itemBuilder: (context, index) => visibleProducts.isEmpty
                            ? Center(
                                child: Text(
                                  search.isEmpty && category == 'All'
                                      ? 'No products in your catalogue yet.'
                                      : 'No products match your search.',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                      color: muted, fontSize: 13),
                                ),
                              )
                            : _productTile(visibleProducts[index]),
                      );
                    },
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
                    children: visibleProducts.map((product) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: const [
                            BoxShadow(
                                color: Color(0x0F000000),
                                blurRadius: 8,
                                offset: Offset(0, 2))
                          ],
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: const BoxDecoration(
                                  color: Color(0xFFE3EAF8),
                                  borderRadius:
                                      BorderRadius.all(Radius.circular(12))),
                              child: Center(
                                  child: Text(product.emoji,
                                      style: const TextStyle(fontSize: 22))),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(product.name,
                                      style: const TextStyle(
                                          color: ink,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 4),
                                  Text(product.category,
                                      style: const TextStyle(
                                          color: muted, fontSize: 11)),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('KSh ${product.price}',
                                    style: const TextStyle(
                                        color: ink,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800)),
                                const SizedBox(height: 6),
                                Text(
                                  '${product.stock} in stock',
                                  style: TextStyle(
                                    color: product.stock <= 5
                                        ? const Color(0xFFD32F2F)
                                        : muted,
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
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 12),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10)),
                              ),
                              child: const Text('Add',
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800)),
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
  static const _catalogEmojis = <String>[
    '🌾',
    '🫙',
    '🍬',
    '🧈',
    '🥛',
    '🌶️',
    '💊',
    '🧺',
    '🪥',
    '🍞',
    '🥚',
    '☕',
    '📦',
    '🥤',
    '🍫',
    '🧃',
  ];
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
    'category': '',
    'barcode': '',
    'cost': '',
    'price': '',
    'stock': '',
    'reorder': '',
    'emoji': '📦',
  };
  String newCategoryName = '';
  String newCategoryEmoji = '📦';

  @override
  void initState() {
    super.initState();
    unawaited(_loadApiCategories());
  }

  Future<void> _loadApiCategories() async {
    try {
      final categories = await InventoryApiService().loadCategories();
      if (!mounted) return;
      setState(() {
        inventoryCategories
          ..clear()
          ..addAll(categories.map((category) => category.name));
        inventoryCategoryIds
          ..clear()
          ..addEntries(categories
              .map((category) => MapEntry(category.name, category.id)));
        inventoryCategoryEmojis
          ..clear()
          ..addEntries(categories.map(
              (category) => MapEntry(category.name, category.emoji ?? '📦')));
      });
    } catch (_) {
      // The already loaded catalogue categories remain available offline.
    }
  }

  String _categoryEmoji(String categoryName) {
    final categoryEmoji = inventoryCategoryEmojis[categoryName];
    if (categoryEmoji != null) return categoryEmoji;
    final product = products.where((item) => item.category == categoryName);
    if (product.isNotEmpty) return product.first.emoji;
    const defaults = <String, String>{
      'Flour': '🌾',
      'Oils': '🫙',
      'Sugar': '🍬',
      'Spreads': '🧈',
      'Dairy': '🥛',
      'Spices': '🌶️',
      'Pharma': '💊',
      'Detergent': '🧺',
      'Personal': '🪥',
      'Bakery': '🍞',
      'Beverages': '🥤',
    };
    return defaults[categoryName] ?? '📦';
  }

  int _categoryItemCount(String categoryName) =>
      products.where((product) => product.category == categoryName).length;

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
      ..update('category', (_) => '')
      ..update('barcode', (_) => '')
      ..update('cost', (_) => '')
      ..update('price', (_) => '')
      ..update('stock', (_) => '')
      ..update('reorder', (_) => '')
      ..update('emoji', (_) => '📦');
  }

  Future<void> _saveProduct() async {
    final name = productForm['name']?.trim() ?? '';
    final categoryValue = productForm['category'] ?? '';
    final barcode = productForm['barcode']?.trim();
    final cost = int.tryParse(productForm['cost'] ?? '') ?? 0;
    final price = int.tryParse(productForm['price'] ?? '') ?? 0;
    final stock = int.tryParse(productForm['stock'] ?? '') ?? 0;
    final reorder = int.tryParse(productForm['reorder'] ?? '') ?? 10;
    final emoji = productForm['emoji'] ?? '📦';
    final categoryId = inventoryCategoryIds[categoryValue];
    if (name.isEmpty || categoryId == null) return;
    try {
      if (editProduct == null) {
        await InventoryApiService().createProduct({
          'name': name,
          'categoryId': categoryId,
          'barcode': barcode,
          'costPrice': cost,
          'sellingPrice': price,
          'stock': stock,
          'minimumStock': reorder,
          'emoji': emoji,
        });
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
            backgroundColor: const Color(0xFFD32F2F)));
      }
      return;
    }

    final status = stock == 0
        ? 'critical'
        : stock <= reorder * 0.3
            ? 'critical'
            : stock < reorder
                ? 'low'
                : 'good';

    final nextProduct = Product(
        name, categoryValue, cost, price, stock, reorder, emoji,
        status: status,
        barcode: barcode == null || barcode.isEmpty ? null : barcode);
    setState(() {
      if (editProduct != null) {
        final index = products.indexWhere((item) =>
            item.name == editProduct!.name &&
            item.category == editProduct!.category);
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
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Product saved to the catalogue.'),
        backgroundColor: Color(0xFF2E7D32),
      ));
    }
    unawaited(ProductRepository.instance
        .upsertProduct(nextProduct)
        .catchError((_) {}));
  }

  Future<void> _scanProductCode() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BarcodeScannerView(
          onProductScanned: (_) {},
          onCodeScanned: (code) =>
              setState(() => productForm['barcode'] = code),
        ),
      ),
    );
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
    final visible = products
        .where((p) =>
            (category == 'All' || p.category == category) &&
            p.name.toLowerCase().contains(search.toLowerCase()))
        .toList();
    final cartCount = cart.values.fold(0, (sum, quantity) => sum + quantity);
    final cartTotal = products
        .where((p) => cart.containsKey(p.name))
        .fold(0, (sum, p) => sum + p.price * cart[p.name]!);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 28, 16, 8),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(widget.title,
                style:
                    const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
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
              children: [
                'All',
                'Flour',
                'Oils',
                'Sugar',
                'Dairy',
                'Pharma',
                'Beverages',
                'Spreads',
                'Spices',
                'Bakery'
              ]
                  .map((value) => Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                            label: Text(value),
                            selected: category == value,
                            onSelected: (_) =>
                                setState(() => category = value)),
                      ))
                  .toList(),
            ),
          ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: visible.map((product) {
              return Card(
                child: ListTile(
                  onTap: widget.title == 'Inventory & Stock'
                      ? () => setState(() => selected = product)
                      : null,
                  leading:
                      Text(product.emoji, style: const TextStyle(fontSize: 26)),
                  title: Text(product.name),
                  subtitle: Text('${product.category} · KSh ${product.price}'),
                  trailing: widget.title == 'Point of Sale'
                      ? FilledButton(
                          onPressed: () => setState(() => cart[product.name] =
                              (cart[product.name] ?? 0) + 1),
                          child: Text('KSh ${product.price}'))
                      : Text('${product.stock} in stock',
                          style: TextStyle(
                              color: product.stock <= 5 ? Colors.red : muted,
                              fontWeight: FontWeight.w600)),
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
              title: Text('$cartCount items in cart',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold)),
              subtitle: Text('KSh $cartTotal',
                  style: const TextStyle(color: Colors.white70)),
              trailing: FilledButton.tonal(
                  onPressed: () => _showCheckout(context, cartTotal),
                  child: const Text('Checkout')),
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
      final matchFilter = filter == 'all' ||
          p.status == filter ||
          (filter == 'low' && (p.status == 'low' || p.status == 'critical'));
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
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w800),
                        ),
                        Row(
                          children: [
                            TextButton(
                              onPressed: () =>
                                  setState(() => showAddCategory = true),
                              style: TextButton.styleFrom(
                                backgroundColor:
                                    Colors.white.withValues(alpha: 0.12),
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10)),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 8),
                              ),
                              child: const Text('+ Category',
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700)),
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
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10)),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 8),
                              ),
                              child: const Text('+ Product',
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800)),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        _inventoryMetric(
                            'Total SKUs', '${products.length}', Colors.white),
                        const SizedBox(width: 8),
                        _inventoryMetric('Critical', '$criticalCount',
                            const Color(0xFFFF6B6B)),
                        const SizedBox(width: 8),
                        _inventoryMetric(
                            'Low Stock', '$lowCount', const Color(0xFFFFD93D)),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.14)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: TextField(
                        onChanged: (value) => setState(() => search = value),
                        style:
                            const TextStyle(color: Colors.white, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Search products...',
                          hintStyle: const TextStyle(color: Color(0x99FFFFFF)),
                          prefixIcon: const Icon(Icons.search,
                              color: Color(0xCCFFFFFF)),
                          border: InputBorder.none,
                          contentPadding:
                              const EdgeInsets.symmetric(vertical: 12),
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
                    final label = value == 'all'
                        ? 'All Products'
                        : value == 'low'
                            ? 'Low Stock'
                            : 'Critical';
                    final selected = filter == value;
                    return Expanded(
                      child: InkWell(
                        onTap: () => setState(() => filter = value),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            border: Border(
                                bottom: BorderSide(
                                    color: selected ? navy : Colors.transparent,
                                    width: 2)),
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
                        boxShadow: const [
                          BoxShadow(
                              color: Color(0x0F000000),
                              blurRadius: 8,
                              offset: Offset(0, 2))
                        ],
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
                              child: Center(
                                  child: Text(product.emoji,
                                      style: const TextStyle(fontSize: 22))),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    product.name,
                                    style: const TextStyle(
                                        color: ink,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${product.category} · Cost: KSh ${product.cost}',
                                    style: const TextStyle(
                                        color: muted, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  'KSh ${product.price}',
                                  style: const TextStyle(
                                      color: navy,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: 5),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: badgeColor,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    '${product.stock} units',
                                    style: TextStyle(
                                        color: badgeTextColor,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800),
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
              Text(value,
                  style: TextStyle(
                      color: color, fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 3),
              Text(label,
                  style:
                      const TextStyle(color: Color(0x99FFFFFF), fontSize: 10)),
            ],
          ),
        ),
      );

  Widget _inventoryDetail(Product product) {
    final margin =
        ((product.price - product.cost) / product.price * 100).round();
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
                    const Text('Product Details',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w700)),
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
                      child: Center(
                          child: Text(product.emoji,
                              style: const TextStyle(fontSize: 32))),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(product.name,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800)),
                          const SizedBox(height: 4),
                          Text(product.category,
                              style: const TextStyle(
                                  color: Colors.white60, fontSize: 13)),
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
                    _detailStatCard('Cost Price', 'KSh ${product.cost}',
                        const Color(0xFFD32F2F)),
                    _detailStatCard(
                        'Selling Price', 'KSh ${product.price}', navy),
                    _detailStatCard(
                        'Profit Margin', '$margin%', const Color(0xFF2E7D32)),
                    _detailStatCard('Current Stock', '${product.stock} units',
                        _statusBadgeText(product.status)),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Stock Information',
                          style: TextStyle(
                              color: ink,
                              fontSize: 13,
                              fontWeight: FontWeight.w800)),
                      const SizedBox(height: 12),
                      _stockRow('Reorder Level', '${product.reorder} units'),
                      _stockRow('Stock Status', _statusLabel(product.status)),
                      _stockRow(
                          'Units Below Reorder',
                          product.stock < product.reorder
                              ? '${product.reorder - product.stock} units'
                              : 'None'),
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
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('Edit Product',
                            style: TextStyle(
                                fontSize: 14, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextButton(
                        onPressed: () {},
                        style: TextButton.styleFrom(
                          backgroundColor: navy,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('Purchase Order',
                            style: TextStyle(
                                fontSize: 14, fontWeight: FontWeight.w700)),
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
          boxShadow: const [
            BoxShadow(
                color: Color(0x0F000000), blurRadius: 6, offset: Offset(0, 2))
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: muted, fontSize: 11)),
            const SizedBox(height: 6),
            Text(value,
                style: TextStyle(
                    color: color, fontSize: 20, fontWeight: FontWeight.w800)),
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
            Text(value,
                style: const TextStyle(
                    color: ink, fontSize: 12, fontWeight: FontWeight.w700)),
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
                  const Text('Add Category',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w700)),
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
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Category Name *',
                            style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        TextField(
                          onChanged: (value) =>
                              setState(() => newCategoryName = value),
                          decoration: const InputDecoration(
                            hintText: 'e.g. Beverages',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 18),
                        const Text('Icon / Emoji',
                            style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _catalogEmojis.map((emoji) {
                            final selected = newCategoryEmoji == emoji;
                            return ChoiceChip(
                              label: Text(emoji),
                              selected: selected,
                              onSelected: (_) =>
                                  setState(() => newCategoryEmoji = emoji),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Existing Categories',
                            style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5)),
                        const SizedBox(height: 8),
                        ...inventoryCategories.asMap().entries.map((entry) {
                          final categoryName = entry.value;
                          final isLast =
                              entry.key == inventoryCategories.length - 1;
                          return Container(
                            padding: const EdgeInsets.symmetric(vertical: 9),
                            decoration: BoxDecoration(
                              border: isLast
                                  ? null
                                  : const Border(
                                      bottom:
                                          BorderSide(color: Color(0xFFF0F3F9))),
                            ),
                            child: Row(children: [
                              Text(_categoryEmoji(categoryName),
                                  style: const TextStyle(fontSize: 18)),
                              const SizedBox(width: 9),
                              Expanded(
                                  child: Text(categoryName,
                                      style: const TextStyle(
                                          color: ink,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600))),
                              Text('${_categoryItemCount(categoryName)} items',
                                  style: const TextStyle(
                                      color: muted, fontSize: 11)),
                            ]),
                          );
                        }),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () async {
                      final name = newCategoryName.trim();
                      if (name.isEmpty) return;
                      try {
                        final category = await InventoryApiService()
                            .createCategory(
                                name: name, emoji: newCategoryEmoji);
                        if (!mounted) return;
                        setState(() {
                          inventoryCategories.add(category.name);
                          inventoryCategoryIds[category.name] = category.id;
                          inventoryCategoryEmojis[category.name] =
                              category.emoji ?? '📦';
                          newCategoryName = '';
                          newCategoryEmoji = '📦';
                          showAddCategory = false;
                        });
                        ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content:
                                    Text('Category saved to the catalogue.'),
                                backgroundColor: Color(0xFF2E7D32)));
                      } catch (error) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                              content: Text(error
                                  .toString()
                                  .replaceFirst('Exception: ', '')),
                              backgroundColor: const Color(0xFFD32F2F)));
                        }
                      }
                    },
                    style: TextButton.styleFrom(
                      backgroundColor: navy,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Save Category',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700)),
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
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700),
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
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Product Icon',
                            style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _catalogEmojis.map((emoji) {
                            final selected =
                                (productForm['emoji'] ?? '📦') == emoji;
                            return ChoiceChip(
                              label: Text(emoji,
                                  style: const TextStyle(fontSize: 18)),
                              selected: selected,
                              onSelected: (_) =>
                                  setState(() => productForm['emoji'] = emoji),
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
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Product Details',
                            style: TextStyle(
                                color: ink,
                                fontSize: 13,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 14),
                        _textFieldLabel('Product Name *',
                            placeholder: 'e.g. Unga Jogoo 2kg',
                            value: productForm['name'] ?? '',
                            onChanged: (value) =>
                                setState(() => productForm['name'] = value)),
                        const SizedBox(height: 14),
                        const Text('Barcode',
                            style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: TextEditingController(
                                    text: productForm['barcode'] ?? '')
                                  ..selection = TextSelection.collapsed(
                                      offset: (productForm['barcode'] ?? '')
                                          .length),
                                keyboardType: TextInputType.text,
                                onChanged: (value) => setState(() =>
                                    productForm['barcode'] = value.trim()),
                                decoration: const InputDecoration(
                                    hintText: 'Scan or enter barcode',
                                    border: OutlineInputBorder()),
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton.filled(
                              onPressed: _scanProductCode,
                              tooltip: 'Scan product code',
                              icon: const Icon(Icons.qr_code_scanner),
                              style: IconButton.styleFrom(
                                  backgroundColor: navy,
                                  foregroundColor: Colors.white),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        const Text('Category *',
                            style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                initialValue: inventoryCategories
                                        .contains(productForm['category'])
                                    ? productForm['category']
                                    : null,
                                items: inventoryCategories
                                    .map((categoryName) => DropdownMenuItem(
                                        value: categoryName,
                                        child: Text(
                                            '${_categoryEmoji(categoryName)}  $categoryName')))
                                    .toList(),
                                onChanged: (value) => setState(() =>
                                    productForm['category'] = value ?? ''),
                                decoration: const InputDecoration(
                                    hintText: 'Select category',
                                    border: OutlineInputBorder()),
                              ),
                            ),
                            const SizedBox(width: 8),
                            TextButton(
                              onPressed: () =>
                                  setState(() => showAddCategory = true),
                              style: TextButton.styleFrom(
                                backgroundColor: const Color(0xFFE3EAF8),
                                foregroundColor: navy,
                                minimumSize: const Size(0, 48),
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 11),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10)),
                              ),
                              child: const Text('+ Cat',
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700)),
                            ),
                          ],
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
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Pricing & Stock',
                            style: TextStyle(
                                color: ink,
                                fontSize: 13,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 14),
                        GridView.count(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          // Labels plus Material input fields need a stable
                          // height; a width-derived ratio clips on phones.
                          mainAxisExtent: 88,
                          children: [
                            _numberField(
                                'Cost Price (KSh) *',
                                productForm['cost'] ?? '',
                                (value) =>
                                    setState(() => productForm['cost'] = value),
                                placeholder: '0'),
                            _numberField(
                                'Selling Price (KSh) *',
                                productForm['price'] ?? '',
                                (value) => setState(
                                    () => productForm['price'] = value),
                                placeholder: '0'),
                            _numberField(
                                'Current Stock *',
                                productForm['stock'] ?? '',
                                (value) => setState(
                                    () => productForm['stock'] = value),
                                placeholder: '0'),
                            _numberField(
                                'Reorder Level',
                                productForm['reorder'] ?? '',
                                (value) => setState(
                                    () => productForm['reorder'] = value),
                                placeholder: '10'),
                          ],
                        ),
                        if ((int.tryParse(productForm['cost'] ?? '') ?? 0) >
                                0 &&
                            (int.tryParse(productForm['price'] ?? '') ?? 0) >
                                (int.tryParse(productForm['cost'] ?? '') ?? 0))
                          Builder(builder: (context) {
                            final cost = int.parse(productForm['cost'] ?? '0');
                            final price =
                                int.parse(productForm['price'] ?? '0');
                            final margin =
                                ((price - cost) / price * 100).round();
                            return Container(
                              margin: const EdgeInsets.only(top: 14),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFE8F5E9),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Profit Margin',
                                      style: TextStyle(
                                          color: Color(0xFF2E7D32),
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700)),
                                  Text('$margin%',
                                      style: const TextStyle(
                                          color: Color(0xFF2E7D32),
                                          fontSize: 16,
                                          fontWeight: FontWeight.w800)),
                                ],
                              ),
                            );
                          }),
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
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    child: Text(
                        editProduct != null ? 'Save Changes' : 'Add Product',
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _textFieldLabel(String label,
          {required String value,
          required ValueChanged<String> onChanged,
          String? placeholder}) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: TextEditingController(text: value)
              ..selection = TextSelection.collapsed(offset: value.length),
            onChanged: onChanged,
            decoration: InputDecoration(
                hintText: placeholder, border: const OutlineInputBorder()),
          ),
        ],
      );

  Widget _numberField(
          String label, String value, ValueChanged<String> onChanged,
          {required String placeholder}) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: muted, fontSize: 11, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            keyboardType: const TextInputType.numberWithOptions(decimal: false),
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            controller: TextEditingController(text: value)
              ..selection = TextSelection.collapsed(offset: value.length),
            onChanged: onChanged,
            decoration: InputDecoration(
                hintText: placeholder, border: const OutlineInputBorder()),
          ),
        ],
      );

  Widget _productDetails(Product product) =>
      ListView(padding: const EdgeInsets.fromLTRB(16, 28, 16, 24), children: [
        Row(children: [
          IconButton(
              onPressed: () => setState(() => selected = null),
              icon: const Icon(Icons.arrow_back)),
          const Text('Product Details',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold))
        ]),
        Card(
            color: navy,
            child: ListTile(
                leading:
                    Text(product.emoji, style: const TextStyle(fontSize: 36)),
                title: Text(product.name,
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.bold)),
                subtitle: Text(product.category,
                    style: const TextStyle(color: Colors.white70)))),
        const SizedBox(height: 12),
        Row(children: [
          _infoCard('Cost Price', 'KSh ${product.cost}', Colors.red),
          _infoCard('Selling Price', 'KSh ${product.price}', navy)
        ]),
        Row(children: [
          _infoCard('Stock', '${product.stock} units',
              product.stock <= 5 ? Colors.red : Colors.green),
          _infoCard('Reorder', '${product.reorder} units', gold)
        ]),
        Card(
            child: ListTile(
                title: const Text('Stock Information'),
                subtitle: Text(
                    'Status: ${product.stock <= 5 ? 'Critical' : product.stock < 20 ? 'Low Stock' : 'In Stock'}\nCategory: ${product.category}\nCurrent stock: ${product.stock} units'))),
      ]);

  Widget _infoCard(String label, String value, Color color) => Expanded(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                Text(label, style: const TextStyle(color: muted, fontSize: 11)),
                Text(value,
                    style: TextStyle(
                        color: color,
                        fontWeight: FontWeight.bold,
                        fontSize: 16)),
              ],
            ),
          ),
        ),
      );

  void _showCheckout(BuildContext context, int total) {
    showModalBottomSheet<void>(
        context: context,
        builder: (context) => SafeArea(
            child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('Payment · KSh $total',
                      style: const TextStyle(
                          fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  FilledButton(
                      onPressed: () {
                        Navigator.pop(context);
                        setState(() => cart.clear());
                      },
                      child: const Text('Complete Cash Sale')),
                  OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancel'))
                ]))));
  }
}

class CustomerEntry {
  const CustomerEntry({
    required this.id,
    required this.initials,
    required this.name,
    required this.phone,
    required this.credit,
    required this.purchases,
    required this.lastVisit,
    required this.color,
  });

  final String id;
  final String initials;
  final String name;
  final String phone;
  final int credit;
  final int purchases;
  final String lastVisit;
  final Color color;
}

class _CreditCustomerSelectorSheet extends StatefulWidget {
  const _CreditCustomerSelectorSheet(
      {required this.accounts,
      required this.searchController,
      required this.onSelected,
      required this.onAddCustomer});
  final List<CreditAccount> accounts;
  final TextEditingController searchController;
  final ValueChanged<CreditAccount> onSelected;
  final VoidCallback onAddCustomer;

  @override
  State<_CreditCustomerSelectorSheet> createState() =>
      _CreditCustomerSelectorSheetState();
}

class _CreditCustomerSelectorSheetState
    extends State<_CreditCustomerSelectorSheet> {
  String query = '';

  @override
  Widget build(BuildContext context) {
    final accounts = widget.accounts
        .where((account) =>
            account.customer.toLowerCase().contains(query.toLowerCase()) ||
            account.phone.contains(query))
        .toList();
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Select Credit Customer',
                style: TextStyle(
                    color: ink, fontSize: 19, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            const Text(
                'Search an existing debtor or add a new customer profile.',
                style: TextStyle(color: muted, fontSize: 12)),
            const SizedBox(height: 12),
            TextField(
              controller: widget.searchController,
              onChanged: (value) => setState(() => query = value),
              decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Search name or phone',
                  border: OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 230,
              child: accounts.isEmpty
                  ? const Center(
                      child: Text('No matching credit accounts.',
                          style: TextStyle(color: muted)))
                  : ListView(
                      children: accounts
                          .map((account) => ListTile(
                                contentPadding:
                                    const EdgeInsets.symmetric(horizontal: 4),
                                leading: CircleAvatar(
                                    backgroundColor: Color(account.colorValue),
                                    child: Text(account.initials,
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 12))),
                                title: Text(account.customer,
                                    style: const TextStyle(
                                        color: ink,
                                        fontWeight: FontWeight.w700)),
                                subtitle: Text(
                                    '${account.phone} · Outstanding KSh ${account.balance.toStringAsFixed(0)}',
                                    style: const TextStyle(
                                        color: muted, fontSize: 11)),
                                onTap: () => widget.onSelected(account),
                              ))
                          .toList(),
                    ),
            ),
            const SizedBox(height: 8),
            SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                    onPressed: widget.onAddCustomer,
                    icon: const Icon(Icons.person_add_alt_1),
                    label: const Text('Add New Customer'))),
          ],
        ),
      ),
    );
  }
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

class LegacyCustomerScreen extends StatefulWidget {
  const LegacyCustomerScreen({super.key});

  @override
  State<LegacyCustomerScreen> createState() => _LegacyCustomerScreenState();
}

class _LegacyCustomerScreenState extends State<LegacyCustomerScreen> {
  final CustomerService _customerService = CustomerService();
  final SyncService _syncService = SyncService();
  final TextEditingController _searchController = TextEditingController();
  String search = '';
  String tab = 'all';
  String? selected;
  bool _loadingCustomers = true;

  List<CustomerEntry> _customers = const [];

  static const List<CustomerTransaction> _transactions = [
    CustomerTransaction(
        date: 'Today 14:18',
        type: 'Sale',
        amount: 3400,
        method: 'M-Pesa',
        items: 8),
    CustomerTransaction(
        date: 'Yesterday',
        type: 'Credit',
        amount: 1200,
        method: 'Credit',
        items: 4),
    CustomerTransaction(
        date: '5 Jul',
        type: 'Payment',
        amount: -2000,
        method: 'Cash',
        items: 0),
    CustomerTransaction(
        date: '3 Jul', type: 'Sale', amount: 4800, method: 'Cash', items: 12),
  ];

  @override
  void initState() {
    super.initState();
    _loadCustomers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadCustomers() async {
    final rows =
        await _customerService.searchCachedCustomers(_searchController.text);
    if (!mounted) return;
    setState(() {
      _customers = rows.map(_customerFromRow).toList();
      _loadingCustomers = false;
    });
  }

  CustomerEntry _customerFromRow(Map<String, dynamic> row) {
    final name = row['name'] as String? ?? 'Customer';
    final initials = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .map((part) => part[0])
        .take(2)
        .join()
        .toUpperCase();
    return CustomerEntry(
      id: row['id'] as String? ?? name,
      initials: initials.isEmpty ? 'CU' : initials,
      name: name,
      phone: row['phone'] as String? ?? '',
      credit: (row['balance'] as num?)?.round() ?? 0,
      purchases: row['transactionCount'] as int? ?? 0,
      lastVisit: row['createdAt'] as String? ?? 'No visits yet',
      color: const Color(0xFF123A8F),
    );
  }

  Future<void> _showRegisterCustomerSheet() async {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final limitController = TextEditingController(text: '0');
    final formKey = GlobalKey<FormState>();
    var created = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.fromLTRB(
            20, 8, 20, MediaQuery.of(sheetContext).viewInsets.bottom + 20),
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Register New Customer',
                  style: TextStyle(
                      color: ink, fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 16),
              TextFormField(
                  controller: nameController,
                  decoration: const InputDecoration(
                      labelText: 'Customer name', border: OutlineInputBorder()),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Name is required'
                      : null),
              const SizedBox(height: 12),
              TextFormField(
                  controller: phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                      labelText: 'Phone number',
                      hintText: '0712 345 678',
                      border: OutlineInputBorder())),
              const SizedBox(height: 12),
              TextFormField(
                  controller: limitController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'Initial credit limit',
                      prefixText: 'KSh ',
                      border: OutlineInputBorder()),
                  validator: (value) => double.tryParse(value ?? '') == null
                      ? 'Enter a valid amount'
                      : null),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () async {
                    if (!(formKey.currentState?.validate() ?? false)) return;
                    await _customerService.onboardOfflineCustomer(
                      businessId: 'demo-business',
                      name: nameController.text,
                      phone: phoneController.text,
                      initialCreditLimit: double.parse(limitController.text),
                    );
                    created = true;
                    if (!sheetContext.mounted) return;
                    Navigator.of(sheetContext).pop();
                  },
                  child: const Text('Save Customer'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    nameController.dispose();
    phoneController.dispose();
    limitController.dispose();
    if (!created) return;
    await _loadCustomers();
    if (!mounted) return;
    unawaited(_syncService.processCloudSync(
        businessId: 'demo-business',
        deviceId: 'mobile-device',
        userId: 'demo-owner'));
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        backgroundColor: Color(0xFF2E7D32),
        content: Text('Customer registered and queued for sync.')));
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _customers.where((customer) {
      final matchesSearch =
          customer.name.toLowerCase().contains(search.toLowerCase());
      final matchesTab =
          tab == 'all' || (tab == 'credit' && customer.credit > 0);
      return matchesSearch && matchesTab;
    }).toList();

    final totalCredit =
        _customers.fold<int>(0, (sum, customer) => sum + customer.credit);

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
                      const Text('Customer Profile',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w700)),
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
                          child: Text(customer.initials,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(customer.name,
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800)),
                            const SizedBox(height: 3),
                            Text(customer.phone,
                                style: const TextStyle(
                                    color: Colors.white70, fontSize: 13)),
                            const SizedBox(height: 3),
                            Text('Last visit: ${customer.lastVisit}',
                                style: const TextStyle(
                                    color: Color(0x99FFFFFF), fontSize: 11)),
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
                      _detailStatCard(
                          'Credit',
                          'KSh ${customer.credit.toString()}',
                          customer.credit > 0
                              ? const Color(0xFFD32F2F)
                              : const Color(0xFF2E7D32)),
                      _detailStatCard(
                          'Purchases', '${customer.purchases}', navy),
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
                                const Text('Outstanding Balance',
                                    style: TextStyle(
                                        color: Color(0xFFB71C1C),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700)),
                                const SizedBox(height: 4),
                                Text('KSh ${customer.credit}',
                                    style: const TextStyle(
                                        color: Color(0xFFD32F2F),
                                        fontSize: 24,
                                        fontWeight: FontWeight.w900)),
                              ],
                            ),
                          ),
                          TextButton(
                            onPressed: () {},
                            style: TextButton.styleFrom(
                              backgroundColor: const Color(0xFFD32F2F),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                            ),
                            child: const Text('Record Payment',
                                style: TextStyle(
                                    fontSize: 12, fontWeight: FontWeight.w800)),
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
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: const Text('New Sale',
                              style: TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextButton(
                          onPressed: () {},
                          style: TextButton.styleFrom(
                            backgroundColor: const Color(0xFFE9EEFF),
                            foregroundColor: navy,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: const Text('Statement',
                              style: TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w700)),
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
                        child: const Center(
                            child: Text('📞', style: TextStyle(fontSize: 18))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Transaction History',
                            style: TextStyle(
                                color: ink,
                                fontSize: 13,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 12),
                        ..._transactions.map((transaction) {
                          final isPositive = transaction.amount >= 0;
                          final badgeColor = transaction.amount < 0
                              ? const Color(0xFFE8F5E9)
                              : transaction.method == 'Credit'
                                  ? const Color(0xFFFFEBEE)
                                  : const Color(0xFFE3EAF8);
                          final icon = transaction.amount < 0
                              ? '✅'
                              : transaction.method == 'Credit'
                                  ? '📋'
                                  : transaction.method == 'M-Pesa'
                                      ? '📱'
                                      : '💵';
                          return Container(
                            padding: const EdgeInsets.only(bottom: 12),
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: const BoxDecoration(
                              border: Border(
                                  bottom: BorderSide(color: Color(0xFFF0F3F9))),
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
                                  child: Center(
                                      child: Text(icon,
                                          style:
                                              const TextStyle(fontSize: 16))),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${transaction.type}${transaction.items > 0 ? ' · ${transaction.items} items' : ''}',
                                        style: const TextStyle(
                                            color: ink,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(transaction.date,
                                          style: const TextStyle(
                                              color: muted, fontSize: 11)),
                                    ],
                                  ),
                                ),
                                Text(
                                  '${isPositive ? '' : '-'}KSh ${isPositive ? transaction.amount : transaction.amount.abs()}'
                                      .replaceAll(RegExp(r'-KSh 0'), 'KSh 0'),
                                  style: TextStyle(
                                    color: isPositive
                                        ? ink
                                        : const Color(0xFF2E7D32),
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
                    const Text('Customers',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800)),
                    TextButton(
                      onPressed: _showRegisterCustomerSheet,
                      style: TextButton.styleFrom(
                        backgroundColor: gold,
                        foregroundColor: ink,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                      ),
                      child: const Text('+ Add Customer',
                          style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _summaryMetric('Total Customers', '${_customers.length}',
                        Colors.white),
                    const SizedBox(width: 8),
                    _summaryMetric('Total Credit', 'KSh $totalCredit',
                        const Color(0xFFFF6B6B)),
                    const SizedBox(width: 8),
                    _summaryMetric(
                        'Credit Accounts',
                        '${_customers.where((customer) => customer.credit > 0).length}',
                        const Color(0xFFFFD93D)),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.14)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (value) {
                      setState(() => search = value);
                      unawaited(_loadCustomers());
                    },
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Search customers...',
                      hintStyle: const TextStyle(color: Color(0x99FFFFFF)),
                      prefixIcon:
                          const Icon(Icons.search, color: Color(0xCCFFFFFF)),
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
                final label =
                    value == 'all' ? 'All Customers' : 'Credit Accounts';
                final selected = tab == value;
                return Expanded(
                  child: InkWell(
                    onTap: () => setState(() => tab = value),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        border: Border(
                            bottom: BorderSide(
                                color: selected ? navy : Colors.transparent,
                                width: 2)),
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
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
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
                            child: Text(customer.initials,
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(customer.name,
                                  style: const TextStyle(
                                      color: ink,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800)),
                              const SizedBox(height: 2),
                              Text(
                                  '${customer.phone} · ${customer.purchases} purchases',
                                  style: const TextStyle(
                                      color: muted, fontSize: 12)),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: customer.credit > 0
                              ? [
                                  Text('KSh ${customer.credit}',
                                      style: const TextStyle(
                                          color: Color(0xFFD32F2F),
                                          fontSize: 13,
                                          fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 2),
                                  const Text('Credit',
                                      style: TextStyle(
                                          color: Color(0xFFD32F2F),
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700)),
                                ]
                              : [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE9F7EE),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: const Text('Cleared',
                                        style: TextStyle(
                                            color: Color(0xFF2E7D32),
                                            fontSize: 10,
                                            fontWeight: FontWeight.w800)),
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
              Text(label,
                  style:
                      const TextStyle(color: Color(0x99FFFFFF), fontSize: 10)),
              const SizedBox(height: 3),
              Text(value,
                  style: TextStyle(
                      color: color, fontSize: 16, fontWeight: FontWeight.w800)),
            ],
          ),
        ),
      );

  Widget _detailStatCard(String label, String value, Color color) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: const [
            BoxShadow(
                color: Color(0x0F000000), blurRadius: 6, offset: Offset(0, 2))
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: muted, fontSize: 11)),
            const SizedBox(height: 6),
            Text(value,
                style: TextStyle(
                    color: color, fontSize: 16, fontWeight: FontWeight.w800)),
          ],
        ),
      );
}

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({required this.onBack, super.key});
  final VoidCallback onBack;

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  static const _colors = <Color>[
    navy,
    Color(0xFF2E7D32),
    Color(0xFFD32F2F),
    gold,
    Color(0xFF7B1FA2),
    Color(0xFFF57C00),
    Color(0xFF00796B)
  ];
  final CustomerApiService _service = CustomerApiService();
  final TextEditingController _search = TextEditingController();
  final TextEditingController _name = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _limit = TextEditingController();
  final TextEditingController _note = TextEditingController();
  List<Map<String, dynamic>> _customers = const [];
  Map<String, dynamic>? _selected;
  List<Map<String, dynamic>> _transactions = const [];
  String _tab = 'all';
  String? _error;
  bool _loading = true;
  bool _showAdd = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    _name.dispose();
    _phone.dispose();
    _limit.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final rows = await _service.loadCustomers();
      if (!mounted) return;
      setState(() {
        _customers = rows;
        _loading = false;
        _error = null;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _openCustomer(Map<String, dynamic> summary) async {
    try {
      final detail = await _service.loadCustomer(summary['id'].toString());
      final items = <Map<String, dynamic>>[];
      for (final sale
          in (detail['sales'] as List? ?? const []).whereType<Map>()) {
        final saleItems = sale['items'] as List? ?? const [];
        final payments = sale['payments'] as List? ?? const [];
        final paymentMethod = payments.isNotEmpty && payments.first is Map
            ? (payments.first as Map)['paymentMethod'] as Map?
            : null;
        final method = paymentMethod?['name']?.toString() ?? 'Sale';
        items.add({
          'id': sale['id'],
          'type': 'Sale',
          'amount': _asDouble(sale['total']),
          'method': method,
          'items': saleItems.fold<int>(
              0, (sum, item) => sum + _asInt((item as Map)['quantity'])),
          'date': sale['createdAt']
        });
      }
      for (final entry
          in (detail['creditEntries'] as List? ?? const []).whereType<Map>()) {
        final payment = entry['type']?.toString() == 'PAYMENT';
        items.add({
          'id': entry['id'],
          'type': payment ? 'Payment' : 'Credit',
          'amount': payment
              ? -_asDouble(entry['amount'])
              : _asDouble(entry['amount']),
          'method': payment ? 'Credit payment' : 'Credit',
          'items': 0,
          'date': entry['createdAt']
        });
      }
      items.sort((a, b) =>
          (b['date']?.toString() ?? '').compareTo(a['date']?.toString() ?? ''));
      if (!mounted) return;
      setState(() {
        _selected = {...summary, ...detail};
        _transactions = items;
        _error = null;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _saveCustomer() async {
    final name = _name.text.trim();
    final limit = double.tryParse(_limit.text.trim()) ?? 0;
    if (name.isEmpty || limit < 0) {
      setState(
          () => _error = 'Enter a customer name and a valid credit limit.');
      return;
    }
    setState(() => _saving = true);
    try {
      await _service.createCustomer(
          name: name,
          phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
          initialCreditLimit: limit);
      if (!mounted) return;
      setState(() {
        _showAdd = false;
        _saving = false;
        _name.clear();
        _phone.clear();
        _limit.clear();
        _note.clear();
      });
      await _load();
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            backgroundColor: Color(0xFF2E7D32),
            content: Text('Customer added successfully.')));
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _payment() async {
    final customer = _selected;
    if (customer == null) return;
    final controller = TextEditingController();
    final amount = await showDialog<double>(
        context: context,
        builder: (dialogContext) => AlertDialog(
              title: const Text('Record Payment'),
              content: TextField(
                  controller: controller,
                  autofocus: true,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'Payment amount',
                      prefixText: 'KSh ',
                      border: OutlineInputBorder())),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(dialogContext),
                    child: const Text('Cancel')),
                FilledButton(
                    onPressed: () => Navigator.pop(
                        dialogContext, double.tryParse(controller.text)),
                    child: const Text('Record'))
              ],
            ));
    controller.dispose();
    final credit = _creditOf(customer);
    if (amount == null || amount <= 0 || amount > credit) return;
    setState(() => _saving = true);
    try {
      await _service.recordPayment(
          customerId: customer['id'].toString(), amount: amount);
      await _load();
      await _openCustomer(customer);
      if (mounted) setState(() => _saving = false);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  double _creditOf(Map row) =>
      _asDouble((row['creditAccount'] as Map?)?['balance']);
  int _purchasesOf(Map row) => _asInt((row['_count'] as Map?)?['sales']);
  double _asDouble(Object? value) => value is num
      ? value.toDouble()
      : double.tryParse(value?.toString() ?? '') ?? 0;
  int _asInt(Object? value) =>
      value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;
  String _money(double value) => value
      .toStringAsFixed(0)
      .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  String _initials(Map row) {
    final name = row['name']?.toString().trim() ?? '';
    return name.isEmpty
        ? '?'
        : name
            .split(RegExp(r'\s+'))
            .take(2)
            .map((word) => word[0])
            .join()
            .toUpperCase();
  }

  String _date(Object? value) {
    final date = DateTime.tryParse(value?.toString() ?? '');
    return date == null
        ? 'No visits'
        : '${date.day}/${date.month}/${date.year}';
  }

  double _thisMonthSpend(Map customer) {
    final now = DateTime.now();
    return (customer['sales'] as List? ?? const [])
        .whereType<Map>()
        .where((sale) {
      final date = DateTime.tryParse(sale['createdAt']?.toString() ?? '');
      return date?.year == now.year && date?.month == now.month;
    }).fold<double>(0, (sum, sale) => sum + _asDouble(sale['total']));
  }

  Widget _header(String title, {Widget? action}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(16, 46, 16, 16),
        decoration:
            const BoxDecoration(gradient: LinearGradient(colors: [ink, navy])),
        child: Row(children: [
          IconButton(
              onPressed: widget.onBack,
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              style: IconButton.styleFrom(
                  backgroundColor: Colors.white24,
                  fixedSize: const Size(36, 36))),
          const SizedBox(width: 10),
          Expanded(
              child: Text(title,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800))),
          if (action != null) action
        ]),
      );

  Widget _addView() => Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: Column(children: [
        _header('Add Customer', action: null),
        Expanded(
            child: ListView(padding: const EdgeInsets.all(16), children: [
          if (_error != null) _errorBox(),
          Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                  color: Colors.white, borderRadius: BorderRadius.circular(8)),
              child: Column(children: [
                Container(
                    width: 72,
                    height: 72,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                        color: navy, shape: BoxShape.circle),
                    child: Text(
                        _name.text.trim().isEmpty
                            ? '?'
                            : _initials({'name': _name.text}),
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w800))),
                const SizedBox(height: 20),
                _field('Full Name *', _name, 'e.g. Jane Mwangi',
                    onChanged: (_) => setState(() {})),
                _field('Phone Number', _phone, 'e.g. 0712 345 678',
                    keyboard: TextInputType.phone),
                _field('Credit Limit (KSh)', _limit, '0',
                    keyboard:
                        const TextInputType.numberWithOptions(decimal: true)),
                _field('Note (optional)', _note,
                    'e.g. Regular customer, prefer M-Pesa'),
                const SizedBox(height: 6),
                SizedBox(
                    width: double.infinity,
                    child: TextButton(
                        onPressed: _saving ? null : _saveCustomer,
                        style: TextButton.styleFrom(
                            backgroundColor: navy,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 15),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8))),
                        child: Text(_saving ? 'Saving...' : 'Save Customer',
                            style: const TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w800)))),
              ])),
        ])),
      ]));

  Widget _field(String label, TextEditingController controller, String hint,
          {TextInputType? keyboard, ValueChanged<String>? onChanged}) =>
      Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label,
                style: const TextStyle(
                    color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            TextField(
                controller: controller,
                keyboardType: keyboard,
                onChanged: onChanged,
                decoration: InputDecoration(
                    hintText: hint,
                    border: const OutlineInputBorder(),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12)))
          ]));
  Widget _errorBox() => Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
          color: const Color(0xFFFFEBEE),
          borderRadius: BorderRadius.circular(8)),
      child: Text(_error!,
          style: const TextStyle(color: Color(0xFFC62828), fontSize: 12)));

  Widget _profileView(Map customer) {
    final credit = _creditOf(customer);
    final purchases = _purchasesOf(customer);
    final thisMonth = _thisMonthSpend(customer);
    final color = _colors[_customers
            .indexWhere((row) => row['id'] == customer['id'])
            .clamp(0, _colors.length - 1) %
        _colors.length];
    return Scaffold(
        backgroundColor: const Color(0xFFF5F7FA),
        body: Column(children: [
          Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 46, 16, 22),
              decoration: const BoxDecoration(
                  gradient: LinearGradient(colors: [ink, navy])),
              child: Column(children: [
                Row(children: [
                  IconButton(
                      onPressed: () => setState(() => _selected = null),
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                      style: IconButton.styleFrom(
                          backgroundColor: Colors.white24,
                          fixedSize: const Size(36, 36))),
                  const SizedBox(width: 10),
                  const Text('Customer Profile',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800))
                ]),
                const SizedBox(height: 18),
                Row(children: [
                  CircleAvatar(
                      radius: 30,
                      backgroundColor: color,
                      child: Text(_initials(customer),
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w800))),
                  const SizedBox(width: 14),
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text(customer['name']?.toString() ?? 'Customer',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w800)),
                        Text(
                            customer['phone']?.toString().isEmpty == false
                                ? customer['phone'].toString()
                                : 'No phone number',
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 13)),
                        Text(
                            'Last visit: ${_date((customer['sales'] as List?)?.isEmpty == false ? ((customer['sales'] as List).first as Map)['createdAt'] : null)}',
                            style: const TextStyle(
                                color: Colors.white54, fontSize: 11))
                      ]))
                ])
              ])),
          Expanded(
              child: ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [
              _stat(
                  'Credit',
                  'KSh ${_money(credit)}',
                  credit > 0
                      ? const Color(0xFFD32F2F)
                      : const Color(0xFF2E7D32)),
              const SizedBox(width: 8),
              _stat('Purchases', '$purchases', navy),
              const SizedBox(width: 8),
              _stat('This Month', 'KSh ${_money(thisMonth)}', gold)
            ]),
            if (credit > 0) ...[
              const SizedBox(height: 14),
              Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                      color: const Color(0xFFFFEBEE),
                      border: Border.all(color: const Color(0xFFEF9A9A)),
                      borderRadius: BorderRadius.circular(8)),
                  child: Row(children: [
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          const Text('Outstanding Balance',
                              style: TextStyle(
                                  color: Color(0xFFB71C1C),
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13)),
                          Text('KSh ${_money(credit)}',
                              style: const TextStyle(
                                  color: Color(0xFFD32F2F),
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900))
                        ])),
                    TextButton(
                        onPressed: _saving ? null : _payment,
                        style: TextButton.styleFrom(
                            backgroundColor: const Color(0xFFD32F2F),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8))),
                        child: const Text('Record Payment'))
                  ]))
            ],
            const SizedBox(height: 16),
            Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8)),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Transaction History',
                          style: TextStyle(
                              color: ink,
                              fontSize: 13,
                              fontWeight: FontWeight.w800)),
                      const SizedBox(height: 12),
                      if (_transactions.isEmpty)
                        const Text('No transactions yet.',
                            style: TextStyle(color: muted, fontSize: 12)),
                      ..._transactions.map(_transaction)
                    ])),
          ])),
        ]));
  }

  Widget _stat(String label, String value, Color color) => Expanded(
      child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
          decoration: BoxDecoration(
              color: Colors.white, borderRadius: BorderRadius.circular(8)),
          child: Column(children: [
            Text(label, style: const TextStyle(color: muted, fontSize: 10)),
            const SizedBox(height: 4),
            Text(value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    color: color, fontSize: 13, fontWeight: FontWeight.w800))
          ])));
  Widget _transaction(Map<String, dynamic> item) {
    final payment = _asDouble(item['amount']) < 0;
    final credit = item['method'] == 'Credit';
    return Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(children: [
          CircleAvatar(
              radius: 18,
              backgroundColor: payment
                  ? const Color(0xFFE8F5E9)
                  : credit
                      ? const Color(0xFFFFEBEE)
                      : const Color(0xFFEEF3FF),
              child: Icon(
                  payment
                      ? Icons.check
                      : credit
                          ? Icons.receipt_long
                          : Icons.payments_outlined,
                  size: 18,
                  color: payment
                      ? const Color(0xFF2E7D32)
                      : credit
                          ? const Color(0xFFD32F2F)
                          : navy)),
          const SizedBox(width: 10),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(
                    '${item['type']}${_asInt(item['items']) > 0 ? ' · ${item['items']} items' : ''}',
                    style: const TextStyle(
                        color: ink, fontSize: 13, fontWeight: FontWeight.w700)),
                Text(_date(item['date']),
                    style: const TextStyle(color: muted, fontSize: 11))
              ])),
          Text(
              '${payment ? '-' : ''}KSh ${_money(_asDouble(item['amount']).abs())}',
              style: TextStyle(
                  color: payment ? const Color(0xFF2E7D32) : ink,
                  fontWeight: FontWeight.w800))
        ]));
  }

  @override
  Widget build(BuildContext context) {
    if (_showAdd) return _addView();
    if (_selected != null) return _profileView(_selected!);
    final query = _search.text.toLowerCase();
    final filtered = _customers
        .where((row) =>
            (row['name']?.toString().toLowerCase().contains(query) ?? false) &&
            (_tab == 'all' || _creditOf(row) > 0))
        .toList();
    final total =
        _customers.fold<double>(0, (sum, row) => sum + _creditOf(row));
    return SizedBox.expand(
        child: Column(children: [
      Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
          decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy])),
          child: Column(children: [
            Row(children: [
              IconButton(
                  onPressed: widget.onBack,
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  style: IconButton.styleFrom(
                      backgroundColor: Colors.white24,
                      fixedSize: const Size(32, 32))),
              const SizedBox(width: 8),
              const Expanded(
                  child: Text('Customers',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800))),
              TextButton(
                  onPressed: () => setState(() {
                        _showAdd = true;
                        _error = null;
                      }),
                  style: TextButton.styleFrom(
                      backgroundColor: gold,
                      foregroundColor: ink,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8))),
                  child: const Text('+ Add Customer',
                      style: TextStyle(fontWeight: FontWeight.w800)))
            ]),
            const SizedBox(height: 12),
            Row(children: [
              _metric('Total Customers', '${_customers.length}', Colors.white),
              const SizedBox(width: 7),
              _metric('Total Credit', 'KSh ${_money(total)}',
                  const Color(0xFFFF6B6B)),
              const SizedBox(width: 7),
              _metric(
                  'Credit Accounts',
                  '${_customers.where((row) => _creditOf(row) > 0).length}',
                  const Color(0xFFFFD93D))
            ]),
            const SizedBox(height: 12),
            TextField(
                controller: _search,
                onChanged: (_) => setState(() {}),
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                    hintText: 'Search customers...',
                    hintStyle: const TextStyle(color: Colors.white60),
                    prefixIcon: const Icon(Icons.search, color: Colors.white60),
                    filled: true,
                    fillColor: Colors.white12,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Colors.white24)),
                    enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: Colors.white24))))
          ])),
      Container(
          color: Colors.white,
          child: Row(
              children: ['all', 'credit'].map((value) {
            final active = _tab == value;
            return Expanded(
                child: TextButton(
                    onPressed: () => setState(() => _tab = value),
                    style: TextButton.styleFrom(
                        shape: const RoundedRectangleBorder(),
                        foregroundColor: active ? navy : muted),
                    child: Text(
                        value == 'all' ? 'All Customers' : 'Credit Accounts',
                        style: TextStyle(
                            fontWeight:
                                active ? FontWeight.w800 : FontWeight.w600))));
          }).toList())),
      Expanded(
          child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              children: [
            if (_error != null) _errorBox(),
            if (_loading)
              const Center(
                  child: Padding(
                      padding: EdgeInsets.all(28),
                      child: CircularProgressIndicator(color: navy))),
            if (!_loading && filtered.isEmpty)
              const Padding(
                  padding: EdgeInsets.all(28),
                  child: Center(
                      child: Text('No customers found.',
                          style: TextStyle(color: muted)))),
            ...filtered.asMap().entries.map((entry) =>
                _customerCard(entry.value, _colors[entry.key % _colors.length]))
          ])),
    ]));
  }

  Widget _metric(String label, String value, Color color) => Expanded(
      child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 5),
          decoration: BoxDecoration(
              color: Colors.white10, borderRadius: BorderRadius.circular(8)),
          child: Column(children: [
            Text(label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white60, fontSize: 9)),
            const SizedBox(height: 3),
            Text(value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    color: color, fontSize: 14, fontWeight: FontWeight.w800))
          ])));
  Widget _customerCard(Map<String, dynamic> row, Color color) {
    final credit = _creditOf(row);
    return InkWell(
        onTap: () => _openCustomer(row),
        child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                boxShadow: const [
                  BoxShadow(
                      color: Color(0x0F000000),
                      blurRadius: 8,
                      offset: Offset(0, 2))
                ]),
            child: Row(children: [
              CircleAvatar(
                  radius: 23,
                  backgroundColor: color,
                  child: Text(_initials(row),
                      style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w800))),
              const SizedBox(width: 12),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(row['name']?.toString() ?? 'Customer',
                        style: const TextStyle(
                            color: ink,
                            fontSize: 14,
                            fontWeight: FontWeight.w800)),
                    Text(
                        '${row['phone']?.toString().isEmpty == false ? row['phone'] : 'No phone'} · ${_purchasesOf(row)} purchases',
                        style: const TextStyle(color: muted, fontSize: 11))
                  ])),
              credit > 0
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                          Text('KSh ${_money(credit)}',
                              style: const TextStyle(
                                  color: Color(0xFFD32F2F),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800)),
                          const Text('Credit',
                              style: TextStyle(
                                  color: Color(0xFFD32F2F),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700))
                        ])
                  : Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                          color: const Color(0xFFE8F5E9),
                          borderRadius: BorderRadius.circular(999)),
                      child: const Text('Cleared',
                          style: TextStyle(
                              color: Color(0xFF2E7D32),
                              fontSize: 10,
                              fontWeight: FontWeight.w800)))
            ])));
  }
}

class UnreadNotificationBadge extends StatefulWidget {
  const UnreadNotificationBadge({super.key});

  @override
  State<UnreadNotificationBadge> createState() =>
      _UnreadNotificationBadgeState();
}

class _UnreadNotificationBadgeState extends State<UnreadNotificationBadge> {
  int _count = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final session = await AuthService().readSession();
      if (session == null) return;
      final count = await NotificationService().unreadCount(session);
      if (mounted) setState(() => _count = count);
    } catch (_) {
      // A badge is supplementary; keep it hidden on a temporary API failure.
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_count == 0) return const SizedBox.shrink();
    return Container(
      constraints: const BoxConstraints(minWidth: 20),
      height: 20,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(
          color: const Color(0xFFD32F2F),
          borderRadius: BorderRadius.circular(99)),
      child: Text(_count > 99 ? '99+' : '$_count',
          style: const TextStyle(
              color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}

class MoreScreen extends StatefulWidget {
  const MoreScreen(
      {required this.onOpen,
      required this.role,
      required this.isDarkMode,
      required this.onLogout,
      required this.onCloseShift});
  final ValueChanged<String> onOpen;
  final String role;
  final bool isDarkMode;
  final VoidCallback onLogout;
  final VoidCallback onCloseShift;

  @override
  State<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends State<MoreScreen> {
  final ProfileService _profileService = ProfileService();
  Map<String, dynamic>? _profile;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await _profileService.load();
      if (mounted) setState(() => _profile = profile);
    } on Object {
      // Keep the menu usable while a profile refresh is temporarily unavailable.
    }
  }

  Color get pageBackground =>
      widget.isDarkMode ? const Color(0xFF101522) : const Color(0xFFF5F7FA);
  Color get panelBackground =>
      widget.isDarkMode ? const Color(0xFF192235) : Colors.white;
  Color get primaryText => widget.isDarkMode ? Colors.white : ink;
  Color get dividerColor =>
      widget.isDarkMode ? const Color(0xFF2C3850) : const Color(0xFFF0F3F9);

  final List<Map<String, dynamic>> _menuSections = const [
    {
      'section': 'Sales & Finance',
      'items': [
        {
          'label': 'Sales History',
          'icon': '🧾',
          'color': Color(0xFF123A8F),
          'screen': 'Reports & Analytics'
        },
        {
          'label': 'Purchase Orders',
          'icon': '📦',
          'color': Color(0xFF2E7D32),
          'screen': 'Purchase Orders'
        },
        {
          'label': 'Suppliers',
          'icon': '🏭',
          'color': Color(0xFF00796B),
          'screen': 'Suppliers'
        },
        {
          'label': 'Credit Book',
          'icon': '📋',
          'color': Color(0xFFD32F2F),
          'screen': 'Credit Book'
        },
        {
          'label': 'Expense Tracking',
          'icon': '💸',
          'color': Color(0xFFF57C00),
          'screen': 'Expense Tracking'
        },
      ],
    },
    {
      'section': 'People',
      'items': [
        {
          'label': 'Employees',
          'icon': '👥',
          'color': Color(0xFF5E35B1),
          'screen': 'Employees'
        },
        {
          'label': 'Customer List',
          'icon': '🙂',
          'color': Color(0xFF0288D1),
          'screen': 'Customers'
        },
      ],
    },
    {
      'section': 'System',
      'items': [
        {
          'label': 'Notifications',
          'icon': '🔔',
          'color': Color(0xFFE91E63),
          'screen': 'Notifications'
        },
        {
          'label': 'Backup & Cloud Sync',
          'icon': '☁️',
          'color': Color(0xFF0288D1),
          'screen': 'Backup & Cloud Sync'
        },
        {
          'label': 'Settings',
          'icon': '⚙️',
          'color': Color(0xFF546E7A),
          'screen': 'Settings'
        },
        {
          'label': 'User Profile',
          'icon': '👤',
          'color': Color(0xFF123A8F),
          'screen': 'User Profile'
        },
      ],
    },
  ];

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    final business = profile?['business'] as Map? ?? const {};
    final name = profile?['name']?.toString().trim();
    final email = profile?['email']?.toString().trim();
    final apiRole = profile?['role']?.toString() ?? widget.role;
    final roleLabel = apiRole
        .toLowerCase()
        .split('_')
        .map((part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
    final initials = (name?.isNotEmpty == true ? name! : 'User')
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part[0])
        .join()
        .toUpperCase();

    return Container(
      color: pageBackground,
      child: ListView(
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
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: gold,
                      child: Text(initials,
                          style: const TextStyle(
                              color: ink,
                              fontWeight: FontWeight.bold,
                              fontSize: 20)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name?.isNotEmpty == true ? name! : 'User',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800)),
                          const SizedBox(height: 2),
                          Text(email?.isNotEmpty == true ? email! : '-',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  color: Colors.white60, fontSize: 12)),
                          const SizedBox(height: 6),
                          DecoratedBox(
                            decoration: BoxDecoration(
                              color: Color(0x40D4AF37),
                              borderRadius:
                                  BorderRadius.all(Radius.circular(999)),
                            ),
                            child: Padding(
                              padding: EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              child: Text(roleLabel,
                                  style: TextStyle(
                                      color: Color(0xFFF4D46A),
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700)),
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => widget.onOpen('User Profile'),
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
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          children: [
                            Text('Store',
                                style: TextStyle(
                                    color: Colors.white60, fontSize: 10)),
                            SizedBox(height: 2),
                            Text(business['name']?.toString() ?? '-',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12)),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          children: [
                            Text('Branch',
                                style: TextStyle(
                                    color: Colors.white60, fontSize: 10)),
                            SizedBox(height: 2),
                            Text(business['branch']?.toString() ?? '-',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12)),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          children: [
                            Text('Shift',
                                style: TextStyle(
                                    color: Colors.white60, fontSize: 10)),
                            SizedBox(height: 2),
                            Text('Morning',
                                style: TextStyle(
                                    color: gold,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12)),
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
          ..._menuSections.map((section) {
            final items =
                (section['items'] as List<Map<String, dynamic>>).where((item) {
              final screen = item['screen'];
              if (widget.role == 'OWNER' || widget.role == 'ADMIN') return true;
              if (widget.role == 'CASHIER')
                return screen == 'Expense Tracking' || screen == 'Credit Book';
              if (widget.role == 'SUPERVISOR')
                return screen != 'Reports & Analytics' &&
                    screen != 'Settings' &&
                    screen != 'Backup & Cloud Sync';
              if (widget.role == 'ACCOUNTANT')
                return screen == 'Reports & Analytics' ||
                    screen == 'Credit Book' ||
                    screen == 'Expense Tracking' ||
                    screen == 'User Profile';
              return false;
            }).toList();
            return items.isEmpty
                ? null
                : _menuSection(section['section'] as String, items);
          }).whereType<Widget>(),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: widget.onCloseShift,
            icon: const Icon(Icons.lock_clock, color: Color(0xFF2E7D32)),
            label: const Text('Close Shift Session',
                style: TextStyle(
                    color: Color(0xFF2E7D32),
                    fontSize: 15,
                    fontWeight: FontWeight.w700)),
            style: TextButton.styleFrom(
              backgroundColor: const Color(0xFFE8F5E9),
              foregroundColor: const Color(0xFF2E7D32),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: const BorderSide(color: Color(0xFFC8E6C9)),
              ),
            ),
          ),
          const SizedBox(height: 10),
          TextButton.icon(
            onPressed: widget.onLogout,
            icon: const Icon(Icons.logout, color: Color(0xFFD32F2F)),
            label: const Text('Logout',
                style: TextStyle(
                    color: Color(0xFFD32F2F),
                    fontSize: 15,
                    fontWeight: FontWeight.w700)),
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
          Center(
            child: Text(
              'MobiDuka POS v2.4.1\n© 2026 MobiTech Solutions Ltd · Kenya',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: widget.isDarkMode ? const Color(0xFF8290AD) : muted,
                  fontSize: 11,
                  height: 1.5),
            ),
          ),
        ],
      ),
    );
  }

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
              color: panelBackground,
              borderRadius: BorderRadius.circular(14),
              boxShadow: const [
                BoxShadow(
                    color: Color(0x0F000000),
                    blurRadius: 8,
                    offset: Offset(0, 2))
              ],
            ),
            child: Column(
              children: items.asMap().entries.map((entry) {
                final i = entry.key;
                final item = entry.value;
                final isNotifications = item['screen'] == 'Notifications';
                return Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => widget.onOpen(item['screen'] as String),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: i < items.length - 1
                                ? dividerColor
                                : Colors.transparent,
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
                              color: Color.alphaBlend(
                                  (item['color'] as Color)
                                      .withValues(alpha: 0.12),
                                  Colors.white),
                              borderRadius: BorderRadius.circular(11),
                            ),
                            child: Center(
                              child: Text(item['icon'] as String,
                                  style: const TextStyle(fontSize: 18)),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(
                              item['label'] as String,
                              style: TextStyle(
                                  color: primaryText,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600),
                            ),
                          ),
                          if (isNotifications) const UnreadNotificationBadge(),
                          if (!isNotifications)
                            const Icon(Icons.chevron_right,
                                color: Color(0xFFB0BAD3), size: 18),
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
  const SettingsDetailScreen({
    required this.onBack,
    required this.isDarkMode,
    required this.onThemeChanged,
    this.initialPage = 'settings',
    super.key,
  });
  final VoidCallback onBack;
  final bool isDarkMode;
  final ValueChanged<bool> onThemeChanged;
  final String initialPage;

  @override
  State<SettingsDetailScreen> createState() => _SettingsDetailScreenState();
}

class _SettingsDetailScreenState extends State<SettingsDetailScreen> {
  final SettingsService _service = SettingsService();
  final TextEditingController _taxPinController = TextEditingController();
  Map<String, dynamic> _business = const {};
  Map<String, dynamic> _preferences = const {};
  List<Map<String, dynamic>> _currencies = const [];
  final Map<String, String> _simulations = {};
  String _themeMode = 'light';
  String? _error;
  bool _loading = true;
  bool _editingTaxPin = false;
  bool _showCurrencyPicker = false;
  String _page = 'settings';
  String _twoFactorStep = 'intro';
  String _twoFactorMethod = 'totp';
  final Map<String, bool> _paymentMethods = {
    'cash': true,
    'mpesa': true,
    'bank': false,
    'card': false,
    'credit': true,
  };
  List<Map<String, String>> _sessions = [
    {
      'id': 'current',
      'device': 'Android Phone',
      'model': 'Samsung Galaxy A54',
      'location': 'Nairobi, Kenya',
      'last': 'Now',
      'ip': '197.232.xx.xx',
    },
    {
      'id': 'desktop',
      'device': 'Desktop Browser',
      'model': 'Chrome on Windows 11',
      'location': 'Nairobi, Kenya',
      'last': '2 days ago',
      'ip': '197.232.xx.yy',
    },
    {
      'id': 'tablet',
      'device': 'Android Tablet',
      'model': 'Samsung Galaxy Tab A8',
      'location': 'Mombasa, Kenya',
      'last': '8 days ago',
      'ip': '105.160.xx.zz',
    },
  ];

  @override
  void initState() {
    super.initState();
    _page = widget.initialPage;
    _load();
  }

  @override
  void dispose() {
    _taxPinController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final result = await _service.load();
      if (!mounted) return;
      _apply(result);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  void _apply(Map<String, dynamic> result) {
    final business = result['business'] as Map? ?? const {};
    final preferences = result['preferences'] as Map? ?? const {};
    final theme = preferences['themeMode']?.toString() ?? 'light';
    setState(() {
      _business = Map<String, dynamic>.from(business);
      _preferences = Map<String, dynamic>.from(preferences);
      _currencies = (result['currencyOptions'] as List? ?? const [])
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
      _themeMode = theme;
      final paymentConfig = _preferences['paymentConfig'] as Map?;
      final methods = paymentConfig?['methods'] as Map?;
      if (methods != null) {
        for (final key in _paymentMethods.keys) {
          _paymentMethods[key] = methods[key] == true;
        }
      }
      _taxPinController.text = _business['taxPin']?.toString() ?? '';
      _loading = false;
      _error = null;
    });
    widget.onThemeChanged(_darkFor(theme));
  }

  bool _darkFor(String mode) =>
      mode == 'dark' ||
      (mode == 'auto' &&
          MediaQuery.platformBrightnessOf(context) == Brightness.dark);

  Future<void> _save(Map<String, Object?> patch) async {
    try {
      _apply(await _service.save(patch));
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    }
  }

  void _setTheme(String mode) {
    setState(() => _themeMode = mode);
    widget.onThemeChanged(_darkFor(mode));
    unawaited(_save({'themeMode': mode}));
  }

  void _setPreference(String key, bool value) {
    setState(() => _preferences = {..._preferences, key: value});
    unawaited(_save({key: value}));
  }

  void _simulate(String key) {
    if (_simulations[key] == 'loading') return;
    setState(() => _simulations[key] = 'loading');
    Future<void>.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _simulations[key] = 'done');
    });
    Future<void>.delayed(const Duration(seconds: 4), () {
      if (mounted) setState(() => _simulations[key] = 'idle');
    });
  }

  Color get _background =>
      widget.isDarkMode ? const Color(0xFF09152A) : const Color(0xFFF5F7FA);
  Color get _panel =>
      widget.isDarkMode ? const Color(0xFF0F2040) : Colors.white;
  Color get _text => widget.isDarkMode ? const Color(0xFFDCE6FF) : ink;
  Color get _muted => widget.isDarkMode ? const Color(0xFF7A8FBF) : muted;
  Color get _divider =>
      widget.isDarkMode ? const Color(0xFF1A3366) : const Color(0xFFE8ECF4);
  String _moneyLabel(String code) => (_currencies
          .firstWhere((item) => item['code'] == code,
              orElse: () => {'label': code})['label']
          ?.toString() ??
      code);

  Widget _section(String label) => Padding(
        padding: const EdgeInsets.only(left: 4, bottom: 8),
        child: Text(label.toUpperCase(),
            style: TextStyle(
                color: _muted,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: .8)),
      );

  Widget _card(List<Widget> children) => Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
            color: _panel,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _divider)),
        child: Column(children: children),
      );

  Widget _header(String title, VoidCallback back) => Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(16, 46, 16, 20),
        decoration:
            const BoxDecoration(gradient: LinearGradient(colors: [ink, navy])),
        child: Row(children: [
          IconButton(
              onPressed: back,
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              style: IconButton.styleFrom(
                  backgroundColor: Colors.white24,
                  fixedSize: const Size(36, 36))),
          const SizedBox(width: 12),
          Text(title,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800)),
        ]),
      );

  Widget _themeButton(String mode, IconData icon, String label) {
    final active = _themeMode == mode;
    return Expanded(
        child: OutlinedButton.icon(
      onPressed: () => _setTheme(mode),
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: active ? navy : _muted,
        backgroundColor: active ? navy.withValues(alpha: .10) : _panel,
        side:
            BorderSide(color: active ? navy : _divider, width: active ? 2 : 1),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ));
  }

  Widget _infoRow(String label, String value,
          {bool last = false, Widget? trailing}) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
            border: Border(
                bottom:
                    BorderSide(color: last ? Colors.transparent : _divider))),
        child: Row(children: [
          Expanded(
              child:
                  Text(label, style: TextStyle(color: _muted, fontSize: 13))),
          Flexible(
              child: trailing ??
                  Text(value,
                      textAlign: TextAlign.right,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          color: _text,
                          fontSize: 13,
                          fontWeight: FontWeight.w700)))
        ]),
      );

  Widget _toggleRow(String key, String label, String sub, {bool last = false}) {
    final value = _preferences[key] == true;
    return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
            border: Border(
                bottom:
                    BorderSide(color: last ? Colors.transparent : _divider))),
        child: Row(children: [
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(label,
                    style: TextStyle(
                        color: _text,
                        fontSize: 13,
                        fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(sub, style: TextStyle(color: _muted, fontSize: 11))
              ])),
          Switch(
              value: value,
              activeThumbColor: navy,
              onChanged: (next) => _setPreference(key, next))
        ]));
  }

  Widget _actionRow(IconData icon, Color color, String label, String sub,
      {VoidCallback? onTap, bool last = false, String? state}) {
    final loading = state == 'loading';
    final done = state == 'done';
    return InkWell(
        onTap: onTap,
        child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            decoration: BoxDecoration(
                border: Border(
                    bottom: BorderSide(
                        color: last ? Colors.transparent : _divider))),
            child: Row(children: [
              Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                      color: color.withValues(alpha: .12),
                      borderRadius: BorderRadius.circular(8)),
                  child: loading
                      ? Padding(
                          padding: const EdgeInsets.all(11),
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: color))
                      : Icon(done ? Icons.check : icon, color: color)),
              const SizedBox(width: 12),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(label,
                        style: TextStyle(
                            color: done ? color : _text,
                            fontSize: 13,
                            fontWeight: FontWeight.w700)),
                    Text(done ? '${label} complete' : sub,
                        style: TextStyle(
                            color: done ? color : _muted, fontSize: 11))
                  ])),
              Icon(done ? Icons.check_circle : Icons.chevron_right,
                  color: done ? color : _muted, size: 18)
            ])));
  }

  Widget _currencyPicker() => Scaffold(
      backgroundColor: _background,
      body: Column(children: [
        _header('Select Currency',
            () => setState(() => _showCurrencyPicker = false)),
        Expanded(
            child: ListView(padding: const EdgeInsets.all(16), children: [
          _card(_currencies.map((item) {
            final code = item['code']?.toString() ?? '';
            final active = _business['currency'] == code;
            return InkWell(
                onTap: () {
                  setState(() => _showCurrencyPicker = false);
                  unawaited(_save({'currency': code}));
                },
                child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 15),
                    decoration: BoxDecoration(
                        border: Border(bottom: BorderSide(color: _divider))),
                    child: Row(children: [
                      Expanded(
                          child: Text(item['label']?.toString() ?? code,
                              style: TextStyle(
                                  color: _text, fontWeight: FontWeight.w700))),
                      if (active) const Icon(Icons.check_circle, color: navy)
                    ])));
          }).toList())
        ])),
      ]));

  Widget _paymentMethodsView() {
    const details = [
      (
        'cash',
        'Cash',
        'Physical cash at counter',
        Icons.payments_outlined,
        Color(0xFF2E7D32)
      ),
      (
        'mpesa',
        'M-Pesa',
        'Mobile money (Safaricom)',
        Icons.phone_android,
        Color(0xFF2E7D32)
      ),
      (
        'bank',
        'Bank Transfer',
        'Direct bank / RTGS',
        Icons.account_balance_outlined,
        Color(0xFF0288D1)
      ),
      (
        'card',
        'Card (Visa/MC)',
        'POS terminal / tap-to-pay',
        Icons.credit_card,
        Color(0xFF7B1FA2)
      ),
      (
        'credit',
        'Credit / Tab',
        'Defer payment to customer account',
        Icons.receipt_long_outlined,
        Color(0xFFD32F2F)
      ),
    ];
    final active = _paymentMethods.values.where((value) => value).length;
    return Scaffold(
        backgroundColor: _background,
        body: Column(children: [
          Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 46, 16, 20),
              decoration: const BoxDecoration(
                  gradient: LinearGradient(colors: [ink, navy])),
              child: Row(children: [
                IconButton(
                    onPressed: () => setState(() => _page = 'settings'),
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    style: IconButton.styleFrom(
                        backgroundColor: Colors.white24,
                        fixedSize: const Size(36, 36))),
                const SizedBox(width: 12),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Payment Methods',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800)),
                  Text('$active of ${details.length} active',
                      style:
                          const TextStyle(color: Colors.white60, fontSize: 12))
                ])
              ])),
          Expanded(
              child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                  children: [
                _section('Accepted Payment Methods'),
                _card(details.asMap().entries.map((entry) {
                  final item = entry.value;
                  final enabled = _paymentMethods[item.$1] == true;
                  return Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 13),
                      decoration: BoxDecoration(
                          border: Border(
                              bottom: BorderSide(
                                  color: entry.key == details.length - 1
                                      ? Colors.transparent
                                      : _divider))),
                      child: Row(children: [
                        Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                                color: item.$5.withValues(alpha: .12),
                                borderRadius: BorderRadius.circular(8)),
                            child: Icon(item.$4, color: item.$5)),
                        const SizedBox(width: 12),
                        Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              Text(item.$2,
                                  style: TextStyle(
                                      color: _text,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800)),
                              Text(item.$3,
                                  style: TextStyle(color: _muted, fontSize: 11))
                            ])),
                        Switch(
                            value: enabled,
                            activeThumbColor: item.$5,
                            onChanged: (value) => setState(
                                () => _paymentMethods[item.$1] = value))
                      ]));
                }).toList()),
                const SizedBox(height: 4),
                Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                        color: navy.withValues(alpha: .08),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: navy.withValues(alpha: .2))),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Admin note',
                              style: TextStyle(
                                  color: Color(0xFF1565C0),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800)),
                          const SizedBox(height: 4),
                          Text(
                              'Disabled payment methods will be hidden from cashiers during checkout. Changes take effect immediately.',
                              style: TextStyle(
                                  color: _muted, fontSize: 12, height: 1.4))
                        ])),
                const SizedBox(height: 18),
                TextButton(
                    onPressed: () => unawaited(_save({
                          'paymentConfig': {'methods': _paymentMethods}
                        })),
                    style: TextButton.styleFrom(
                        backgroundColor: navy,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8))),
                    child: const Text('Save Payment Settings',
                        style: TextStyle(fontWeight: FontWeight.w800))),
              ])),
        ]));
  }

  Widget _sessionsView() {
    final others =
        _sessions.where((session) => session['id'] != 'current').toList();
    return Scaffold(
        backgroundColor: _background,
        body: Column(children: [
          Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 46, 16, 20),
              decoration: const BoxDecoration(
                  gradient: LinearGradient(colors: [ink, navy])),
              child: Row(children: [
                IconButton(
                    onPressed: () => setState(() => _page = 'settings'),
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    style: IconButton.styleFrom(
                        backgroundColor: Colors.white24,
                        fixedSize: const Size(36, 36))),
                const SizedBox(width: 12),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Active Sessions',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800)),
                  Text('${_sessions.length} devices logged in',
                      style:
                          const TextStyle(color: Colors.white60, fontSize: 12))
                ])
              ])),
          Expanded(
              child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                  children: [
                _section('This Device'),
                _card([_sessionTile(_sessions.first, current: true)]),
                if (others.isNotEmpty) ...[
                  _section('Other Devices'),
                  TextButton(
                      onPressed: () =>
                          setState(() => _sessions = [_sessions.first]),
                      style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFFD32F2F)),
                      child: const Align(
                          alignment: Alignment.centerRight,
                          child: Text('Sign out all'))),
                  _card(others.map((session) => _sessionTile(session)).toList())
                ],
                if (others.isEmpty)
                  Container(
                      padding: const EdgeInsets.all(24),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                          color: _panel,
                          borderRadius: BorderRadius.circular(8)),
                      child: Column(children: [
                        const Icon(Icons.verified_user,
                            color: Color(0xFF2E7D32), size: 38),
                        const SizedBox(height: 8),
                        Text('Only this device is active',
                            style: TextStyle(
                                color: _text, fontWeight: FontWeight.w800)),
                        Text('Your account is secure',
                            style: TextStyle(color: _muted, fontSize: 12))
                      ])),
                Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                        color: const Color(0xFFFFF8E1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFFE082))),
                    child: const Text(
                        'Security tip\nIf you do not recognise a session, revoke it immediately and change your PIN from User Profile.',
                        style: TextStyle(
                            color: Color(0xFF795548),
                            fontSize: 12,
                            height: 1.4))),
              ])),
        ]));
  }

  Widget _sessionTile(Map<String, String> session, {bool current = false}) =>
      Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
              border: Border(
                  bottom: BorderSide(
                      color: current ? Colors.transparent : _divider))),
          child: Row(children: [
            Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                    color: current ? navy : navy.withValues(alpha: .10),
                    borderRadius: BorderRadius.circular(8)),
                child: Icon(
                    current
                        ? Icons.phone_android
                        : session['id'] == 'desktop'
                            ? Icons.desktop_windows_outlined
                            : Icons.tablet_android_outlined,
                    color: current ? Colors.white : navy)),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Row(children: [
                    Flexible(
                        child: Text(session['device']!,
                            style: TextStyle(
                                color: _text, fontWeight: FontWeight.w800))),
                    if (current)
                      const Padding(
                          padding: EdgeInsets.only(left: 6),
                          child: Text('CURRENT',
                              style: TextStyle(
                                  color: Color(0xFF2E7D32),
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800)))
                  ]),
                  Text(session['model']!,
                      style: TextStyle(color: _muted, fontSize: 11)),
                  Text(
                      '${session['location']} · ${current ? session['ip'] : 'Last: ${session['last']}'}',
                      style: TextStyle(color: _muted, fontSize: 11)),
                  if (current)
                    const Padding(
                        padding: EdgeInsets.only(top: 5),
                        child: Row(children: [
                          Icon(Icons.circle, color: Color(0xFF2E7D32), size: 8),
                          SizedBox(width: 5),
                          Text('Active now',
                              style: TextStyle(
                                  color: Color(0xFF2E7D32),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700))
                        ]))
                ])),
            if (!current)
              TextButton(
                  onPressed: () => setState(() => _sessions
                      .removeWhere((item) => item['id'] == session['id'])),
                  style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFFD32F2F),
                      backgroundColor: const Color(0xFFFFEBEE)),
                  child: const Text('Revoke'))
          ]));

  Widget _twoFactorView() {
    final intro = _twoFactorStep == 'intro';
    final method = _twoFactorStep == 'method';
    final verify = _twoFactorStep == 'verify';
    final done = _twoFactorStep == 'done';
    final title = method
        ? 'Choose Method'
        : verify
            ? 'Verify Two-Factor Auth'
            : 'Two-Factor Auth';
    return Scaffold(
      backgroundColor: _background,
      body: Column(children: [
        Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 46, 16, 20),
            decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [ink, navy])),
            child: Row(children: [
              IconButton(
                  onPressed: () => setState(() {
                        if (intro || done) {
                          _page = 'settings';
                        } else {
                          _twoFactorStep = verify ? 'method' : 'intro';
                        }
                      }),
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  style: IconButton.styleFrom(
                      backgroundColor: Colors.white24,
                      fixedSize: const Size(36, 36))),
              const SizedBox(width: 12),
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800)),
                if (intro)
                  Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 2),
                      decoration: BoxDecoration(
                          color: const Color(0x40D32F2F),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: const Color(0x66EF9A9A))),
                      child: const Text('NOT ENABLED',
                          style: TextStyle(
                              color: Color(0xFFFF8A80),
                              fontSize: 10,
                              fontWeight: FontWeight.w800)))
              ])
            ])),
        Expanded(
          child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 80),
              children: [
                if (intro) ...[
                  const Center(
                      child:
                          Icon(Icons.shield_outlined, color: navy, size: 60)),
                  const SizedBox(height: 12),
                  const Center(
                      child: Text('Add Extra Security',
                          style: TextStyle(
                              color: ink,
                              fontSize: 20,
                              fontWeight: FontWeight.w800))),
                  const SizedBox(height: 8),
                  Text(
                      "Two-factor authentication adds a second layer of protection to your MobiDuka account. Even if someone knows your PIN, they can't sign in without your second factor.",
                      textAlign: TextAlign.center,
                      style:
                          TextStyle(color: _muted, fontSize: 14, height: 1.5)),
                  const SizedBox(height: 24),
                  _twoFactorBenefit(Icons.key_outlined, 'Stronger security',
                      'Prevents unauthorised access even if your PIN is compromised'),
                  _twoFactorBenefit(Icons.phone_android, 'Quick to set up',
                      'Takes less than 2 minutes - works on any device'),
                  _twoFactorBenefit(Icons.language, 'Works offline',
                      'Authenticator apps work without internet connection'),
                  const SizedBox(height: 16),
                  TextButton(
                      onPressed: () =>
                          setState(() => _twoFactorStep = 'method'),
                      style: TextButton.styleFrom(
                          backgroundColor: navy,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8))),
                      child: const Text('Enable Two-Factor Auth',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w800))),
                ],
                if (method) ...[
                  _twoFactorMethodTile('sms', Icons.sms_outlined, 'SMS OTP',
                      'Receive a one-time code by text message'),
                  _twoFactorMethodTile(
                      'totp',
                      Icons.lock_outline,
                      'Authenticator App',
                      'Use Google Authenticator, Authy, or any TOTP app',
                      recommended: true),
                ],
                if (verify) ...[
                  if (_twoFactorMethod == 'totp')
                    Container(
                        height: 160,
                        alignment: Alignment.center,
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                            color: navy,
                            borderRadius: BorderRadius.circular(8)),
                        child: const Icon(Icons.qr_code_2,
                            color: Colors.white, size: 110))
                  else
                    _card([
                      const Padding(
                          padding: EdgeInsets.all(16),
                          child: Text('Code sent to +254 712 *** 678'))
                    ]),
                  TextField(
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      textAlign: TextAlign.center,
                      decoration: const InputDecoration(
                          labelText: 'Enter 6-digit code',
                          hintText: '000000',
                          border: OutlineInputBorder())),
                  const SizedBox(height: 16),
                  TextButton(
                      onPressed: () => setState(() => _twoFactorStep = 'done'),
                      style: TextButton.styleFrom(
                          backgroundColor: navy,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8))),
                      child: const Text('Verify & Enable')),
                ],
                if (done) ...[
                  const Icon(Icons.verified_user,
                      color: Color(0xFF2E7D32), size: 64),
                  const SizedBox(height: 12),
                  const Center(
                      child: Text('2FA Enabled!',
                          style: TextStyle(
                              color: Color(0xFF2E7D32),
                              fontSize: 22,
                              fontWeight: FontWeight.w900))),
                  const SizedBox(height: 8),
                  Text(
                      "Your account is now protected with ${_twoFactorMethod == 'sms' ? 'SMS OTP' : 'Authenticator App'}. You'll be asked for a code on each new login.",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: _muted)),
                  const SizedBox(height: 20),
                  _card([
                    Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(children: [
                          Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                  color: const Color(0xFFE8F5E9),
                                  borderRadius: BorderRadius.circular(8)),
                              child: Icon(
                                  _twoFactorMethod == 'sms'
                                      ? Icons.phone_android
                                      : Icons.lock_outline,
                                  color: const Color(0xFF2E7D32))),
                          const SizedBox(width: 12),
                          Expanded(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                Text(
                                    _twoFactorMethod == 'sms'
                                        ? 'SMS OTP'
                                        : 'Authenticator App',
                                    style: TextStyle(
                                        color: _text,
                                        fontWeight: FontWeight.w800)),
                                const Text('● Active',
                                    style: TextStyle(
                                        color: Color(0xFF2E7D32), fontSize: 11))
                              ])),
                          Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                  color: const Color(0xFFE8F5E9),
                                  borderRadius: BorderRadius.circular(999)),
                              child: const Text('Enabled',
                                  style: TextStyle(
                                      color: Color(0xFF2E7D32),
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800)))
                        ]))
                  ]),
                  Container(
                      margin: const EdgeInsets.only(bottom: 18),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                          color: const Color(0xFFFFF8E1),
                          border: Border.all(color: const Color(0xFFFFE082)),
                          borderRadius: BorderRadius.circular(8)),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Backup codes',
                                style: TextStyle(
                                    color: Color(0xFF5D4037),
                                    fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            const Text(
                                'Save these in a safe place - they let you sign in if you lose your authenticator.',
                                style: TextStyle(
                                    color: Color(0xFF795548),
                                    fontSize: 12,
                                    height: 1.4)),
                            const SizedBox(height: 10),
                            GridView.count(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                crossAxisCount: 2,
                                childAspectRatio: 3.2,
                                crossAxisSpacing: 8,
                                mainAxisSpacing: 8,
                                children: [
                                  '7F2K-9PXM',
                                  '3Q8R-T6WN',
                                  'BH4J-K2VL',
                                  'XN9E-5CMR'
                                ]
                                    .map((code) => Container(
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                            color: _panel,
                                            border: Border.all(
                                                color: const Color(0xFFFFE082)),
                                            borderRadius:
                                                BorderRadius.circular(6)),
                                        child: Text(code,
                                            style: TextStyle(
                                                color: _text,
                                                fontFamily: 'monospace',
                                                fontSize: 12,
                                                fontWeight: FontWeight.w800))))
                                    .toList())
                          ])),
                  TextButton(
                      onPressed: () => setState(() => _twoFactorStep = 'intro'),
                      style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFFD32F2F),
                          backgroundColor: const Color(0xFFFFEBEE)),
                      child: const Text('Disable Two-Factor Auth')),
                ],
              ]),
        ),
      ]),
    );
  }

  Widget _twoFactorBenefit(IconData icon, String title, String sub) =>
      Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
              color: _panel, borderRadius: BorderRadius.circular(8)),
          child: Row(children: [
            Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                    color: navy.withValues(alpha: .10),
                    borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, color: navy)),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(title,
                      style:
                          TextStyle(color: _text, fontWeight: FontWeight.w800)),
                  Text(sub, style: TextStyle(color: _muted, fontSize: 11))
                ]))
          ]));

  Widget _twoFactorMethodTile(
          String key, IconData icon, String title, String sub,
          {bool recommended = false}) =>
      InkWell(
          onTap: () => setState(() {
                _twoFactorMethod = key;
                _twoFactorStep = 'verify';
              }),
          child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: _panel, borderRadius: BorderRadius.circular(8)),
              child: Row(children: [
                Icon(icon, color: navy, size: 28),
                const SizedBox(width: 14),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Row(children: [
                        Text(title,
                            style: TextStyle(
                                color: _text, fontWeight: FontWeight.w800)),
                        if (recommended)
                          Container(
                              margin: const EdgeInsets.only(left: 7),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                  color: navy.withValues(alpha: .12),
                                  borderRadius: BorderRadius.circular(999)),
                              child: const Text('RECOMMENDED',
                                  style: TextStyle(
                                      color: navy,
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800)))
                      ]),
                      Text(sub, style: TextStyle(color: _muted, fontSize: 12))
                    ])),
                const Icon(Icons.chevron_right, color: muted)
              ])));

  @override
  Widget build(BuildContext context) {
    if (_showCurrencyPicker) return _currencyPicker();
    if (_page == 'payments') return _paymentMethodsView();
    if (_page == 'sessions') return _sessionsView();
    if (_page == 'twoFactor') return _twoFactorView();
    final business = _business;
    final currency = business['currency']?.toString() ?? 'KES';
    return SizedBox.expand(
        child: Scaffold(
            backgroundColor: _background,
            body: Column(children: [
              _header('Settings', widget.onBack),
              Expanded(
                  child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                      children: [
                    if (_error != null)
                      Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                              color: const Color(0xFFFFEBEE),
                              borderRadius: BorderRadius.circular(8)),
                          child: Text(_error!,
                              style: const TextStyle(
                                  color: Color(0xFFC62828), fontSize: 12))),
                    if (_loading)
                      const Center(
                          child: Padding(
                              padding: EdgeInsets.all(32),
                              child: CircularProgressIndicator(color: navy))),
                    if (!_loading) ...[
                      _section('Appearance'),
                      _card([
                        Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Theme',
                                      style: TextStyle(
                                          color: _text,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700)),
                                  const SizedBox(height: 12),
                                  Row(children: [
                                    _themeButton('light',
                                        Icons.light_mode_outlined, 'Light'),
                                    const SizedBox(width: 8),
                                    _themeButton('dark',
                                        Icons.dark_mode_outlined, 'Dark'),
                                    const SizedBox(width: 8),
                                    _themeButton('auto',
                                        Icons.brightness_auto_outlined, 'Auto')
                                  ])
                                ]))
                      ]),
                      _section('Business Information'),
                      _card([
                        _infoRow('Business Name',
                            business['name']?.toString() ?? '-'),
                        _infoRow(
                            'Location',
                            [business['branch'], business['country']]
                                    .where((value) =>
                                        value?.toString().isNotEmpty == true)
                                    .join(', ')
                                    .isEmpty
                                ? '-'
                                : [business['branch'], business['country']]
                                    .where((value) =>
                                        value?.toString().isNotEmpty == true)
                                    .join(', ')),
                        _infoRow('Phone', business['phone']?.toString() ?? '-'),
                        Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                                border: Border(
                                    bottom: BorderSide(color: _divider))),
                            child: _editingTaxPin
                                ? Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                        Text('Tax PIN',
                                            style: TextStyle(
                                                color: _muted, fontSize: 13)),
                                        const SizedBox(height: 8),
                                        TextField(
                                            controller: _taxPinController,
                                            textCapitalization:
                                                TextCapitalization.characters,
                                            decoration: const InputDecoration(
                                                isDense: true,
                                                hintText: 'Enter Tax PIN',
                                                border: OutlineInputBorder())),
                                        const SizedBox(height: 8),
                                        Align(
                                            alignment: Alignment.centerRight,
                                            child: TextButton.icon(
                                                onPressed: () {
                                                  setState(() =>
                                                      _editingTaxPin = false);
                                                  unawaited(_save({
                                                    'taxPin': _taxPinController
                                                        .text
                                                        .trim()
                                                  }));
                                                },
                                                icon: const Icon(Icons.check,
                                                    size: 16),
                                                label: const Text(
                                                    'Save Tax PIN'),
                                                style: TextButton.styleFrom(
                                                    backgroundColor: navy,
                                                    foregroundColor: Colors
                                                        .white,
                                                    padding: const EdgeInsets
                                                        .symmetric(
                                                        horizontal: 12,
                                                        vertical: 8),
                                                    shape:
                                                        RoundedRectangleBorder(
                                                            borderRadius:
                                                                BorderRadius
                                                                    .circular(
                                                                        8)))))
                                      ])
                                : Row(children: [
                                    Expanded(
                                        child: Text('Tax PIN',
                                            style: TextStyle(
                                                color: _muted, fontSize: 13))),
                                    Flexible(
                                        child: Text(
                                            business['taxPin']?.toString() ??
                                                '-',
                                            textAlign: TextAlign.right,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                                color: _text,
                                                fontFamily: 'monospace',
                                                fontWeight: FontWeight.w700))),
                                    IconButton(
                                        onPressed: () => setState(
                                            () => _editingTaxPin = true),
                                        icon: const Icon(Icons.edit_outlined,
                                            size: 17, color: navy))
                                  ])),
                        _infoRow('Currency', _moneyLabel(currency),
                            last: true,
                            trailing: TextButton(
                                onPressed: () =>
                                    setState(() => _showCurrencyPicker = true),
                                child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(_moneyLabel(currency),
                                          overflow: TextOverflow.ellipsis),
                                      const Icon(Icons.chevron_right)
                                    ])))
                      ]),
                      _section('Preferences'),
                      _card([
                        _toggleRow('receiptPrint', 'Auto-print Receipt',
                            'Print receipt after every sale'),
                        _toggleRow('lowStockAlerts', 'Low Stock Alerts',
                            'Notify when stock is below reorder level'),
                        _toggleRow(
                            'salesNotifications',
                            'Sales Completed Alerts',
                            'Notify after each completed sale'),
                        _toggleRow('dailyReport', 'Daily Report Email',
                            'Send end-of-day report to email'),
                        _toggleRow('autoBackup', 'Auto Cloud Backup',
                            'Backup data daily at midnight'),
                        _toggleRow('mpesaEnabled', 'M-Pesa Integration',
                            'Accept M-Pesa payments',
                            last: true)
                      ]),
                      _section('Admin Area'),
                      _card([
                        _actionRow(
                            Icons.credit_card_outlined,
                            const Color(0xFF0288D1),
                            'Payment Methods',
                            'Cash · M-Pesa · Bank · Credit',
                            onTap: () => setState(() => _page = 'payments')),
                        _actionRow(
                            Icons.receipt_long_outlined,
                            const Color(0xFF5E35B1),
                            'Receipt Settings',
                            'Logo, footer text, print format'),
                        _actionRow(
                            Icons.assured_workload_outlined,
                            const Color(0xFF2E7D32),
                            'Tax & Compliance',
                            'PIN: ${business['taxPin']?.toString() ?? '-'}',
                            last: true)
                      ]),
                      _section('Security'),
                      _card([
                        _actionRow(Icons.phone_android_outlined, navy,
                            'Active Sessions', '3 devices logged in',
                            onTap: () => setState(() => _page = 'sessions')),
                        _actionRow(
                            Icons.security_outlined,
                            const Color(0xFF2E7D32),
                            'Two-Factor Auth',
                            'Not enabled',
                            onTap: () => setState(() => _page = 'twoFactor'),
                            last: true)
                      ]),
                      _section('Data Management'),
                      _card([
                        _actionRow(
                            Icons.cloud_upload_outlined,
                            const Color(0xFF0288D1),
                            'Backup Now',
                            'Last backup: Today 06:00 AM',
                            state: _simulations['backup'],
                            onTap: () => _simulate('backup')),
                        _actionRow(
                            Icons.ios_share_outlined,
                            const Color(0xFF2E7D32),
                            'Export Data (CSV)',
                            'Download all transactions',
                            state: _simulations['export'],
                            onTap: () => _simulate('export')),
                        _actionRow(
                            Icons.delete_outline,
                            const Color(0xFFF57C00),
                            'Clear Cache',
                            '12.4 MB used',
                            state: _simulations['cache'],
                            onTap: () => _simulate('cache'),
                            last: true)
                      ]),
                      Center(
                          child: Text(
                              'MobiDuka POS v1.1 · SmartScan Integrated',
                              style: TextStyle(color: _muted, fontSize: 12))),
                    ],
                  ])),
            ])));
  }
}

class LegacySettingsDetailScreen extends StatefulWidget {
  const LegacySettingsDetailScreen(
      {required this.onBack,
      required this.isDarkMode,
      required this.onThemeChanged,
      super.key});
  final VoidCallback onBack;
  final bool isDarkMode;
  final ValueChanged<bool> onThemeChanged;

  @override
  State<LegacySettingsDetailScreen> createState() =>
      _LegacySettingsDetailScreenState();
}

class _LegacySettingsDetailScreenState
    extends State<LegacySettingsDetailScreen> {
  bool receiptPrint = true;
  bool lowStockAlerts = true;
  bool dailyReport = false;
  bool autoBackup = true;
  bool mpesaEnabled = true;

  bool get isDarkMode => widget.isDarkMode;
  Color get pageBackground =>
      isDarkMode ? const Color(0xFF101522) : const Color(0xFFF5F7FA);
  Color get panelBackground =>
      isDarkMode ? const Color(0xFF192235) : Colors.white;
  Color get dividerColor =>
      isDarkMode ? const Color(0xFF2C3850) : const Color(0xFFF0F3F9);

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
              boxShadow: [
                BoxShadow(
                    color: Color(0x22000000),
                    blurRadius: 2,
                    offset: Offset(0, 1))
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: pageBackground,
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
                const Text('Settings',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800)),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
              children: [
                const Text('Business Information',
                    style: TextStyle(
                        color: muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: panelBackground,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
                  ),
                  child: Column(
                    children: [
                      _settingsRow('Business Name', 'MobiDuka Store'),
                      _settingsRow('Location', 'Nairobi CBD, Kenya'),
                      _settingsRow('Phone', '+254 712 345 678'),
                      _settingsRow('Tax PIN', 'A123456789B'),
                      _settingsRow('Currency', 'KES (Kenyan Shilling)',
                          isLast: true),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Appearance',
                    style: TextStyle(
                        color: muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: panelBackground,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: isDarkMode
                        ? const []
                        : const [
                            BoxShadow(
                                color: Color(0x0F000000),
                                blurRadius: 8,
                                offset: Offset(0, 2))
                          ],
                  ),
                  child: _settingsToggleRow(
                    'Dark Mode',
                    'Use a darker interface across the store app',
                    isDarkMode,
                    widget.onThemeChanged,
                    isLast: true,
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Preferences',
                    style: TextStyle(
                        color: muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: panelBackground,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
                  ),
                  child: Column(
                    children: [
                      _settingsToggleRow(
                          'Auto-print Receipt',
                          'Print receipt after every sale',
                          receiptPrint,
                          (value) => setState(() => receiptPrint = value)),
                      _settingsToggleRow(
                          'Low Stock Alerts',
                          'Notify when stock is below reorder level',
                          lowStockAlerts,
                          (value) => setState(() => lowStockAlerts = value)),
                      _settingsToggleRow(
                          'Daily Report Email',
                          'Send end-of-day report to email',
                          dailyReport,
                          (value) => setState(() => dailyReport = value)),
                      _settingsToggleRow(
                          'Auto Cloud Backup',
                          'Backup data daily at midnight',
                          autoBackup,
                          (value) => setState(() => autoBackup = value)),
                      _settingsToggleRow(
                          'M-Pesa Integration',
                          'Accept M-Pesa payments',
                          mpesaEnabled,
                          (value) => setState(() => mpesaEnabled = value),
                          isLast: true),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Payment Methods',
                    style: TextStyle(
                        color: muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: panelBackground,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
                  ),
                  child: Column(
                    children: [
                      _paymentMethodRow('💵', 'Cash', true, '', false),
                      _paymentMethodRow(
                          '📱', 'M-Pesa', mpesaEnabled, '2.8% fee', false),
                      _paymentMethodRow('📋', 'Credit / Tab', true, '', false),
                      _paymentMethodRow(
                          '🏦', 'Bank Transfer', false, 'Offline', true),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Data Management',
                    style: TextStyle(
                        color: muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: panelBackground,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
                  ),
                  child: Column(
                    children: [
                      _actionRow(
                          '☁️',
                          'Backup Now',
                          'Last backup: Today 06:00 AM',
                          const Color(0xFF0288D1),
                          false),
                      _actionRow(
                          '📤',
                          'Export Data (CSV)',
                          'Download all transactions',
                          const Color(0xFF2E7D32),
                          false),
                      _actionRow('🗑️', 'Clear Cache', '12.4 MB used',
                          const Color(0xFFF57C00), true),
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
        border: Border(
            bottom: BorderSide(
                color: isLast ? Colors.transparent : dividerColor, width: 1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  color: muted, fontSize: 13, fontWeight: FontWeight.w600)),
          SizedBox(
            width: 180,
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                  color: isDarkMode ? Colors.white : ink,
                  fontSize: 13,
                  fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _settingsToggleRow(
      String label, String sub, bool value, ValueChanged<bool> onChanged,
      {bool isLast = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        border: Border(
            bottom: BorderSide(
                color: isLast ? Colors.transparent : dividerColor, width: 1)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                        color: isDarkMode ? Colors.white : ink,
                        fontSize: 13,
                        fontWeight: FontWeight.w700)),
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

  Widget _paymentMethodRow(
      String icon, String label, bool enabled, String tag, bool isLast) {
    final badgeColor =
        enabled ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE);
    final badgeText =
        enabled ? const Color(0xFF2E7D32) : const Color(0xFFD32F2F);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
            bottom: BorderSide(
                color: isLast ? Colors.transparent : dividerColor, width: 1)),
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
            child:
                Center(child: Text(icon, style: const TextStyle(fontSize: 18))),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label,
                style: const TextStyle(
                    color: ink, fontSize: 13, fontWeight: FontWeight.w700)),
          ),
          if (tag.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                  color: badgeColor, borderRadius: BorderRadius.circular(999)),
              child: Text(tag,
                  style: TextStyle(
                      color: badgeText,
                      fontSize: 10,
                      fontWeight: FontWeight.w700)),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                  color: enabled ? badgeColor : const Color(0xFFFFEBEE),
                  borderRadius: BorderRadius.circular(999)),
              child: Text(enabled ? 'Active' : 'Inactive',
                  style: TextStyle(
                      color: enabled ? badgeText : const Color(0xFFD32F2F),
                      fontSize: 10,
                      fontWeight: FontWeight.w700)),
            ),
        ],
      ),
    );
  }

  Widget _actionRow(
      String icon, String label, String sub, Color color, bool isLast) {
    return InkWell(
      onTap: () {},
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border(
              bottom: BorderSide(
                  color: isLast ? Colors.transparent : dividerColor, width: 1)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Color.alphaBlend(
                    color.withValues(alpha: 0.12), Colors.white),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Center(
                  child: Text(icon, style: const TextStyle(fontSize: 18))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          color: ink,
                          fontSize: 13,
                          fontWeight: FontWeight.w700)),
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
  const DetailScreen(
      {required this.title,
      required this.onBack,
      required this.isDarkMode,
      required this.onThemeChanged});
  final String title;
  final VoidCallback onBack;
  final bool isDarkMode;
  final ValueChanged<bool> onThemeChanged;
  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  bool editing = false;
  bool autoBackup = true;
  bool wifiOnly = true;

  @override
  Widget build(BuildContext context) {
    if (widget.title == 'Reports & Analytics')
      return ReportsScreen(onBack: widget.onBack);
    if (widget.title == 'Credit Book')
      return CreditBookScreen(onBack: widget.onBack);
    if (widget.title == 'Customers')
      return CustomersScreen(onBack: widget.onBack);
    if (widget.title == 'User Profile')
      return UserProfileDetailScreen(onBack: widget.onBack);
    if (widget.title == 'Settings')
      return SettingsDetailScreen(
        onBack: widget.onBack,
        isDarkMode: widget.isDarkMode,
        onThemeChanged: widget.onThemeChanged,
      );
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 20),
      children: [
        Row(children: [
          IconButton(
              onPressed: widget.onBack, icon: const Icon(Icons.arrow_back)),
          Expanded(
              child: Text(widget.title,
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.bold)))
        ]),
        const SizedBox(height: 12),
        ..._content(),
      ],
    );
  }

  List<Widget> _content() {
    switch (widget.title) {
      case 'Purchase Orders':
        return [
          SizedBox(
            height: MediaQuery.of(context).size.height - 150,
            child: PurchaseOrdersScreen(onBack: widget.onBack),
          ),
        ];
      case 'Suppliers':
        return [
          SizedBox(
            height: MediaQuery.of(context).size.height - 150,
            child: SupplierScreen(onBack: widget.onBack),
          ),
        ];
      case 'Credit Book':
        return [CreditBookScreen(onBack: widget.onBack)];
      case 'Customers':
        return [CustomersScreen(onBack: widget.onBack)];
      case 'Expense Tracking':
        return [
          SizedBox(
            height: MediaQuery.of(context).size.height - 150,
            child: ExpenseTrackingScreen(onBack: widget.onBack),
          ),
        ];
      case 'Employees':
        return [
          SizedBox(
            height: MediaQuery.of(context).size.height - 150,
            child: EmployeeScreen(onBack: widget.onBack),
          ),
        ];
      case 'Notifications':
        return [NotificationsScreen(onBack: widget.onBack)];
      case 'Backup & Cloud Sync':
        return [
          const Card(
              child: ListTile(
                  leading: Icon(Icons.cloud_done, color: Colors.green),
                  title: Text('Cloud Backup'),
                  subtitle:
                      Text('Last backup: Today, 06:00 AM\nAll data synced'))),
          FilledButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.cloud_upload),
              label: const Text('Backup Now')),
          SwitchListTile(
              title: const Text('Auto Backup'),
              subtitle: const Text('Every day at 6:00 AM'),
              value: autoBackup,
              onChanged: (value) => setState(() => autoBackup = value)),
          SwitchListTile(
              title: const Text('Wi-Fi Only'),
              value: wifiOnly,
              onChanged: (value) => setState(() => wifiOnly = value))
        ];
      case 'Settings':
        return [
          SettingsDetailScreen(
              onBack: widget.onBack,
              isDarkMode: widget.isDarkMode,
              onThemeChanged: widget.onThemeChanged)
        ];
      default:
        return [
          Card(
              child: ListTile(
                  title: Text(widget.title),
                  subtitle: const Text(
                      'MobiDuka Store · Nairobi CBD\nThis section is ready for local store data.')))
        ];
    }
  }

  List<Widget> _cards(List<(String, String, String, String)> values) =>
      values.map((item) {
        return Card(
          child: ListTile(
            title: Text(item.$1,
                style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('${item.$2}\n${item.$3}'),
            isThreeLine: true,
            trailing: Text(item.$4,
                style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
        );
      }).toList();
}

class LegacyUserProfileDetailScreen extends StatefulWidget {
  const LegacyUserProfileDetailScreen({required this.onBack, super.key});
  final VoidCallback onBack;

  @override
  State<LegacyUserProfileDetailScreen> createState() =>
      _LegacyUserProfileDetailScreenState();
}

class _LegacyUserProfileDetailScreenState
    extends State<LegacyUserProfileDetailScreen> {
  bool editing = false;
  bool changingPin = false;
  bool saved = false;
  final Map<String, String> form = {
    'name': 'Admin User',
    'phone': '0712 345 678',
    'email': 'owner@mobiduka.com',
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

  Widget _field(String label, String value, ValueChanged<String> onChanged,
          {bool isPassword = false}) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          editing
              ? TextField(
                  obscureText: isPassword,
                  controller: TextEditingController(text: value)
                    ..selection = TextSelection.collapsed(offset: value.length),
                  onChanged: onChanged,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                )
              : Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: SizedBox(
                    width: double.infinity,
                    child: Text(
                      value,
                      style: const TextStyle(
                          color: ink,
                          fontSize: 14,
                          fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
        ],
      );

  Widget _securityRow(String icon, String label, String sub, VoidCallback onTap,
      {bool last = false}) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border(
              bottom: BorderSide(
                  color: last ? Colors.transparent : const Color(0xFFF0F3F9),
                  width: 1)),
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
              child: Center(
                  child: Text(icon, style: const TextStyle(fontSize: 18))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          color: ink,
                          fontSize: 13,
                          fontWeight: FontWeight.w700)),
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
                  const Text('Change PIN',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800)),
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
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
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
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text('Update PIN',
                              style: TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.w800)),
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
                    const Text('User Profile',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w800)),
                    const Spacer(),
                    TextButton(
                      onPressed: () => setState(() => editing = !editing),
                      style: TextButton.styleFrom(
                        backgroundColor: editing
                            ? gold
                            : Colors.white.withValues(alpha: 0.12),
                        foregroundColor: editing ? ink : Colors.white,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text(editing ? 'Cancel' : 'Edit',
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w700)),
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
                          gradient:
                              LinearGradient(colors: [gold, Color(0xFFF0D060)]),
                          shape: BoxShape.circle,
                          border: Border.fromBorderSide(
                              BorderSide(color: Color(0x55FFFFFF), width: 3)),
                        ),
                        child: const Center(
                            child: Text('A',
                                style: TextStyle(
                                    color: ink,
                                    fontSize: 30,
                                    fontWeight: FontWeight.w800))),
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
                              border: Border.fromBorderSide(
                                  BorderSide(color: Colors.white, width: 2)),
                            ),
                            child: const Center(
                                child:
                                    Text('✏️', style: TextStyle(fontSize: 12))),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Text(form['name'] ?? 'Admin User',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.25)),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text('Store Manager',
                      style: TextStyle(
                          color: Color(0xFFD4AF37),
                          fontSize: 11,
                          fontWeight: FontWeight.w700)),
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
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      border: Border.all(color: const Color(0xFFC8E6C9)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: const [
                        Text('✅', style: TextStyle(fontSize: 18)),
                        SizedBox(width: 10),
                        Text('Profile updated successfully',
                            style: TextStyle(
                                color: Color(0xFF2E7D32),
                                fontSize: 13,
                                fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                const Text('Personal Information',
                    style: TextStyle(
                        color: muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.6)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
                  ),
                  child: Column(
                    children: [
                      _field('Full Name', form['name'] ?? '',
                          (value) => setState(() => form['name'] = value)),
                      const SizedBox(height: 14),
                      _field('Phone Number', form['phone'] ?? '',
                          (value) => setState(() => form['phone'] = value)),
                      const SizedBox(height: 14),
                      _field('Email Address', form['email'] ?? '',
                          (value) => setState(() => form['email'] = value)),
                      if (editing)
                        Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: TextButton(
                            onPressed: _saveProfile,
                            style: TextButton.styleFrom(
                              backgroundColor: navy,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text('Save Changes',
                                style: TextStyle(
                                    fontSize: 15, fontWeight: FontWeight.w800)),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Store Information',
                    style: TextStyle(
                        color: muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.6)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
                  ),
                  child: Column(
                    children: [
                      _field('Store Name', form['store'] ?? '',
                          (value) => setState(() => form['store'] = value)),
                      const SizedBox(height: 14),
                      _field('Branch', form['branch'] ?? '',
                          (value) => setState(() => form['branch'] = value)),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Security',
                    style: TextStyle(
                        color: muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.6)),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
                  ),
                  child: Column(
                    children: [
                      _securityRow(
                          '🔐',
                          'Change PIN',
                          'Update your 4-digit login PIN',
                          () => setState(() => changingPin = true)),
                      _securityRow('📱', 'Active Sessions',
                          '1 device currently logged in', () {}),
                      _securityRow(
                          '🛡️', 'Two-Factor Auth', 'Not enabled', () {},
                          last: true),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                const Center(
                  child: Column(
                    children: [
                      Text('Member since January 2024',
                          style: TextStyle(
                              color: Color(0xFFB0BAD3), fontSize: 12)),
                      SizedBox(height: 2),
                      Text('MobiDuka POS · Store Manager',
                          style: TextStyle(
                              color: Color(0xFFB0BAD3), fontSize: 12)),
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
          Text(label,
              style: const TextStyle(
                  color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            keyboardType: TextInputType.number,
            maxLength: 4,
            obscureText: true,
            textAlign: TextAlign.center,
            controller: TextEditingController(text: pinForm[key] ?? '')
              ..selection =
                  TextSelection.collapsed(offset: (pinForm[key] ?? '').length),
            onChanged: (value) => setState(() => pinForm[key] = value),
            style: const TextStyle(
                fontSize: 28, letterSpacing: 12, fontWeight: FontWeight.w800),
            decoration: const InputDecoration(
              hintText: '••••',
              border: OutlineInputBorder(),
              contentPadding:
                  EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
          ),
        ],
      );
}

class UserProfileDetailScreen extends StatefulWidget {
  const UserProfileDetailScreen({required this.onBack, super.key});
  final VoidCallback onBack;

  @override
  State<UserProfileDetailScreen> createState() =>
      _UserProfileDetailScreenState();
}

class _UserProfileDetailScreenState extends State<UserProfileDetailScreen> {
  final ProfileService _service = ProfileService();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _currentPin = TextEditingController();
  final _newPin = TextEditingController();
  final _confirmPin = TextEditingController();
  Map<String, dynamic>? _profile;
  bool _loading = true;
  bool _editing = false;
  bool _changingPin = false;
  bool _saving = false;
  bool _pinDone = false;
  String? _securityPage;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final controller in [
      _name,
      _phone,
      _email,
      _currentPin,
      _newPin,
      _confirmPin
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final profile = await _service.load();
      if (!mounted) return;
      _apply(profile);
    } on Object catch (error) {
      if (mounted)
        setState(() {
          _loading = false;
          _error = error.toString().replaceFirst('Exception: ', '');
        });
    }
  }

  void _apply(Map<String, dynamic> profile) => setState(() {
        _profile = profile;
        _name.text = profile['name']?.toString() ?? '';
        _phone.text = profile['phone']?.toString() ?? '';
        _email.text = profile['email']?.toString() ?? '';
        _loading = false;
        _error = null;
      });

  Future<void> _saveProfile() async {
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Full name is required.');
      return;
    }
    setState(() => _saving = true);
    try {
      final profile = await _service.update(
          name: _name.text.trim(),
          phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
          email: _email.text.trim().isEmpty ? null : _email.text.trim());
      if (!mounted) return;
      _apply(profile);
      setState(() => _editing = false);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          backgroundColor: Color(0xFF2E7D32),
          content: Text('Profile updated successfully.')));
    } on Object catch (error) {
      if (mounted)
        setState(
            () => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _updatePin() async {
    final configured = _profile?['pinConfigured'] == true;
    if (configured && _currentPin.text.length != 4) {
      setState(() => _error = 'Enter your current 4-digit PIN.');
      return;
    }
    if (!RegExp(r'^\d{4}$').hasMatch(_newPin.text)) {
      setState(() => _error = 'New PIN must be 4 digits.');
      return;
    }
    if (_newPin.text != _confirmPin.text) {
      setState(() => _error = 'New PINs do not match.');
      return;
    }
    setState(() => _saving = true);
    try {
      final profile = await _service.updatePin(
          currentPin: configured ? _currentPin.text : null,
          newPin: _newPin.text);
      if (!mounted) return;
      _apply(profile);
      setState(() {
        _saving = false;
        _pinDone = true;
      });
    } on Object catch (error) {
      if (mounted)
        setState(() {
          _saving = false;
          _error = error.toString().replaceFirst('Exception: ', '');
        });
    }
  }

  void _openSettings(String page) => setState(() => _securityPage = page);
  String _initials() {
    final name = _profile?['name']?.toString() ?? 'User';
    return name
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty)
        .take(2)
        .map((word) => word[0])
        .join()
        .toUpperCase();
  }

  String _memberSince() {
    final date = DateTime.tryParse(_profile?['memberSince']?.toString() ?? '');
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];
    return date == null ? '-' : '${months[date.month - 1]} ${date.year}';
  }

  Widget _header(String title, VoidCallback onBack, {Widget? action}) =>
      Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 46, 16, 22),
          decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy])),
          child: Row(children: [
            IconButton(
                onPressed: onBack,
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                style: IconButton.styleFrom(
                    backgroundColor: Colors.white24,
                    fixedSize: const Size(36, 36))),
            const SizedBox(width: 12),
            Expanded(
                child: Text(title,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800))),
            if (action != null) action
          ]));
  Widget _section(String value) => Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Align(
          alignment: Alignment.centerLeft,
          child: Text(value.toUpperCase(),
              style: const TextStyle(
                  color: muted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: .6))));
  Widget _card(List<Widget> children) => Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          boxShadow: const [
            BoxShadow(
                color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))
          ]),
      child: Column(
          crossAxisAlignment: CrossAxisAlignment.start, children: children));
  Widget _field(String label, TextEditingController controller,
          {TextInputType? type, bool editable = true}) =>
      Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label,
                style: const TextStyle(
                    color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            editable
                ? TextField(
                    controller: controller,
                    keyboardType: type,
                    decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 12, vertical: 12)))
                : Text(controller.text.isEmpty ? '-' : controller.text,
                    style: const TextStyle(
                        color: ink, fontSize: 14, fontWeight: FontWeight.w700))
          ]));
  Widget _security(IconData icon, String label, String sub, VoidCallback action,
          {bool last = false}) =>
      InkWell(
          onTap: action,
          child: Container(
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                  border: Border(
                      bottom: BorderSide(
                          color: last
                              ? Colors.transparent
                              : const Color(0xFFF0F3F9)))),
              child: Row(children: [
                Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                        color: const Color(0xFFEEF3FF),
                        borderRadius: BorderRadius.circular(8)),
                    child: Icon(icon, color: navy)),
                const SizedBox(width: 12),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(label,
                          style: const TextStyle(
                              color: ink, fontWeight: FontWeight.w700)),
                      Text(sub,
                          style: const TextStyle(color: muted, fontSize: 11))
                    ])),
                const Icon(Icons.chevron_right,
                    color: Color(0xFFB0BAD3), size: 18)
              ])));

  Widget _pinView() {
    final configured = _profile?['pinConfigured'] == true;
    final contents = _pinDone
        ? <Widget>[
            const Icon(Icons.lock_outline, size: 52, color: navy),
            const SizedBox(height: 12),
            const Text('PIN Updated!',
                style: TextStyle(
                    color: ink, fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            const Text('Your new PIN is active.\nUse it on your next login.',
                textAlign: TextAlign.center,
                style: TextStyle(color: muted, fontSize: 13)),
            const SizedBox(height: 22),
            SizedBox(
                width: double.infinity,
                child: TextButton(
                    onPressed: () => setState(() {
                          _changingPin = false;
                          _pinDone = false;
                          _currentPin.clear();
                          _newPin.clear();
                          _confirmPin.clear();
                        }),
                    style: TextButton.styleFrom(
                        backgroundColor: navy,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8))),
                    child: const Text('Done'))),
          ]
        : <Widget>[
            if (_error != null)
              Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                      color: const Color(0xFFFFEBEE),
                      borderRadius: BorderRadius.circular(8)),
                  child: Text(_error!,
                      style: const TextStyle(
                          color: Color(0xFFC62828), fontSize: 12))),
            if (configured) _pinField('Current PIN', _currentPin),
            _pinField(configured ? 'New PIN' : 'Create PIN', _newPin),
            _pinField('Confirm New PIN', _confirmPin),
            SizedBox(
                width: double.infinity,
                child: TextButton(
                    onPressed: _saving ? null : _updatePin,
                    style: TextButton.styleFrom(
                        backgroundColor: navy,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 15),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8))),
                    child: Text(_saving ? 'Updating...' : 'Update PIN',
                        style: const TextStyle(fontWeight: FontWeight.w800)))),
          ];
    return Scaffold(
        backgroundColor: const Color(0xFFF5F7FA),
        body: Column(children: [
          _header(
              'Change PIN',
              () => setState(() {
                    _changingPin = false;
                    _pinDone = false;
                    _error = null;
                  })),
          Expanded(
              child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [_card(contents)])),
        ]));
  }

  Widget _pinField(String label, TextEditingController controller) => Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: const TextStyle(
                color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        TextField(
            controller: controller,
            obscureText: true,
            maxLength: 4,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 28, letterSpacing: 12, fontWeight: FontWeight.w800),
            decoration: const InputDecoration(
                hintText: '••••',
                counterText: '',
                border: OutlineInputBorder()))
      ]));

  @override
  Widget build(BuildContext context) {
    if (_securityPage != null) {
      return SettingsDetailScreen(
          onBack: () => setState(() => _securityPage = null),
          isDarkMode: Theme.of(context).brightness == Brightness.dark,
          onThemeChanged: (_) {},
          initialPage: _securityPage!);
    }
    if (_changingPin) return _pinView();
    final profile = _profile;
    final business = profile?['business'] as Map? ?? const {};
    return SizedBox.expand(
        child: Scaffold(
            backgroundColor: const Color(0xFFF5F7FA),
            body: Column(children: [
              Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(16, 46, 16, 24),
                  decoration: const BoxDecoration(
                      gradient: LinearGradient(colors: [ink, navy])),
                  child: Column(children: [
                    Row(children: [
                      IconButton(
                          onPressed: widget.onBack,
                          icon:
                              const Icon(Icons.arrow_back, color: Colors.white),
                          style: IconButton.styleFrom(
                              backgroundColor: Colors.white24,
                              fixedSize: const Size(36, 36))),
                      const SizedBox(width: 12),
                      const Expanded(
                          child: Text('User Profile',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800))),
                      TextButton(
                          onPressed: () => setState(() {
                                _editing = !_editing;
                                _error = null;
                              }),
                          style: TextButton.styleFrom(
                              backgroundColor: _editing ? gold : Colors.white24,
                              foregroundColor: _editing ? ink : Colors.white,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8))),
                          child: Text(_editing ? 'Cancel' : 'Edit')),
                    ]),
                    const SizedBox(height: 18),
                    CircleAvatar(
                        radius: 40,
                        backgroundColor: gold,
                        child: Text(_initials(),
                            style: const TextStyle(
                                color: ink,
                                fontSize: 30,
                                fontWeight: FontWeight.w800))),
                    const SizedBox(height: 10),
                    Text(profile?['name']?.toString() ?? 'Loading profile...',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800)),
                    Container(
                        margin: const EdgeInsets.only(top: 6),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                            color: gold.withValues(alpha: .24),
                            borderRadius: BorderRadius.circular(999)),
                        child: Text(profile?['role']?.toString() ?? 'User',
                            style: const TextStyle(
                                color: gold,
                                fontSize: 11,
                                fontWeight: FontWeight.w700)))
                  ])),
              Expanded(
                  child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                      children: [
                    if (_error != null)
                      Container(
                          margin: const EdgeInsets.only(bottom: 14),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                              color: const Color(0xFFFFEBEE),
                              borderRadius: BorderRadius.circular(8)),
                          child: Text(_error!,
                              style: const TextStyle(
                                  color: Color(0xFFC62828), fontSize: 12))),
                    if (_loading)
                      const Center(
                          child: Padding(
                              padding: EdgeInsets.all(32),
                              child: CircularProgressIndicator(color: navy))),
                    if (!_loading) ...[
                      _section('Personal Information'),
                      _card([
                        _field('Full Name', _name, editable: _editing),
                        _field('Phone Number', _phone,
                            type: TextInputType.phone, editable: _editing),
                        _field('Email Address', _email,
                            type: TextInputType.emailAddress,
                            editable: _editing),
                        if (_editing)
                          SizedBox(
                              width: double.infinity,
                              child: TextButton(
                                  onPressed: _saving ? null : _saveProfile,
                                  style: TextButton.styleFrom(
                                      backgroundColor: navy,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 14),
                                      shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(8))),
                                  child: Text(
                                      _saving ? 'Saving...' : 'Save Changes')))
                      ]),
                      _section('Store Information'),
                      _card([
                        _field(
                            'Store Name',
                            TextEditingController(
                                text: business['name']?.toString() ?? ''),
                            editable: false),
                        _field(
                            'Branch',
                            TextEditingController(
                                text: business['branch']?.toString() ?? ''),
                            editable: false)
                      ]),
                      _section('Security'),
                      _card([
                        _security(
                            Icons.lock_outline,
                            'Change PIN',
                            'Update your 4-digit login PIN',
                            () => setState(() {
                                  _changingPin = true;
                                  _error = null;
                                })),
                        _security(
                            Icons.phone_android_outlined,
                            'Active Sessions',
                            '3 devices currently logged in',
                            () => _openSettings('sessions')),
                        _security(Icons.security_outlined, 'Two-Factor Auth',
                            'Not enabled', () => _openSettings('twoFactor'),
                            last: true)
                      ]),
                      Center(
                          child: Text(
                              'Member since ${_memberSince()}\nMobiDuka POS · ${profile?['role'] ?? 'User'} · ${business['name'] ?? '-'} · ${business['branch'] ?? '-'}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                  color: Color(0xFFB0BAD3),
                                  fontSize: 12,
                                  height: 1.5)))
                    ]
                  ]))
            ])));
  }
}

class PurchaseOrdersScreen extends StatefulWidget {
  const PurchaseOrdersScreen({required this.onBack, super.key});
  final VoidCallback onBack;

  @override
  State<PurchaseOrdersScreen> createState() => _PurchaseOrdersScreenState();
}

class _PurchaseOrdersScreenState extends State<PurchaseOrdersScreen>
    with AutomaticKeepAliveClientMixin {
  final PurchaseOrderService _purchaseOrderService = PurchaseOrderService();

  String filter = 'all';
  _PurchaseOrderEntry? selected;
  bool showNew = false;
  bool _isLoading = true;
  bool _isSaving = false;
  String? _dataError;
  List<_PurchaseOrderEntry> orders = const [];
  final Map<String, TextEditingController> _itemControllers = {};
  final Map<String, TextEditingController> _costControllers = {};
  final TextEditingController _dueDateController = TextEditingController();
  final List<Map<String, dynamic>> orderItems = [];
  List<PurchaseOrderSupplier> suppliers = const [];
  List<PurchaseOrderProduct> _products = const [];
  final Map<String, String> newForm = {
    'supplierId': '',
    'dueDate': '',
    'notes': '',
  };

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  @override
  bool get wantKeepAlive => true;

  @override
  void dispose() {
    for (final controller in _itemControllers.values) {
      controller.dispose();
    }
    for (final controller in _costControllers.values) {
      controller.dispose();
    }
    _dueDateController.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    setState(() {
      _isLoading = true;
      _dataError = null;
    });
    try {
      final data = await Future.wait([
        _purchaseOrderService.loadPurchaseOrders(),
        _purchaseOrderService.loadSuppliers(),
        _purchaseOrderService.loadProducts(),
      ]);
      if (!mounted) return;
      setState(() {
        orders = (data[0] as List<Map<String, dynamic>>)
            .map(_mapRowToOrder)
            .toList();
        suppliers = data[1] as List<PurchaseOrderSupplier>;
        _products = data[2] as List<PurchaseOrderProduct>;
      });
    } catch (error) {
      if (mounted)
        setState(() =>
            _dataError = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  _PurchaseOrderEntry _mapRowToOrder(Map<String, dynamic> row) {
    final rawStatus = (row['status'] as String? ?? 'REQUESTED').toString();
    final status = _normalizeOrderStatus(rawStatus);

    final rawItems = row['items'];
    final decodedItems = rawItems is List ? rawItems : const [];

    return _PurchaseOrderEntry(
      id: row['id']?.toString() ?? '',
      orderNo: row['orderNo']?.toString() ?? row['id']?.toString() ?? '',
      supplier: (row['supplier'] as Map?)?['name']?.toString() ??
          'Unassigned supplier',
      date: _formatDisplayDate(row['createdAt'] as String?),
      items: decodedItems.length,
      itemLines: decodedItems.whereType<Map>().map((item) {
        final line = Map<String, dynamic>.from(item);
        final product = line['product'] as Map?;
        final quantity = line['quantity'] ?? 0;
        final cost = line['costPrice'] ?? 0;
        return {
          'name': product?['name'] ?? 'Product',
          'qty': quantity,
          'unit': product?['unit'] ?? 'units',
          'cost': cost,
          'total': _number(quantity) * _number(cost)
        };
      }).toList(),
      total: _number(row['totalCost']).round(),
      status: status,
      dueDate: _formatDisplayDate(row['dueDate']?.toString()),
    );
  }

  num _number(Object? value) =>
      value is num ? value : num.tryParse(value?.toString() ?? '') ?? 0;

  String _normalizeOrderStatus(String status) {
    final value = status.trim().toLowerCase();
    if (value == 'requested') return 'pending';
    if (value == 'received') return 'delivered';
    return value.isEmpty ? 'pending' : value;
  }

  String _formatDisplayDate(String? rawDate) {
    if (rawDate == null || rawDate.isEmpty) return 'TBD';
    try {
      final parsed = DateTime.tryParse(rawDate);
      if (parsed == null) return 'TBD';
      return '${parsed.day} ${_monthShort(parsed.month)} ${parsed.year}';
    } catch (_) {
      return 'TBD';
    }
  }

  String _monthShort(int month) {
    const months = [
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
    ];
    return months[month - 1];
  }

  Future<void> _submitPurchaseOrder() async {
    final supplierId = newForm['supplierId'] ?? '';
    if (supplierId.isEmpty || orderItems.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Select a supplier and add at least one item.')),
      );
      return;
    }
    final draftedItems = orderItems.map((item) {
      final id = item['productId'] as String;
      final quantity = int.tryParse(_itemControllers[id]?.text ?? '') ?? 0;
      return <String, Object?>{
        'productId': id,
        'quantity': quantity,
        'costPrice': _number(_costControllers[id]?.text ?? item['cost'])
      };
    }).toList();
    if (draftedItems.any((item) => (item['quantity'] as int) < 1)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Every item needs a quantity of at least 1.')));
      return;
    }
    setState(() => _isSaving = true);
    try {
      await _purchaseOrderService.createPurchaseOrder(
        supplierId: supplierId,
        dueDate: newForm['dueDate'] ?? '',
        items: draftedItems,
      );
      if (!mounted) return;
      setState(() {
        newForm.addAll({'supplierId': '', 'dueDate': '', 'notes': ''});
        _dueDateController.clear();
        _clearDraftItems();
        showNew = false;
      });
      await _loadOrders();
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            backgroundColor: Color(0xFF2E7D32),
            content: Text('Purchase order submitted.')));
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', ''))));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _openNewOrder() {
    setState(() {
      newForm.addAll({'supplierId': '', 'dueDate': '', 'notes': ''});
      _dueDateController.clear();
      _clearDraftItems();
      showNew = true;
    });
  }

  Future<void> _markOrderReceived(_PurchaseOrderEntry order) async {
    setState(() => _isSaving = true);
    try {
      await _purchaseOrderService.markPurchaseOrderReceived(order.id);
      if (!mounted) return;
      setState(() => selected = null);
      await _loadOrders();
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            backgroundColor: Color(0xFF2E7D32),
            content: Text('Purchase order marked as received.')));
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', ''))));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  List<_PurchaseOrderEntry> get filteredOrders {
    if (filter == 'pending')
      return orders
          .where((o) => o.status == 'pending' || o.status == 'partial')
          .toList();
    if (filter == 'delivered')
      return orders.where((o) => o.status == 'delivered').toList();
    return orders;
  }

  void _addDraftItem() {
    final product = _products.firstWhere(
      (candidate) =>
          !orderItems.any((item) => item['productId'] == candidate.id),
      orElse: () =>
          const PurchaseOrderProduct(id: '', name: '', unit: '', costPrice: 0),
    );
    if (product.id.isEmpty) return;
    final item = <String, dynamic>{
      'productId': product.id,
      'name': product.name,
      'unit': product.unit,
      'cost': product.costPrice,
    };
    setState(() {
      orderItems.add(item);
      _itemControllers[product.id] = TextEditingController(text: '1');
      _costControllers[product.id] =
          TextEditingController(text: product.costPrice.toString());
    });
  }

  void _removeDraftItem(int index) {
    final item = orderItems.removeAt(index);
    _itemControllers.remove(item['productId'])?.dispose();
    _costControllers.remove(item['productId'])?.dispose();
    setState(() {});
  }

  void _changeDraftProduct(int index, String productId) {
    final product =
        _products.firstWhere((candidate) => candidate.id == productId);
    final oldId = orderItems[index]['productId'] as String;
    _itemControllers.remove(oldId)?.dispose();
    _costControllers.remove(oldId)?.dispose();
    _itemControllers[product.id] = TextEditingController(text: '1');
    _costControllers[product.id] =
        TextEditingController(text: product.costPrice.toString());
    setState(() => orderItems[index] = {
          'productId': product.id,
          'name': product.name,
          'unit': product.unit,
          'cost': product.costPrice,
        });
  }

  void _clearDraftItems() {
    for (final controller in _itemControllers.values) {
      controller.dispose();
    }
    for (final controller in _costControllers.values) {
      controller.dispose();
    }
    _itemControllers.clear();
    _costControllers.clear();
    orderItems.clear();
  }

  num get draftSubtotal {
    num total = 0;
    for (final item in orderItems) {
      final id = item['productId'] as String;
      final qty = int.tryParse(_itemControllers[id]?.text ?? '') ?? 0;
      final cost = _number(_costControllers[id]?.text ?? item['cost']);
      total += qty * cost;
    }
    return total;
  }

  num get draftTax => 0;
  num get draftTotal => draftSubtotal + draftTax;

  Color _statusColor(String status) {
    switch (status) {
      case 'pending':
        return const Color(0xFFF9A825);
      case 'delivered':
        return const Color(0xFF2E7D32);
      case 'partial':
        return const Color(0xFF0288D1);
      case 'cancelled':
        return const Color(0xFFD32F2F);
      default:
        return const Color(0xFF123A8F);
    }
  }

  String _statusLabel(String status) =>
      status[0].toUpperCase() + status.substring(1);

  Widget _statusBadge(String status) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        decoration: BoxDecoration(
          color: _statusColor(status).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
          border:
              Border.all(color: _statusColor(status).withValues(alpha: 0.25)),
        ),
        child: Text(
          _statusLabel(status),
          style: TextStyle(
              color: _statusColor(status),
              fontSize: 10,
              fontWeight: FontWeight.w800),
        ),
      );

  Widget _orderCard(_PurchaseOrderEntry order) => InkWell(
        onTap: () => setState(() => selected = order),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))
            ],
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
                        Text(order.orderNo,
                            style: const TextStyle(
                                color: ink,
                                fontSize: 13,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 2),
                        Text(order.supplier,
                            style: const TextStyle(color: muted, fontSize: 12)),
                      ],
                    ),
                  ),
                  _statusBadge(order.status),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('${order.items} items · Due ${order.dueDate}',
                      style: const TextStyle(color: muted, fontSize: 11)),
                  Text(
                      'KSh ${order.total.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}',
                      style: const TextStyle(
                          color: navy,
                          fontSize: 14,
                          fontWeight: FontWeight.w800)),
                ],
              ),
              const SizedBox(height: 8),
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
            boxShadow: const [
              BoxShadow(
                  color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))
            ],
          ),
          child: Column(
            children: [
              Text(value,
                  style: TextStyle(
                      color: color, fontSize: 15, fontWeight: FontWeight.w800)),
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
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
        child: Text(label.toUpperCase(),
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: active ? ink : Colors.white)),
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
                const Text('New Purchase Order',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800)),
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
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Order Details',
                          style: TextStyle(
                              color: ink,
                              fontSize: 13,
                              fontWeight: FontWeight.w800)),
                      const SizedBox(height: 16),
                      const Text('Supplier *',
                          style: TextStyle(
                              color: muted,
                              fontSize: 12,
                              fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      DropdownButtonFormField<String>(
                        value: newForm['supplierId']!.isEmpty
                            ? null
                            : newForm['supplierId'],
                        isExpanded: true,
                        hint: const Text('Select supplier...'),
                        decoration: const InputDecoration(
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(
                              horizontal: 12, vertical: 12),
                        ),
                        items: suppliers
                            .map((supplier) => DropdownMenuItem(
                                value: supplier.id,
                                child: Text(supplier.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis)))
                            .toList(),
                        selectedItemBuilder: (context) => suppliers
                            .map((supplier) => Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(supplier.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis),
                                ))
                            .toList(),
                        onChanged: (value) =>
                            setState(() => newForm['supplierId'] = value ?? ''),
                      ),
                      const SizedBox(height: 14),
                      const Text('Expected Delivery Date *',
                          style: TextStyle(
                              color: muted,
                              fontSize: 12,
                              fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _dueDateController,
                        readOnly: true,
                        decoration: const InputDecoration(
                          hintText: 'mm/dd/yyyy',
                          border: OutlineInputBorder(),
                          suffixIcon: Icon(Icons.calendar_today_outlined),
                          contentPadding: EdgeInsets.symmetric(
                              horizontal: 12, vertical: 12),
                        ),
                        onTap: () async {
                          final date = await showDatePicker(
                            context: context,
                            initialDate:
                                DateTime.now().add(const Duration(days: 1)),
                            firstDate: DateTime.now(),
                            lastDate:
                                DateTime.now().add(const Duration(days: 3650)),
                          );
                          if (date == null || !mounted) return;
                          final apiValue =
                              '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
                          setState(() {
                            newForm['dueDate'] = apiValue;
                            _dueDateController.text =
                                '${date.month.toString().padLeft(2, '0')}/${date.day.toString().padLeft(2, '0')}/${date.year}';
                          });
                        },
                      ),
                      const SizedBox(height: 14),
                      const Text('Notes',
                          style: TextStyle(
                              color: muted,
                              fontSize: 12,
                              fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      TextField(
                        minLines: 3,
                        maxLines: 5,
                        decoration: const InputDecoration(
                          hintText: 'Optional notes...',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(
                              horizontal: 12, vertical: 12),
                        ),
                        onChanged: (value) =>
                            setState(() => newForm['notes'] = value),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('Order Items',
                    style: TextStyle(
                        color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                ...orderItems.asMap().entries.map((entry) {
                  final index = entry.key;
                  final item = entry.value;
                  final productId = item['productId'] as String;
                  final lineTotal = (int.tryParse(
                              _itemControllers[productId]?.text ?? '') ??
                          0) *
                      _number(
                          _costControllers[productId]?.text ?? item['cost']);
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(children: [
                      Row(children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: productId,
                            isExpanded: true,
                            decoration: const InputDecoration(
                                isDense: true, border: OutlineInputBorder()),
                            items: _products
                                .map((product) => DropdownMenuItem(
                                    value: product.id,
                                    child: Text(product.name,
                                        overflow: TextOverflow.ellipsis)))
                                .toList(),
                            onChanged: (value) {
                              if (value != null)
                                _changeDraftProduct(index, value);
                            },
                          ),
                        ),
                        IconButton(
                            onPressed: () => _removeDraftItem(index),
                            icon: const Icon(Icons.close),
                            color: const Color(0xFFC62828),
                            tooltip: 'Remove item'),
                      ]),
                      const SizedBox(height: 8),
                      Row(children: [
                        Expanded(
                          child: TextField(
                            textAlign: TextAlign.center,
                            keyboardType: TextInputType.number,
                            controller: _itemControllers[productId],
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(
                              labelText: 'Quantity',
                              contentPadding: EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 8),
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            textAlign: TextAlign.center,
                            keyboardType: const TextInputType.numberWithOptions(
                                decimal: true),
                            controller: _costControllers[productId],
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(
                              labelText: 'Buying price (KSh)',
                              contentPadding: EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 8),
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                      ]),
                      const SizedBox(height: 8),
                      Align(
                          alignment: Alignment.centerRight,
                          child: Text(
                              '${item['unit']} · Line total: KSh $lineTotal',
                              style: const TextStyle(
                                  color: navy,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700)))
                    ]),
                  );
                }),
                OutlinedButton.icon(
                  onPressed:
                      _products.isEmpty || orderItems.length >= _products.length
                          ? null
                          : _addDraftItem,
                  icon: const Icon(Icons.add),
                  label: const Text('Add Item'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: navy,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: const BorderSide(color: navy, width: 1.5),
                  ),
                ),
                const SizedBox(height: 16),
                /*Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: const Color(0xFF123A8F),
                        width: 1.5,
                        style: BorderStyle.solid),
                  ),
                  child: const Center(
                    child: Text('+ Add Item',
                        style: TextStyle(
                            color: navy,
                            fontSize: 13,
                            fontWeight: FontWeight.w700)),
                  ),
                ),*/
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
                  ),
                  child: Column(
                    children: [
                      _totalsRow('Subtotal',
                          'KSh ${draftSubtotal.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}'),
                      _totalsRow('Tax (0%)',
                          'KSh ${draftTax.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}'),
                      _totalsRow('Total',
                          'KSh ${draftTotal.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}',
                          bold: true),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                TextButton(
                  onPressed: _isSaving ? null : _submitPurchaseOrder,
                  style: TextButton.styleFrom(
                    backgroundColor: navy,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: Text(
                      _isSaving ? 'Submitting...' : 'Submit Purchase Order',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w800)),
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
            Text(label,
                style: TextStyle(
                    color: bold ? ink : muted,
                    fontSize: bold ? 14 : 13,
                    fontWeight: bold ? FontWeight.w800 : FontWeight.w500)),
            Text(value,
                style: TextStyle(
                    color: bold ? navy : ink,
                    fontSize: bold ? 14 : 13,
                    fontWeight: bold ? FontWeight.w800 : FontWeight.w700)),
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
                          Text(order.orderNo,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800)),
                          Text(order.supplier,
                              style: const TextStyle(
                                  color: Colors.white60, fontSize: 12)),
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
                const Text('Order Items',
                    style: TextStyle(
                        color: ink, fontSize: 13, fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                ...order.itemLines.map((item) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: const [
                          BoxShadow(
                              color: Color(0x0F000000),
                              blurRadius: 8,
                              offset: Offset(0, 2))
                        ],
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item['name'] as String,
                                    style: const TextStyle(
                                        color: ink,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700)),
                                Text(
                                    '${item['qty']} ${item['unit']} × KSh ${item['cost']}',
                                    style: const TextStyle(
                                        color: muted, fontSize: 11)),
                              ],
                            ),
                          ),
                          Text('KSh ${item['total']}',
                              style: const TextStyle(
                                  color: navy,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800)),
                        ],
                      ),
                    )),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
                  ),
                  child: Column(
                    children: [
                      _totalsRow('Subtotal',
                          'KSh ${order.total.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}'),
                      _totalsRow(
                          'Received',
                          order.status == 'delivered'
                              ? 'KSh ${order.total.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}'
                              : 'KSh 0'),
                      _totalsRow(
                          'Balance',
                          order.status == 'delivered'
                              ? 'KSh 0'
                              : 'KSh ${order.total.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}'),
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
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text('Edit Order',
                              style: TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextButton(
                          onPressed: _isSaving
                              ? null
                              : () => _markOrderReceived(order),
                          style: TextButton.styleFrom(
                            foregroundColor: Colors.white,
                            backgroundColor: const Color(0xFF2E7D32),
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text('Mark Received',
                              style: TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w800)),
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
              Text(label,
                  style: const TextStyle(color: Colors.white60, fontSize: 9)),
              const SizedBox(height: 2),
              Text(value,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w800)),
            ],
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    super.build(context);
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
                if (_dataError != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(12),
                    color: const Color(0xFFFFEBEE),
                    child: Text(_dataError!,
                        style: const TextStyle(
                            color: Color(0xFFC62828), fontSize: 12)),
                  ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text('Purchase Orders',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w800)),
                      ],
                    ),
                    TextButton(
                      onPressed: _openNewOrder,
                      style: TextButton.styleFrom(
                        backgroundColor: gold,
                        foregroundColor: ink,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                      ),
                      child: const Text('+ New PO',
                          style: TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w800)),
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
                    _topMetric(
                        'KSh ${orders.fold<int>(0, (sum, order) => sum + order.total).toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',')}',
                        'This Month',
                        navy),
                    const SizedBox(width: 8),
                    _topMetric(
                        '${orders.where((order) => order.status == 'pending' || order.status == 'partial').length}',
                        'Pending',
                        const Color(0xFFF9A825)),
                    const SizedBox(width: 8),
                    _topMetric(
                        '${orders.where((order) => order.status == 'delivered').length}',
                        'Delivered',
                        const Color(0xFF2E7D32)),
                  ],
                ),
                const SizedBox(height: 12),
                if (_isLoading)
                  const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: CircularProgressIndicator()))
                else if (filteredOrders.isEmpty)
                  const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(
                          child: Text('No purchase orders found.',
                              style: TextStyle(color: muted))))
                else
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
    required this.orderNo,
    required this.supplier,
    required this.date,
    required this.items,
    required this.itemLines,
    required this.total,
    required this.status,
    required this.dueDate,
  });

  final String id;
  final String orderNo;
  final String supplier;
  final String date;
  final int items;
  final List<Map<String, dynamic>> itemLines;
  final int total;
  final String status;
  final String dueDate;
}

class ExpenseTrackingScreen extends StatefulWidget {
  const ExpenseTrackingScreen({required this.onBack, super.key});
  final VoidCallback onBack;
  @override
  State<ExpenseTrackingScreen> createState() => _ExpenseTrackingScreenState();
}

class _ExpenseTrackingScreenState extends State<ExpenseTrackingScreen> {
  final ExpenseService _service = ExpenseService();
  final _description = TextEditingController();
  final _amount = TextEditingController();
  final _otherCategory = TextEditingController();
  final _date = TextEditingController();
  List<Map<String, dynamic>> _expenses = const [];
  String _filter = 'All';
  String _category = 'Utilities';
  String _method = 'Cash';
  bool _recurring = false;
  bool _showAdd = false;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  static const _knownCategories = [
    'Utilities',
    'Payroll',
    'Rent',
    'Supplies',
    'Logistics'
  ];

  @override
  void initState() {
    super.initState();
    _resetForm();
    _load();
  }

  @override
  void dispose() {
    _description.dispose();
    _amount.dispose();
    _otherCategory.dispose();
    _date.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final expenses = await _service.loadExpenses();
      if (mounted)
        setState(() {
          _expenses = expenses;
          _error = null;
        });
    } catch (error) {
      if (mounted)
        setState(
            () => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _resetForm() {
    _description.clear();
    _amount.clear();
    _otherCategory.clear();
    _date.text = DateTime.now().toIso8601String().substring(0, 10);
    _category = 'Utilities';
    _method = 'Cash';
    _recurring = false;
  }

  String _normalizedCategory(Object? value) {
    final raw = value?.toString().trim() ?? '';
    final found = _knownCategories
        .where((item) => item.toLowerCase() == raw.toLowerCase());
    return found.isEmpty
        ? (raw.isEmpty
            ? 'Uncategorized'
            : '${raw[0].toUpperCase()}${raw.substring(1).toLowerCase()}')
        : found.first;
  }

  num _amountOf(Map<String, dynamic> expense) => expense['amount'] is num
      ? expense['amount'] as num
      : num.tryParse(expense['amount']?.toString() ?? '') ?? 0;
  List<String> get _categories => [
        'All',
        ...{
          ..._expenses
              .map((expense) => _normalizedCategory(expense['category']))
        }
      ];
  List<Map<String, dynamic>> get _filtered => _expenses
      .where((expense) =>
          _filter == 'All' ||
          _normalizedCategory(expense['category']) == _filter)
      .toList();
  num get _monthTotal {
    final now = DateTime.now();
    return _expenses.where((expense) {
      final date = DateTime.tryParse(expense['createdAt']?.toString() ?? '');
      return date?.year == now.year && date?.month == now.month;
    }).fold(0, (sum, expense) => sum + _amountOf(expense));
  }

  String _methodOf(Map<String, dynamic> expense) =>
      expense['paymentMethod']?.toString().isNotEmpty == true
          ? expense['paymentMethod'].toString()
          : 'Cash';
  IconData _icon(Map<String, dynamic> expense) {
    final text =
        '${expense['description']} ${expense['category']}'.toLowerCase();
    if (text.contains('rent')) return Icons.storefront;
    if (text.contains('salary') || text.contains('payroll'))
      return Icons.people;
    if (text.contains('transport') || text.contains('delivery'))
      return Icons.local_shipping;
    if (text.contains('electric') ||
        text.contains('water') ||
        text.contains('utilit')) return Icons.bolt;
    if (text.contains('suppl') || text.contains('packag'))
      return Icons.shopping_bag;
    return Icons.payments_outlined;
  }

  Color _categoryColor(String category) =>
      const {
        'Utilities': Color(0xFF0288D1),
        'Payroll': Color(0xFF5E35B1),
        'Rent': Color(0xFF2E7D32),
        'Supplies': Color(0xFFF57C00),
        'Logistics': Color(0xFFD32F2F)
      }[category] ??
      muted;
  Widget _header(String title, {Widget? action}) => Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 52, 16, 16),
      decoration:
          const BoxDecoration(gradient: LinearGradient(colors: [ink, navy])),
      child: Row(children: [
        IconButton(
            onPressed: widget.onBack,
            icon: const Icon(Icons.arrow_back),
            color: Colors.white,
            style: IconButton.styleFrom(
                backgroundColor: Colors.white.withValues(alpha: .12),
                fixedSize: const Size(36, 36))),
        const SizedBox(width: 12),
        Expanded(
            child: Text(title,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800))),
        if (action != null) action
      ]));
  Widget _card(Widget child, {EdgeInsets padding = const EdgeInsets.all(16)}) =>
      Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: padding,
          decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              boxShadow: const [
                BoxShadow(
                    color: Color(0x0F000000),
                    blurRadius: 8,
                    offset: Offset(0, 2))
              ]),
          child: child);
  Widget _label(String text) => Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(text,
          style: const TextStyle(
              color: muted, fontSize: 12, fontWeight: FontWeight.w700)));
  Widget _choice(String text, bool active, VoidCallback onTap,
          {Color color = navy}) =>
      ChoiceChip(
          label: Text(text),
          selected: active,
          onSelected: (_) => onTap(),
          selectedColor: color,
          labelStyle: TextStyle(
              color: active ? Colors.white : muted,
              fontSize: 12,
              fontWeight: FontWeight.w700));

  Future<void> _save() async {
    final amount = num.tryParse(_amount.text);
    final category =
        _category == 'Other' ? _otherCategory.text.trim() : _category;
    if (_description.text.trim().isEmpty ||
        amount == null ||
        amount <= 0 ||
        category.isEmpty) {
      setState(() =>
          _error = 'Enter a description, a positive amount, and a category.');
      return;
    }
    setState(() => _saving = true);
    try {
      await _service.createExpense(
          description: _description.text.trim(),
          amount: amount,
          category: category,
          paymentMethod: _method,
          recurring: _recurring,
          date: _date.text);
      if (!mounted) return;
      setState(() {
        _showAdd = false;
        _resetForm();
      });
      await _load();
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            backgroundColor: Color(0xFF2E7D32),
            content: Text('Expense saved.')));
    } catch (error) {
      if (mounted)
        setState(
            () => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_showAdd)
      return Scaffold(
          backgroundColor: const Color(0xFFF5F7FA),
          body: Column(children: [
            _header('Add Expense',
                action: IconButton(
                    onPressed: () => setState(() => _showAdd = false),
                    icon: const Icon(Icons.close),
                    color: Colors.white)),
            Expanded(
                child: ListView(padding: const EdgeInsets.all(16), children: [
              if (_error != null)
                _card(Text(_error!,
                    style: const TextStyle(color: Color(0xFFC62828)))),
              _card(Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _label('Description *'),
                    TextField(
                        controller: _description,
                        decoration: const InputDecoration(
                            hintText: 'e.g. Electricity Bill',
                            border: OutlineInputBorder())),
                    const SizedBox(height: 14),
                    _label('Amount (KSh) *'),
                    TextField(
                        controller: _amount,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 24, fontWeight: FontWeight.w800),
                        decoration: const InputDecoration(
                            hintText: '0.00', border: OutlineInputBorder())),
                    const SizedBox(height: 14),
                    _label('Category *'),
                    Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [..._knownCategories, 'Other']
                            .map((item) => _choice(item, _category == item,
                                () => setState(() => _category = item)))
                            .toList()),
                    if (_category == 'Other')
                      Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: TextField(
                              controller: _otherCategory,
                              decoration: const InputDecoration(
                                  hintText: 'Specify category (e.g. Marketing)',
                                  border: OutlineInputBorder()))),
                    const SizedBox(height: 14),
                    _label('Payment Method'),
                    Row(
                        children: ['Cash', 'M-Pesa', 'Bank']
                            .map((item) => Expanded(
                                child: Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: _choice(item, _method == item,
                                        () => setState(() => _method = item)))))
                            .toList()),
                    const SizedBox(height: 14),
                    _label('Date'),
                    TextField(
                        controller: _date,
                        readOnly: true,
                        decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            suffixIcon: Icon(Icons.calendar_today_outlined)),
                        onTap: () async {
                          final selected = await showDatePicker(
                              context: context,
                              initialDate: DateTime.tryParse(_date.text) ??
                                  DateTime.now(),
                              firstDate: DateTime(2020),
                              lastDate: DateTime.now()
                                  .add(const Duration(days: 3650)));
                          if (selected != null)
                            setState(() => _date.text =
                                selected.toIso8601String().substring(0, 10));
                        }),
                    const SizedBox(height: 14),
                    Container(
                        padding: const EdgeInsets.all(12),
                        color: const Color(0xFFF0F3F9),
                        child: Row(children: [
                          const Expanded(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                Text('Recurring Expense',
                                    style: TextStyle(
                                        color: ink,
                                        fontWeight: FontWeight.w700)),
                                Text('Repeats monthly',
                                    style:
                                        TextStyle(color: muted, fontSize: 11))
                              ])),
                          Switch(
                              value: _recurring,
                              activeColor: navy,
                              onChanged: (value) =>
                                  setState(() => _recurring = value))
                        ]))
                  ])),
              FilledButton(
                  onPressed: _saving ? null : _save,
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFD32F2F),
                      padding: const EdgeInsets.symmetric(vertical: 16)),
                  child: Text(_saving ? 'Saving...' : 'Save Expense'))
            ]))
          ]));
    final total =
        _filtered.fold<num>(0, (sum, expense) => sum + _amountOf(expense));
    return Column(children: [
      Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
          decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [ink, navy])),
          child: Column(children: [
            Row(children: [
              const Expanded(
                  child: Text('Expense Tracking',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800))),
              TextButton.icon(
                  onPressed: () => setState(() {
                        _error = null;
                        _resetForm();
                        _showAdd = true;
                      }),
                  icon: const Icon(Icons.add),
                  label: const Text('Add'),
                  style: TextButton.styleFrom(
                      backgroundColor: gold, foregroundColor: ink))
            ]),
            const SizedBox(height: 14),
            Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                    color: const Color(0x33D32F2F),
                    border: Border.all(color: const Color(0x4DEFA0A0)),
                    borderRadius: BorderRadius.circular(8)),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Total Expenses This Month',
                          style: TextStyle(
                              color: Color(0xBBFFFFFF), fontSize: 11)),
                      Text('KSh ${_monthTotal.toStringAsFixed(0)}',
                          style: const TextStyle(
                              color: Color(0xFFFF6B6B),
                              fontSize: 28,
                              fontWeight: FontWeight.w900))
                    ])),
            const SizedBox(height: 12),
            SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                    children: _categories
                        .map((category) => Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: _choice(category, _filter == category,
                                () => setState(() => _filter = category),
                                color: gold)))
                        .toList()))
          ])),
      Expanded(
          child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              children: [
            if (_error != null)
              _card(Text(_error!,
                  style: const TextStyle(color: Color(0xFFC62828)))),
            Text(
                '${_filter == 'All' ? 'All Expenses' : _filter} · KSh ${total.toStringAsFixed(0)}',
                style: const TextStyle(
                    color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator()))
            else if (_filtered.isEmpty)
              const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(
                      child: Text('No expenses found.',
                          style: TextStyle(color: muted))))
            else
              ..._filtered.map((expense) {
                final category = _normalizedCategory(expense['category']);
                return _card(Row(children: [
                  Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                          color:
                              _categoryColor(category).withValues(alpha: .12),
                          borderRadius: BorderRadius.circular(8)),
                      child: Icon(_icon(expense),
                          color: _categoryColor(category))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Row(children: [
                          Expanded(
                              child: Text(
                                  expense['description']?.toString() ??
                                      'Expense',
                                  style: const TextStyle(
                                      color: ink,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800))),
                          if (expense['recurring'] == true)
                            const Text('RECURRING',
                                style: TextStyle(
                                    color: navy,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800))
                        ]),
                        Text(
                            '$category · ${_methodOf(expense)} · ${expense['createdAt']?.toString().substring(0, 10) ?? ''}',
                            style: const TextStyle(color: muted, fontSize: 11))
                      ])),
                  Text('KSh ${_amountOf(expense).toStringAsFixed(0)}',
                      style: const TextStyle(
                          color: Color(0xFFD32F2F),
                          fontSize: 14,
                          fontWeight: FontWeight.w800))
                ]));
              })
          ]))
    ]);
  }
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

class LegacySupplierScreen extends StatefulWidget {
  const LegacySupplierScreen({required this.onBack, super.key});
  final VoidCallback onBack;

  @override
  State<LegacySupplierScreen> createState() => _LegacySupplierScreenState();
}

class _LegacySupplierScreenState extends State<LegacySupplierScreen> {
  final List<SupplierEntry> _suppliers = const [
    SupplierEntry(
        id: 1,
        name: 'Unga Limited',
        category: 'Flour & Grains',
        contact: 'James Mwenda',
        phone: '+254 20 330 0000',
        email: 'orders@unga.com',
        orders: 12,
        outstanding: 48000,
        initials: 'UL',
        color: Color(0xFF123A8F),
        rating: 5,
        terms: 'Net 30'),
    SupplierEntry(
        id: 2,
        name: 'Bidco Africa',
        category: 'Oils & Fats',
        contact: 'Sarah Kamau',
        phone: '+254 51 350 5000',
        email: 'supply@bidco.co.ke',
        orders: 8,
        outstanding: 0,
        initials: 'BA',
        color: Color(0xFF2E7D32),
        rating: 4,
        terms: 'Net 14'),
    SupplierEntry(
        id: 3,
        name: 'Procter & Gamble',
        category: 'FMCG',
        contact: 'Peter Otieno',
        phone: '+254 20 421 0000',
        email: 'kenya@pg.com',
        orders: 15,
        outstanding: 32500,
        initials: 'PG',
        color: Color(0xFF0288D1),
        rating: 5,
        terms: 'Net 21'),
    SupplierEntry(
        id: 4,
        name: 'Dawa Limited',
        category: 'Pharmaceuticals',
        contact: 'Dr. Mary Njeri',
        phone: '+254 20 802 8000',
        email: 'orders@dawa.co.ke',
        orders: 6,
        outstanding: 0,
        initials: 'DL',
        color: Color(0xFFD32F2F),
        rating: 4,
        terms: 'Prepaid'),
    SupplierEntry(
        id: 5,
        name: 'Brookside Dairy',
        category: 'Dairy Products',
        contact: 'Alice Wambui',
        phone: '+254 722 111 000',
        email: 'trade@brookside.co.ke',
        orders: 22,
        outstanding: 12000,
        initials: 'BD',
        color: Color(0xFF00796B),
        rating: 5,
        terms: 'COD'),
    SupplierEntry(
        id: 6,
        name: 'Kapa Oil',
        category: 'Cooking Oil',
        contact: 'David Kariuki',
        phone: '+254 20 534 5600',
        email: 'sales@kapaoil.co.ke',
        orders: 5,
        outstanding: 0,
        initials: 'KO',
        color: Color(0xFFF57C00),
        rating: 3,
        terms: 'Net 7'),
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

  int get totalOutstanding =>
      _suppliers.fold<int>(0, (sum, supplier) => sum + supplier.outstanding);

  List<SupplierEntry> get filteredSuppliers => _suppliers.where((supplier) {
        final query = search.toLowerCase();
        return supplier.name.toLowerCase().contains(query) ||
            supplier.category.toLowerCase().contains(query);
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
                  const Text('Add Supplier',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w700)),
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
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _formField(
                            'Business Name *',
                            'e.g. Unga Limited',
                            form['name'] ?? '',
                            (value) => setState(() => form['name'] = value)),
                        const SizedBox(height: 14),
                        _formField(
                            'Category *',
                            'e.g. Flour & Grains',
                            form['category'] ?? '',
                            (value) =>
                                setState(() => form['category'] = value)),
                        const SizedBox(height: 14),
                        _formField(
                            'Contact Person',
                            'Full name',
                            form['contact'] ?? '',
                            (value) => setState(() => form['contact'] = value)),
                        const SizedBox(height: 14),
                        _formField(
                            'Phone Number',
                            '+254 ...',
                            form['phone'] ?? '',
                            (value) => setState(() => form['phone'] = value)),
                        const SizedBox(height: 14),
                        _formField(
                            'Email Address',
                            'supplier@email.com',
                            form['email'] ?? '',
                            (value) => setState(() => form['email'] = value)),
                        const SizedBox(height: 16),
                        const Text('Payment Terms',
                            style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
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
                              items: [
                                'COD',
                                'Prepaid',
                                'Net 7',
                                'Net 14',
                                'Net 21',
                                'Net 30',
                                'Net 60'
                              ].map((value) {
                                return DropdownMenuItem<String>(
                                    value: value, child: Text(value));
                              }).toList(),
                              onChanged: (value) => setState(
                                  () => form['terms'] = value ?? 'Net 30'),
                              style: const TextStyle(
                                  color: ink,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600),
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
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Save Supplier',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w800)),
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
                      const Text('Supplier Profile',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w800)),
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
                          child: Text(supplier.initials,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(supplier.name,
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 17,
                                    fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            Text(supplier.category,
                                style: const TextStyle(
                                    color: Color(0x99FFFFFF), fontSize: 12)),
                            const SizedBox(height: 6),
                            Row(
                              children: List.generate(
                                  5,
                                  (index) => Icon(
                                        Icons.star,
                                        size: 11,
                                        color: index < supplier.rating
                                            ? gold
                                            : const Color(0x40FFFFFF),
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
                      _statCard(
                          'Outstanding',
                          supplier.outstanding > 0
                              ? 'KSh ${supplier.outstanding.toString()}'
                              : 'Cleared',
                          supplier.outstanding > 0
                              ? const Color(0xFFD32F2F)
                              : const Color(0xFF2E7D32)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Contact Information',
                            style: TextStyle(
                                color: ink,
                                fontSize: 13,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 12),
                        _detailRow('Contact Person', supplier.contact),
                        _detailRow('Phone', supplier.phone),
                        _detailRow('Email', supplier.email),
                        _detailRow('Payment Terms', supplier.terms,
                            isLast: true),
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
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text('New Order',
                              style: TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w800)),
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
                        child: const Center(
                            child: Text('📞', style: TextStyle(fontSize: 20))),
                      ),
                      const SizedBox(width: 10),
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE3EAF8),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Center(
                            child: Text('✉️', style: TextStyle(fontSize: 20))),
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
                        const Text('Suppliers',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w800)),
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
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                      ),
                      child: const Text('+ Add',
                          style: TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _metricCard('Total', '${_suppliers.length}', Colors.white),
                    const SizedBox(width: 8),
                    _metricCard(
                        'Outstanding',
                        'KSh ${(totalOutstanding / 1000).toStringAsFixed(0)}K',
                        const Color(0xFFFF6B6B)),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.14)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.search,
                          color: Color(0xCCFFFFFF), size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          onChanged: (value) => setState(() => search = value),
                          style: const TextStyle(
                              color: Colors.white, fontSize: 14),
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
                    boxShadow: const [
                      BoxShadow(
                          color: Color(0x0F000000),
                          blurRadius: 8,
                          offset: Offset(0, 2))
                    ],
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
                            child: Text(supplier.initials,
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(supplier.name,
                                  style: const TextStyle(
                                      color: ink,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800)),
                              const SizedBox(height: 3),
                              Text('${supplier.category} · ${supplier.terms}',
                                  style: const TextStyle(
                                      color: muted, fontSize: 11)),
                              const SizedBox(height: 4),
                              Row(
                                children: List.generate(
                                    5,
                                    (index) => Icon(
                                          Icons.star,
                                          size: 10,
                                          color: index < supplier.rating
                                              ? gold
                                              : const Color(0xFFE8ECF4),
                                        )),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('${supplier.orders} orders',
                                style: const TextStyle(
                                    color: muted, fontSize: 10)),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: hasOutstanding
                                    ? const Color(0xFFFFEBEE)
                                    : const Color(0xFFE8F5E9),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                hasOutstanding
                                    ? 'KSh ${(supplier.outstanding / 1000).toStringAsFixed(0)}K'
                                    : 'Settled',
                                style: TextStyle(
                                  color: hasOutstanding
                                      ? const Color(0xFFD32F2F)
                                      : const Color(0xFF2E7D32),
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
              Text(value,
                  style: TextStyle(
                      color: color, fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(label,
                  style:
                      const TextStyle(color: Color(0xCCFFFFFF), fontSize: 10)),
            ],
          ),
        ),
      );

  Widget _formField(String label, String hint, String value,
          ValueChanged<String> onChanged) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: TextEditingController(text: value)
              ..selection = TextSelection.collapsed(offset: value.length),
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
          boxShadow: const [
            BoxShadow(
                color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(label, style: const TextStyle(color: muted, fontSize: 11)),
            const SizedBox(height: 6),
            Text(value,
                style: TextStyle(
                    color: color, fontSize: 18, fontWeight: FontWeight.w800)),
          ],
        ),
      );

  Widget _detailRow(String label, String value, {bool isLast = false}) =>
      Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          border: Border(
              bottom: BorderSide(
                  color: isLast ? Colors.transparent : const Color(0xFFF0F3F9),
                  width: 1)),
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
                style: const TextStyle(
                    color: ink, fontSize: 13, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      );
}

class SupplierScreen extends StatefulWidget {
  const SupplierScreen({required this.onBack, super.key});
  final VoidCallback onBack;

  @override
  State<SupplierScreen> createState() => _SupplierScreenState();
}

class _SupplierScreenState extends State<SupplierScreen> {
  final SupplierService _service = SupplierService();
  final Map<String, TextEditingController> _controllers = {
    'name': TextEditingController(),
    'category': TextEditingController(),
    'contact': TextEditingController(),
    'phone': TextEditingController(),
    'email': TextEditingController(),
  };
  List<Map<String, dynamic>> _suppliers = const [];
  Map<String, dynamic>? _selected;
  String _search = '';
  bool _showAdd = false;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final suppliers = await _service.loadSuppliers();
      if (mounted)
        setState(() {
          _suppliers = suppliers;
          _error = null;
        });
    } catch (error) {
      if (mounted)
        setState(
            () => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered => _suppliers.where((supplier) {
        final query = _search.toLowerCase();
        return supplier['name']?.toString().toLowerCase().contains(query) ==
                true ||
            supplier['category']?.toString().toLowerCase().contains(query) ==
                true;
      }).toList();
  int _count(Map<String, dynamic> supplier, String key) =>
      ((supplier['_count'] as Map?)?[key] as num?)?.toInt() ?? 0;
  String _initials(Map<String, dynamic> supplier) =>
      (supplier['name']?.toString() ?? 'S')
          .split(RegExp(r'\s+'))
          .where((word) => word.isNotEmpty)
          .map((word) => word[0])
          .take(2)
          .join()
          .toUpperCase();
  String _text(Map<String, dynamic> supplier, String key,
          [String fallback = 'Not provided']) =>
      supplier[key]?.toString().trim().isNotEmpty == true
          ? supplier[key].toString()
          : fallback;
  Widget _card(Widget child, {EdgeInsets padding = const EdgeInsets.all(16)}) =>
      Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: padding,
          decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: const [
                BoxShadow(
                    color: Color(0x0F000000),
                    blurRadius: 8,
                    offset: Offset(0, 2))
              ]),
          child: child);
  Widget _header(String title, {Widget? action}) => Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 52, 16, 16),
      decoration:
          const BoxDecoration(gradient: LinearGradient(colors: [ink, navy])),
      child: Row(children: [
        IconButton(
            onPressed: widget.onBack,
            icon: const Icon(Icons.arrow_back),
            color: Colors.white,
            style: IconButton.styleFrom(
                backgroundColor: Colors.white.withValues(alpha: .12),
                fixedSize: const Size(36, 36))),
        const SizedBox(width: 12),
        Expanded(
            child: Text(title,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800))),
        if (action != null) action
      ]));

  Future<void> _save() async {
    final name = _controllers['name']!.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Business name is required.');
      return;
    }
    setState(() => _saving = true);
    try {
      await _service.createSupplier(
          name: name,
          category: _controllers['category']!.text,
          contact: _controllers['contact']!.text,
          phone: _controllers['phone']!.text,
          email: _controllers['email']!.text);
      if (!mounted) return;
      for (final controller in _controllers.values) {
        controller.clear();
      }
      setState(() => _showAdd = false);
      await _load();
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            backgroundColor: Color(0xFF2E7D32),
            content: Text('Supplier saved.')));
    } catch (error) {
      if (mounted)
        setState(
            () => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _field(String label, String key, String hint,
          {bool required = false}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          RichText(
            text: TextSpan(
              style: const TextStyle(
                  color: muted, fontSize: 12, fontWeight: FontWeight.w700),
              children: [
                TextSpan(text: label),
                if (required)
                  const TextSpan(
                      text: ' *', style: TextStyle(color: Color(0xFFD32F2F))),
              ],
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _controllers[key],
            keyboardType: key == 'phone'
                ? TextInputType.phone
                : key == 'email'
                    ? TextInputType.emailAddress
                    : TextInputType.text,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(color: Color(0xFF8B97AE)),
              border: const OutlineInputBorder(),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
          ),
        ]),
      );
  Widget _info(String label, String value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        Text(label, style: const TextStyle(color: muted, fontSize: 12)),
        const SizedBox(width: 12),
        Expanded(
            child: Text(value,
                textAlign: TextAlign.right,
                style: const TextStyle(
                    color: ink, fontSize: 13, fontWeight: FontWeight.w700)))
      ]));

  @override
  Widget build(BuildContext context) {
    if (_showAdd)
      return Scaffold(
          backgroundColor: const Color(0xFFF5F7FA),
          body: Column(children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
              decoration: const BoxDecoration(
                  gradient: LinearGradient(colors: [ink, navy])),
              child: Row(children: [
                IconButton(
                  onPressed: () => setState(() => _showAdd = false),
                  icon: const Icon(Icons.arrow_back),
                  color: Colors.white,
                  style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: .12),
                      fixedSize: const Size(36, 36)),
                ),
                const SizedBox(width: 12),
                const Text('Add Supplier',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700)),
              ]),
            ),
            Expanded(
                child: ListView(padding: const EdgeInsets.all(16), children: [
              _card(Column(children: [
                _field('Business Name', 'name', 'e.g. Unga Limited',
                    required: true),
                _field('Category', 'category', 'e.g. Flour & Grains',
                    required: true),
                _field('Contact Person', 'contact', 'Full name'),
                _field('Phone Number', 'phone', '+254 ...'),
                _field('Email Address', 'email', 'supplier@email.com')
              ])),
              if (_error != null)
                Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(_error!,
                        style: const TextStyle(color: Color(0xFFC62828)))),
              FilledButton(
                  onPressed: _saving ? null : _save,
                  style: FilledButton.styleFrom(
                      backgroundColor: navy,
                      padding: const EdgeInsets.symmetric(vertical: 16)),
                  child: Text(_saving ? 'Saving...' : 'Save Supplier'))
            ]))
          ]));
    final selected = _selected;
    if (selected != null)
      return Scaffold(
          backgroundColor: const Color(0xFFF5F7FA),
          body: Column(children: [
            _header('Supplier Profile',
                action: IconButton(
                    onPressed: () => setState(() {
                          _selected = null;
                          _showAdd = true;
                        }),
                    icon: const Icon(Icons.edit_outlined),
                    color: Colors.white)),
            Container(
                width: double.infinity,
                color: navy,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                child: Row(children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                        color: const Color(0xFF1A4FBF),
                        borderRadius: BorderRadius.circular(18)),
                    child: Center(
                        child: Text(_initials(selected),
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w800))),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text(_text(selected, 'name'),
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 17,
                                fontWeight: FontWeight.w800)),
                        Text(_text(selected, 'category', 'General supplier'),
                            style: const TextStyle(
                                color: Color(0x99FFFFFF), fontSize: 12))
                      ]))
                ])),
            Expanded(
                child: ListView(padding: const EdgeInsets.all(16), children: [
              Row(children: [
                Expanded(
                    child: _card(Column(children: [
                  const Text('Total Orders',
                      style: TextStyle(color: muted, fontSize: 11)),
                  Text('${_count(selected, 'purchaseOrders')}',
                      style: const TextStyle(
                          color: navy,
                          fontSize: 18,
                          fontWeight: FontWeight.w800))
                ]))),
                const SizedBox(width: 10),
                Expanded(
                    child: _card(Column(children: [
                  const Text('Products Supplied',
                      style: TextStyle(color: muted, fontSize: 11)),
                  Text('${_count(selected, 'products')}',
                      style: const TextStyle(
                          color: Color(0xFF2E7D32),
                          fontSize: 18,
                          fontWeight: FontWeight.w800))
                ])))
              ]),
              _card(Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Contact Information',
                        style: TextStyle(
                            color: ink,
                            fontSize: 13,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    _info('Contact Person', _text(selected, 'contactPerson')),
                    _info('Phone', _text(selected, 'phone')),
                    _info('Email', _text(selected, 'email'))
                  ])),
              Row(children: [
                Expanded(
                    child: FilledButton(
                        onPressed: () => widget.onBack(),
                        style: FilledButton.styleFrom(
                            backgroundColor: navy,
                            padding: const EdgeInsets.symmetric(vertical: 14)),
                        child: const Text('New Order'))),
                const SizedBox(width: 10),
                IconButton(
                    onPressed: () {},
                    icon: const Icon(Icons.phone),
                    color: const Color(0xFF2E7D32),
                    style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFFE8F5E9),
                        fixedSize: const Size(48, 48))),
                const SizedBox(width: 10),
                IconButton(
                    onPressed: () {},
                    icon: const Icon(Icons.email_outlined),
                    color: navy,
                    style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFFE3EAF8),
                        fixedSize: const Size(48, 48)))
              ])
            ]))
          ]));
    return Column(children: [
      Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
        decoration:
            const BoxDecoration(gradient: LinearGradient(colors: [ink, navy])),
        child: Column(children: [
          Row(children: [
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  const Text('Suppliers',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 10),
                  Text('${_suppliers.length}',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w800)),
                  const Text('Total Suppliers',
                      style: TextStyle(color: Color(0x99FFFFFF), fontSize: 10)),
                ])),
            TextButton.icon(
                onPressed: () => setState(() {
                      _error = null;
                      _selected = null;
                      for (final controller in _controllers.values) {
                        controller.clear();
                      }
                      _showAdd = true;
                    }),
                icon: const Icon(Icons.add, size: 17),
                label: const Text('Add'),
                style: TextButton.styleFrom(
                    backgroundColor: gold, foregroundColor: ink)),
          ]),
          const SizedBox(height: 14),
          TextField(
              onChanged: (value) => setState(() => _search = value),
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                  prefixIcon:
                      const Icon(Icons.search, color: Color(0xCCFFFFFF)),
                  hintText: 'Search suppliers...',
                  hintStyle: const TextStyle(color: Color(0xCCFFFFFF)),
                  filled: true,
                  fillColor: Colors.white.withValues(alpha: .12),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                  enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                          color: Colors.white.withValues(alpha: .2))))),
        ]),
      ),
      Expanded(
          child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              children: [
            if (_error != null)
              _card(Text(_error!,
                  style: const TextStyle(color: Color(0xFFC62828)))),
            if (_loading)
              const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator()))
            else if (_filtered.isEmpty)
              const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(
                      child: Text('No suppliers found.',
                          style: TextStyle(color: muted))))
            else
              ..._filtered.map((supplier) => InkWell(
                  onTap: () => setState(() => _selected = supplier),
                  child: _card(Row(children: [
                    Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                            color: navy,
                            borderRadius: BorderRadius.circular(14)),
                        child: Center(
                            child: Text(_initials(supplier),
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800)))),
                    const SizedBox(width: 12),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text(_text(supplier, 'name'),
                              style: const TextStyle(
                                  color: ink,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800)),
                          Text(_text(supplier, 'category', 'General supplier'),
                              style:
                                  const TextStyle(color: muted, fontSize: 11))
                        ])),
                    Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('${_count(supplier, 'purchaseOrders')} orders',
                              style:
                                  const TextStyle(color: muted, fontSize: 11)),
                          Text('${_count(supplier, 'products')} products',
                              style: const TextStyle(
                                  color: navy,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800))
                        ]),
                  ])))),
          ])),
    ]);
  }
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

  final String id;
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
  final EmployeeRepository _employeeRepository = EmployeeRepository();
  List<EmployeeEntry> _employees = [];

  final Map<String, Color> _roleColors = const {
    'Admin': Color(0xFF455A64),
    'Store Manager': Color(0xFF123A8F),
    'Cashier': Color(0xFF2E7D32),
    'Stock Keeper': Color(0xFF00796B),
    'Supervisor': Color(0xFF7B1FA2),
    'Accountant': Color(0xFFD4AF37),
  };

  final Map<String, List<String>> _rolePermissions = const {
    'Admin': ['View Platform Health', 'Manage Tenants', 'Manage Licenses'],
    'Store Manager': [
      'Full Access',
      'Edit Settings',
      'Manage Staff',
      'View Reports',
      'Process Sales',
      'Manage Inventory',
      'Add Expenses'
    ],
    'Supervisor': [
      'View Reports',
      'Process Sales',
      'Manage Inventory',
      'Override Discount',
      'View Expenses'
    ],
    'Cashier': ['Process Sales', 'View Products', 'View Customers'],
    'Stock Keeper': [
      'Manage Inventory',
      'View Products',
      'Create Purchase Orders'
    ],
    'Accountant': [
      'View Reports',
      'View Expenses',
      'Export Data',
      'Manage Credit'
    ],
  };

  bool _showForm = false;
  bool _showShifts = false;
  bool _loading = true;
  bool _saving = false;
  String? _error;
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

  @override
  void initState() {
    super.initState();
    _loadEmployees();
  }

  Future<void> _loadEmployees() async {
    try {
      final rows = await _employeeRepository.loadEmployees();
      if (!mounted) return;
      setState(() {
        _employees = rows.map(_mapEmployee).toList();
        _error = null;
      });
    } catch (error) {
      if (mounted)
        setState(
            () => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  EmployeeEntry _mapEmployee(Map<String, dynamic> row) {
    final role = (row['role'] as String? ?? 'CASHIER').toUpperCase();
    final normalizedRole = role == 'MANAGER' ? 'SUPERVISOR' : role;
    final displayRole = const {
          'OWNER': 'Store Manager',
          'ADMIN': 'Store Manager',
          'SUPERVISOR': 'Supervisor',
          'STOCK_KEEPER': 'Stock Keeper',
          'ACCOUNTANT': 'Accountant',
          'CASHIER': 'Cashier',
        }[normalizedRole] ??
        'Cashier';
    final name = row['fullName'] as String? ?? 'Employee';
    final initials = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .map((part) => part[0])
        .take(2)
        .join()
        .toUpperCase();
    return EmployeeEntry(
      id: row['id'] as String? ?? '',
      name: name,
      role: displayRole,
      phone: row['phone'] as String? ?? '',
      email: row['email'] as String? ?? '',
      pin: '',
      shift: row['shift']?.toString() ?? 'Morning',
      salary: (row['salary'] is num)
          ? (row['salary'] as num).round()
          : int.tryParse(row['salary']?.toString() ?? '') ?? 0,
      startDate: _displayDate(
          row['startDate']?.toString() ?? row['createdAt']?.toString()),
      active: row['status'] == 'ACTIVE',
      initials: initials.isEmpty ? 'EM' : initials,
      color: _roleColors[displayRole] ?? const Color(0xFF123A8F),
    );
  }

  String _displayDate(String? value) {
    final date = value == null ? null : DateTime.tryParse(value);
    if (date == null) return 'Not specified';
    return '${date.day}/${date.month}/${date.year}';
  }

  String _roleToApi(String role) =>
      const {
        'Store Manager': 'OWNER',
        'Supervisor': 'SUPERVISOR',
        'Stock Keeper': 'STOCK_KEEPER',
        'Accountant': 'ACCOUNTANT',
        'Cashier': 'CASHIER',
      }[role] ??
      'CASHIER';

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

  Future<void> _saveForm() async {
    final name = (_form['name'] as String).trim();
    if (name.isEmpty) return;

    setState(() => _saving = true);
    try {
      await _employeeRepository.saveEmployee(
        id: _editing?.id,
        fullName: name,
        email: _form['email'] as String,
        phone: _form['phone'] as String,
        role: _roleToApi(_form['role'] as String),
        shift: _form['shift'] as String,
        salary: num.tryParse(_form['salary'] as String) ?? 0,
        pin: (_form['pin'] as String).trim().isEmpty
            ? null
            : (_form['pin'] as String).trim(),
        active: _editing?.active ?? true,
      );
      if (!mounted) return;
      setState(() {
        _showForm = false;
        _selected = null;
      });
      await _loadEmployees();
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            backgroundColor: Color(0xFF2E7D32),
            content: Text('Employee saved.')));
    } catch (error) {
      if (mounted)
        setState(
            () => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggleActive(EmployeeEntry employee) async {
    setState(() => _saving = true);
    try {
      await _employeeRepository.saveEmployee(
        id: employee.id,
        fullName: employee.name,
        email: employee.email,
        phone: employee.phone,
        role: _roleToApi(employee.role),
        shift: employee.shift,
        salary: employee.salary,
        active: !employee.active,
      );
      if (!mounted) return;
      setState(() => _selected = null);
      await _loadEmployees();
    } catch (error) {
      if (mounted)
        setState(
            () => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_showShifts) {
      return ShiftManagementScreen(
        onBack: () => setState(() => _showShifts = false),
      );
    }
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
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700),
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
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Personal Information',
                            style: TextStyle(
                                color: ink,
                                fontSize: 13,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 14),
                        _fieldLabel('Full Name *',
                            value: _form['name'],
                            onChanged: (value) => _form['name'] = value),
                        const SizedBox(height: 14),
                        _fieldLabel('Phone Number *',
                            value: _form['phone'],
                            onChanged: (value) => _form['phone'] = value),
                        const SizedBox(height: 14),
                        _fieldLabel('Email Address',
                            value: _form['email'],
                            onChanged: (value) => _form['email'] = value),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Role & Access',
                            style: TextStyle(
                                color: ink,
                                fontSize: 13,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 14),
                        const Text('Role *',
                            style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            'Store Manager',
                            'Supervisor',
                            'Cashier',
                            'Stock Keeper',
                            'Accountant'
                          ].map((option) {
                            final selected = role == option;
                            return ChoiceChip(
                              label: Text(option),
                              selected: selected,
                              onSelected: (_) =>
                                  setState(() => _form['role'] = option),
                              selectedColor: _roleColors[option],
                              labelStyle: TextStyle(
                                  color: selected ? Colors.white : muted,
                                  fontWeight: FontWeight.w700),
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
                              Text('PERMISSIONS FOR ${role.toUpperCase()}',
                                  style: const TextStyle(
                                      color: muted,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800)),
                              const SizedBox(height: 8),
                              ...(_rolePermissions[role] ??
                                      const ['Full Access'])
                                  .map((permission) => Padding(
                                        padding:
                                            const EdgeInsets.only(bottom: 4),
                                        child: Row(
                                          children: [
                                            Container(
                                                width: 5,
                                                height: 5,
                                                decoration: BoxDecoration(
                                                    color: _roleColors[role],
                                                    shape: BoxShape.circle)),
                                            const SizedBox(width: 8),
                                            Text(permission,
                                                style: const TextStyle(
                                                    color: ink, fontSize: 11)),
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
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Work Details',
                            style: TextStyle(
                                color: ink,
                                fontSize: 13,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 14),
                        const Text('Shift',
                            style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Row(
                          children:
                              ['Morning', 'Afternoon', 'Evening'].map((option) {
                            final selected =
                                (_form['shift'] as String) == option;
                            return Expanded(
                              child: Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ChoiceChip(
                                  label: Text(option),
                                  selected: selected,
                                  onSelected: (_) =>
                                      setState(() => _form['shift'] = option),
                                  selectedColor: navy,
                                  labelStyle: TextStyle(
                                      color: selected ? Colors.white : muted,
                                      fontWeight: FontWeight.w700),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 14),
                        _fieldLabel('Monthly Salary (KSh)',
                            value: _form['salary'],
                            keyboardType: TextInputType.number,
                            onChanged: (value) => _form['salary'] = value),
                        const SizedBox(height: 14),
                        _fieldLabel('PIN (4 digits) *',
                            value: _form['pin'],
                            keyboardType: TextInputType.number,
                            onChanged: (value) => _form['pin'] = value,
                            maxLength: 4),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: _saving ? null : _saveForm,
                    style: TextButton.styleFrom(
                      backgroundColor: navy,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    child: Text(
                        _saving
                            ? 'Saving...'
                            : isEdit
                                ? 'Save Changes'
                                : 'Add Employee',
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (_selected != null) {
      final employee =
          _employees.firstWhere((item) => item.id == _selected!.id);
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
                      const Text('Employee Profile',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w700)),
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
                          child: Text(employee.initials,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(employee.name,
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800)),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: _roleColors[employee.role],
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(employee.role,
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700)),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: employee.active
                                        ? const Color(0xFF2E7D32)
                                        : const Color(0xFFD32F2F),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                      employee.active ? 'Active' : 'Inactive',
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700)),
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
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      children: [
                        _profileRow('Phone', employee.phone),
                        _profileRow('Email', employee.email),
                        _profileRow('Shift', employee.shift),
                        _profileRow('Monthly Salary',
                            'KSh ${employee.salary.toString()}'),
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
                      boxShadow: const [
                        BoxShadow(
                            color: Color(0x0F000000),
                            blurRadius: 8,
                            offset: Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Permissions',
                            style: TextStyle(
                                color: ink,
                                fontSize: 12,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 6,
                          runSpacing: 8,
                          children: (_rolePermissions[employee.role] ??
                                  const ['View Products'])
                              .map((permission) => Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE9EEFF),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(permission,
                                        style: const TextStyle(
                                            color: navy,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700)),
                                  ))
                              .toList(),
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
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text('Edit Details',
                              style: TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextButton(
                          onPressed:
                              _saving ? null : () => _toggleActive(employee),
                          style: TextButton.styleFrom(
                            backgroundColor: employee.active
                                ? const Color(0xFFFFF5F5)
                                : const Color(0xFFE8F5E9),
                            foregroundColor: employee.active
                                ? const Color(0xFFD32F2F)
                                : const Color(0xFF2E7D32),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                              side: BorderSide(
                                  color: employee.active
                                      ? const Color(0xFFFFCDD2)
                                      : const Color(0xFFC8E6C9)),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(
                              employee.active ? 'Deactivate' : 'Activate',
                              style: const TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w700)),
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
                        const Text('Employees',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w800)),
                      ],
                    ),
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      TextButton.icon(
                        onPressed: () => setState(() => _showShifts = true),
                        icon: const Icon(Icons.access_time, size: 16),
                        label: const Text('Shifts'),
                        style: TextButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.12),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 8),
                          textStyle: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ),
                      const SizedBox(width: 8),
                      TextButton(
                        onPressed: _openAdd,
                        style: TextButton.styleFrom(
                          backgroundColor: gold,
                          foregroundColor: ink,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                        ),
                        child: const Text('+ Register',
                            style: TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w800)),
                      ),
                    ]),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _summaryMetric(
                        'Total', '${_employees.length}', Colors.white),
                    const SizedBox(width: 8),
                    _summaryMetric(
                        'Active',
                        '${_employees.where((employee) => employee.active).length}',
                        const Color(0xFF4CAF50)),
                    const SizedBox(width: 8),
                    _summaryMetric(
                        'Inactive',
                        '${_employees.where((employee) => !employee.active).length}',
                        const Color(0xFFFF6B6B)),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              children: [
                if (_error != null)
                  Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(_error!,
                          style: const TextStyle(
                              color: Color(0xFFC62828), fontSize: 12))),
                if (_loading)
                  const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: CircularProgressIndicator()))
                else if (_employees.isEmpty)
                  const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(
                          child: Text('No employees registered yet.',
                              style: TextStyle(color: muted))))
                else
                  ..._employees.map((employee) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: const [
                          BoxShadow(
                              color: Color(0x0F000000),
                              blurRadius: 8,
                              offset: Offset(0, 2))
                        ],
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
                                child: Text(employee.initials,
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 17,
                                        fontWeight: FontWeight.w800)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(employee.name,
                                      style: const TextStyle(
                                          color: ink,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 7, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: Color.alphaBlend(
                                              _roleColors[employee.role]!
                                                  .withValues(alpha: 0.12),
                                              Colors.white),
                                          borderRadius:
                                              BorderRadius.circular(6),
                                        ),
                                        child: Text(employee.role,
                                            style: TextStyle(
                                                color:
                                                    _roleColors[employee.role],
                                                fontSize: 10,
                                                fontWeight: FontWeight.w800)),
                                      ),
                                      const SizedBox(width: 8),
                                      Text('${employee.shift} shift',
                                          style: const TextStyle(
                                              color: muted, fontSize: 10)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                    'KSh ${(employee.salary / 1000).toStringAsFixed(0)}K',
                                    style: const TextStyle(
                                        color: ink,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800)),
                                const SizedBox(height: 4),
                                Text(
                                    employee.active ? '● Active' : '● Inactive',
                                    style: TextStyle(
                                        color: employee.active
                                            ? const Color(0xFF2E7D32)
                                            : const Color(0xFFD32F2F),
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList()
              ],
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
              Text(value,
                  style: TextStyle(
                      color: color, fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 3),
              Text(label,
                  style:
                      const TextStyle(color: Color(0x99FFFFFF), fontSize: 10)),
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
  }) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: muted, fontSize: 12, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            keyboardType: keyboardType,
            maxLength: maxLength,
            controller: TextEditingController(text: value)
              ..selection = TextSelection.collapsed(offset: value.length),
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
                style: const TextStyle(
                    color: ink, fontSize: 13, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      );
}

class ShiftManagementScreen extends StatefulWidget {
  const ShiftManagementScreen({required this.onBack, super.key});
  final VoidCallback onBack;

  @override
  State<ShiftManagementScreen> createState() => _ShiftManagementScreenState();
}

class _ShiftManagementScreenState extends State<ShiftManagementScreen>
    with SingleTickerProviderStateMixin {
  final EmployeeRepository _repository = EmployeeRepository();
  late final AnimationController _liveController;
  late final Animation<double> _liveOpacity;
  List<Map<String, dynamic>> _employees = const [];
  List<Map<String, dynamic>> _types = const [];
  List<Map<String, dynamic>> _sessions = const [];
  String _view = 'list';
  String _selectedEmployee = '';
  String _selectedType = '';
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _liveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
      lowerBound: .38,
      upperBound: 1,
    )..repeat(reverse: true);
    _liveOpacity = _liveController;
    _load();
  }

  @override
  void dispose() {
    _liveController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await Future.wait([
        _repository.loadEmployees(),
        _repository.loadShiftTypes(),
        _repository.loadCashSessions()
      ]);
      if (!mounted) return;
      final sessions = (data[2] as List<Map<String, dynamic>>).toList()
        ..sort((left, right) => _openedAt(right).compareTo(_openedAt(left)));
      setState(() {
        _employees = (data[0] as List<Map<String, dynamic>>)
            .where((employee) => const {'CASHIER', 'SUPERVISOR'}
                .contains(employee['role']?.toString().toUpperCase()))
            .toList();
        _types = (data[1] as List<Map<String, dynamic>>).toList()
          ..sort((left, right) {
            final start = _minutes(left['scheduledStart']?.toString());
            final otherStart = _minutes(right['scheduledStart']?.toString());
            if (start != otherStart) return start - otherStart;
            return (left['name']?.toString() ?? '')
                .compareTo(right['name']?.toString() ?? '');
          });
        _sessions = sessions;
        _selectedEmployee = _selectedEmployee.isNotEmpty
            ? _selectedEmployee
            : (_availableEmployees.isEmpty
                ? ''
                : _availableEmployees.first['id']?.toString() ?? '');
        _selectedType = _selectedType.isNotEmpty
            ? _selectedType
            : (_availableTypes.isEmpty
                ? ''
                : _availableTypes.first['id']?.toString() ?? '');
        _error = null;
      });
      _publishActiveShiftNotice();
    } catch (error) {
      if (mounted)
        setState(
            () => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _availableEmployees =>
      _employees.where((employee) {
        final role = employee['role']?.toString().toUpperCase();
        final active = employee['status']?.toString() == 'ACTIVE';
        final isBusy = _sessions.any((session) =>
            session['closedAt'] == null &&
            session['cashierId']?.toString() == employee['id']?.toString());
        return active && (role == 'CASHIER' || role == 'SUPERVISOR') && !isBusy;
      }).toList();

  List<Map<String, dynamic>> get _availableTypes =>
      _types.where(_availableNow).toList();
  Map<String, dynamic>? get _active {
    final open = _sessions.where((session) => session['closedAt'] == null);
    return open.isEmpty ? null : open.first;
  }

  void _publishActiveShiftNotice() {
    final active =
        _sessions.where((session) => session['closedAt'] == null).toList();
    if (active.isEmpty) {
      activeShiftNotice.value = null;
      return;
    }
    final cashier = active.first['cashier'] as Map?;
    activeShiftNotice.value = ActiveShiftNotice(
      count: active.length,
      employeeName: cashier?['fullName']?.toString() ?? 'Team member',
    );
  }

  bool _availableNow(Map<String, dynamic> type) {
    final now = TimeOfDay.now();
    final current = now.hour * 60 + now.minute;
    final start = _minutes(type['scheduledStart']?.toString());
    final end = _minutes(type['scheduledEnd']?.toString());
    return start == end ||
        (start < end
            ? current >= start && current < end
            : current >= start || current < end);
  }

  int _minutes(String? raw) {
    final parts = (raw ?? '00:00').split(':');
    return (int.tryParse(parts.first) ?? 0) * 60 +
        (parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0);
  }

  Future<void> _start() async {
    if (_selectedEmployee.isEmpty || _selectedType.isEmpty) return;
    setState(() => _saving = true);
    try {
      await _repository.openShift(
          employeeId: _selectedEmployee, shiftTypeId: _selectedType);
      await _load();
      if (mounted) setState(() => _view = 'active');
    } catch (error) {
      if (mounted)
        setState(
            () => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _end(Map<String, dynamic> session) async {
    setState(() => _saving = true);
    try {
      await _repository.closeShift(
          employeeId: session['cashierId']?.toString() ?? '',
          sessionId: session['id']?.toString() ?? '');
      await _load();
      if (mounted) setState(() => _view = 'list');
    } catch (error) {
      if (mounted)
        setState(
            () => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _time(Object? raw) {
    final time = DateTime.tryParse(raw?.toString() ?? '');
    return time == null
        ? '--:--'
        : '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }

  DateTime _openedAt(Map<String, dynamic> session) =>
      DateTime.tryParse(session['openedAt']?.toString() ?? '') ??
      DateTime.fromMillisecondsSinceEpoch(0);

  String _name(Map? row) => row?['fullName']?.toString() ?? 'Unknown employee';
  Widget _header(String title, {Widget? action}) => Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 52, 16, 18),
      decoration:
          const BoxDecoration(gradient: LinearGradient(colors: [ink, navy])),
      child: Row(children: [
        IconButton(
            onPressed: widget.onBack,
            icon: const Icon(Icons.arrow_back),
            color: Colors.white,
            style: IconButton.styleFrom(
                backgroundColor: Colors.white.withValues(alpha: .12))),
        const SizedBox(width: 12),
        Expanded(
            child: Text(title,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800))),
        if (action != null) action
      ]));
  Widget _card({required Widget child}) => Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: const [
            BoxShadow(
                color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 2))
          ]),
      child: child);

  @override
  Widget build(BuildContext context) {
    final active = _active;
    if (_view == 'start')
      return Scaffold(
          backgroundColor: const Color(0xFFF5F7FA),
          body: Column(children: [
            _header('Start New Shift'),
            Expanded(
                child: ListView(padding: const EdgeInsets.all(16), children: [
              const Text('Shift Type',
                  style: TextStyle(
                      color: muted, fontSize: 12, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              _card(
                  child: Column(
                      children: _types.map((type) {
                final available = _availableNow(type);
                final selected = _selectedType == type['id'];
                return ListTile(
                    enabled: available,
                    onTap: () => available
                        ? setState(() => _selectedType = type['id'].toString())
                        : null,
                    leading:
                        Icon(Icons.schedule, color: selected ? navy : muted),
                    title: Text('${type['name']} Shift'),
                    subtitle: Text(
                        '${type['scheduledStart']} - ${type['scheduledEnd']}'),
                    trailing: selected
                        ? const Icon(Icons.check_circle, color: navy)
                        : null);
              }).toList())),
              const Text('Assign Cashier',
                  style: TextStyle(
                      color: muted, fontSize: 12, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              _card(
                  child: Column(
                      children: _availableEmployees
                          .map((employee) => ListTile(
                              onTap: () => setState(() => _selectedEmployee =
                                  employee['id'].toString()),
                              leading: CircleAvatar(
                                  backgroundColor: navy,
                                  child: Text(
                                      _name(employee)
                                          .split(' ')
                                          .map((word) =>
                                              word.isEmpty ? '' : word[0])
                                          .take(2)
                                          .join(),
                                      style: const TextStyle(
                                          color: Colors.white))),
                              title: Text(_name(employee)),
                              subtitle:
                                  Text(employee['role']?.toString() ?? ''),
                              trailing: _selectedEmployee == employee['id'] ? const Icon(Icons.check, color: navy) : null))
                          .toList())),
              if (_error != null)
                Text(_error!, style: const TextStyle(color: Color(0xFFC62828))),
              const SizedBox(height: 8),
              FilledButton.icon(
                  onPressed: _saving ? null : _start,
                  icon: const Icon(Icons.play_arrow),
                  label: Text(_saving ? 'Starting...' : 'Start Shift Now'),
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF2E7D32),
                      padding: const EdgeInsets.symmetric(vertical: 16)))
            ]))
          ]));
    if (_view == 'active' && active != null) {
      final cashier = active['cashier'] as Map?;
      final shift = active['shift'] as Map?;
      return Scaffold(
          backgroundColor: const Color(0xFFF5F7FA),
          body: Column(children: [
            _header('Active Shift',
                action: FadeTransition(
                    opacity: _liveOpacity,
                    child: const Chip(
                        label: Text('LIVE'),
                        backgroundColor: Color(0x55388E3C),
                        labelStyle: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800)))),
            Expanded(
                child: ListView(padding: const EdgeInsets.all(16), children: [
              _card(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(_name(cashier),
                        style: const TextStyle(
                            color: ink,
                            fontSize: 16,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(
                        '${shift?['name'] ?? active['shiftType']} Shift · Started ${_time(active['openedAt'])}',
                        style: const TextStyle(color: muted)),
                    const SizedBox(height: 16),
                    Row(children: [
                      _metric('Sales', '${active['sales'] ?? 0}'),
                      _metric('Revenue', 'KSh ${active['amount'] ?? 0}'),
                      _metric('Started', _time(active['openedAt']))
                    ])
                  ])),
              FilledButton.icon(
                  onPressed: _saving ? null : () => _end(active),
                  icon: const Icon(Icons.stop),
                  label: Text(_saving ? 'Ending...' : 'End Shift'),
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFD32F2F),
                      padding: const EdgeInsets.symmetric(vertical: 16)))
            ]))
          ]));
    }
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final session in _sessions) {
      final date = _date(session['openedAt']);
      grouped.putIfAbsent(date, () => []).add(session);
    }
    final today = _date(DateTime.now());
    final todaySessions = grouped[today] ?? const [];
    final todaySales = todaySessions.fold<int>(0,
        (total, session) => total + ((session['sales'] as num?)?.toInt() ?? 0));
    final todayRevenue = todaySessions.fold<num>(
        0, (total, session) => total + ((session['amount'] as num?) ?? 0));
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: Column(children: [
        _header('Shift Management',
            action: TextButton(
              onPressed: () async {
                await _load();
                if (mounted) setState(() => _view = 'start');
              },
              style: TextButton.styleFrom(
                  backgroundColor: gold,
                  foregroundColor: ink,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12))),
              child: const Text('+ Start',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
            )),
        Expanded(
            child: ListView(padding: const EdgeInsets.all(16), children: [
          if (_error != null)
            _card(
                child: Text(_error!,
                    style: const TextStyle(color: Color(0xFFC62828)))),
          if (_loading)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator()))
          else ...[
            if (active == null)
              Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                      color: const Color(0xFFFFF8E1),
                      border: Border.all(color: const Color(0xFFFFE082)),
                      borderRadius: BorderRadius.circular(14)),
                  child: Row(children: [
                    const Text('⏰', style: TextStyle(fontSize: 24)),
                    const SizedBox(width: 12),
                    const Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text('No Active Shift',
                              style: TextStyle(
                                  color: Color(0xFF5D4037),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800)),
                          SizedBox(height: 2),
                          Text('Start a shift to track cashier performance',
                              style: TextStyle(
                                  color: Color(0xFF8D6E63), fontSize: 12)),
                        ])),
                    TextButton(
                        onPressed: () => setState(() => _view = 'start'),
                        style: TextButton.styleFrom(
                            backgroundColor: gold, foregroundColor: ink),
                        child: const Text('Start',
                            style: TextStyle(fontWeight: FontWeight.w800)))
                  ])),
            Row(children: [
              _summaryCard('Today Shifts', '${todaySessions.length}'),
              const SizedBox(width: 10),
              _summaryCard('Today Sales', '$todaySales'),
              const SizedBox(width: 10),
              _summaryCard('Today Revenue', 'KSh ${_money(todayRevenue)}'),
            ]),
            const SizedBox(height: 16),
            ...grouped.entries.map((entry) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                            padding: const EdgeInsets.only(left: 4, bottom: 8),
                            child: Text(entry.key.toUpperCase(),
                                style: const TextStyle(
                                    color: muted,
                                    fontSize: 11,
                                    letterSpacing: .6,
                                    fontWeight: FontWeight.w800))),
                        ...entry.value.map((session) {
                          final isOpen = session['closedAt'] == null;
                          final shift = session['shift'] as Map?;
                          final shiftColor = _shiftColor(shift?['color']);
                          return _card(
                              child: InkWell(
                                  onTap: isOpen
                                      ? () => setState(() => _view = 'active')
                                      : null,
                                  child: Row(children: [
                                    CircleAvatar(
                                        radius: 22,
                                        backgroundColor: navy,
                                        child: Text(
                                            _initials(
                                                session['cashier'] as Map?),
                                            style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 14,
                                                fontWeight: FontWeight.w800))),
                                    const SizedBox(width: 12),
                                    Expanded(
                                        child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                          Row(children: [
                                            Flexible(
                                                child: Text(
                                                    _name(session['cashier']
                                                        as Map?),
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: const TextStyle(
                                                        color: ink,
                                                        fontSize: 13,
                                                        fontWeight:
                                                            FontWeight.w800))),
                                            const SizedBox(width: 8),
                                            Flexible(
                                                child: Container(
                                                    padding: const EdgeInsets
                                                        .symmetric(
                                                        horizontal: 8,
                                                        vertical: 3),
                                                    decoration: BoxDecoration(
                                                        color: shiftColor
                                                            .withValues(
                                                                alpha: .12),
                                                        borderRadius:
                                                            BorderRadius
                                                                .circular(999)),
                                                    child: Text(
                                                        '${shift?['icon'] ?? '🕐'} ${shift?['name'] ?? session['shiftType'] ?? 'Shift'}',
                                                        overflow: TextOverflow
                                                            .ellipsis,
                                                        style: TextStyle(
                                                            color: shiftColor,
                                                            fontSize: 10,
                                                            fontWeight:
                                                                FontWeight
                                                                    .w800))))
                                          ]),
                                          const SizedBox(height: 4),
                                          Text(
                                              '${_time(session['openedAt'])} → ${isOpen ? 'In progress' : _time(session['closedAt'])} · ${session['sales'] ?? 0} sales',
                                              style: const TextStyle(
                                                  color: muted, fontSize: 11))
                                        ])),
                                    const SizedBox(width: 8),
                                    Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.end,
                                        children: [
                                          Text(
                                              'KSh ${_money(session['amount'] as num? ?? 0)}',
                                              style: const TextStyle(
                                                  color: ink,
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w800)),
                                          const SizedBox(height: 4),
                                          isOpen
                                              ? FadeTransition(
                                                  opacity: _liveOpacity,
                                                  child: const Text(
                                                      '● In Progress',
                                                      style: TextStyle(
                                                          color:
                                                              Color(0xFF2E7D32),
                                                          fontSize: 10,
                                                          fontWeight:
                                                              FontWeight.w700)))
                                              : const Text('Closed',
                                                  style: TextStyle(
                                                      color: muted,
                                                      fontSize: 10,
                                                      fontWeight:
                                                          FontWeight.w700))
                                        ])
                                  ])));
                        })
                      ]),
                )),
          ],
        ])),
      ]),
    );
  }

  Widget _summaryCard(String label, String value) => Expanded(
          child: _card(
              child: Column(children: [
        Text(value,
            textAlign: TextAlign.center,
            style: const TextStyle(
                color: ink, fontSize: 15, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(label,
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted, fontSize: 10))
      ])));

  String _date(Object? raw) {
    final value =
        raw is DateTime ? raw : DateTime.tryParse(raw?.toString() ?? '');
    if (value == null) return 'Unknown date';
    return '${value.day}/${value.month}/${value.year}';
  }

  String _initials(Map? cashier) {
    final name = _name(cashier);
    return name
        .split(' ')
        .where((part) => part.isNotEmpty)
        .map((part) => part[0])
        .take(2)
        .join()
        .toUpperCase();
  }

  String _money(num value) => value.round().toString();

  Color _shiftColor(Object? raw) {
    final hex = raw?.toString().replaceFirst('#', '');
    final value = hex == null ? null : int.tryParse('FF$hex', radix: 16);
    return value == null ? navy : Color(value);
  }

  Widget _metric(String label, String value) => Expanded(
      child: Container(
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.all(8),
          color: const Color(0xFFF0F3F9),
          child: Column(children: [
            Text(label, style: const TextStyle(color: muted, fontSize: 10)),
            Text(value,
                style: const TextStyle(
                    color: ink, fontSize: 12, fontWeight: FontWeight.w800))
          ])));
}

class NotificationEntry {
  const NotificationEntry({
    this.id = '',
    required this.type,
    required this.title,
    required this.body,
    required this.time,
    required this.date,
    required this.read,
    required this.icon,
  });

  final String id;
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
  List<NotificationEntry> _items = const [];

  String _filter = 'all';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    try {
      final session = await AuthService().readSession();
      if (session == null)
        throw Exception('Please sign in to load notifications.');
      final remoteItems = await NotificationService().fetch(session);
      if (!mounted) return;
      setState(() {
        _items = remoteItems.map(_toEntry).toList();
        _loading = false;
        _error = null;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _items = [];
        _loading = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  NotificationEntry _toEntry(RemoteNotification item) => NotificationEntry(
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        time: _formatTime(item.createdAt),
        date: _formatDate(item.createdAt),
        read: item.read,
        icon: item.icon,
      );

  String _formatDate(DateTime value) {
    final now = DateTime.now();
    if (value.year == now.year &&
        value.month == now.month &&
        value.day == now.day) return 'Today';
    final yesterday = now.subtract(const Duration(days: 1));
    if (value.year == yesterday.year &&
        value.month == yesterday.month &&
        value.day == yesterday.day) return 'Yesterday';
    return 'Earlier';
  }

  String _formatTime(DateTime value) =>
      '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';

  int get unreadCount => _items.where((item) => !item.read).length;

  bool _isVisible(NotificationEntry item) => _filter == 'all' || !item.read;

  List<NotificationEntry> _sectionItems(String date) =>
      _items.where((item) => item.date == date && _isVisible(item)).toList();

  Future<void> _markAllRead() async {
    final session = await AuthService().readSession();
    if (session != null) {
      try {
        await NotificationService().markRead(session, all: true);
      } on Object catch (error) {
        if (mounted)
          setState(
              () => _error = error.toString().replaceFirst('Exception: ', ''));
        return;
      }
    }
    setState(() {
      for (var i = 0; i < _items.length; i++) {
        _items[i] = NotificationEntry(
          id: _items[i].id,
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

  Future<void> _markRead(NotificationEntry item) async {
    final session = await AuthService().readSession();
    if (item.read || item.id.isEmpty) return;
    if (session != null) {
      try {
        await NotificationService().markRead(session, id: item.id);
      } on Object catch (error) {
        if (mounted)
          setState(
              () => _error = error.toString().replaceFirst('Exception: ', ''));
        return;
      }
    }
    setState(() {
      for (var i = 0; i < _items.length; i++) {
        if (_items[i].id == item.id) {
          _items[i] = NotificationEntry(
            id: _items[i].id,
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

  Future<void> _deleteNotification(NotificationEntry item) async {
    if (!item.read || item.id.isEmpty) return;
    final session = await AuthService().readSession();
    if (session == null) return;
    try {
      await NotificationService().delete(session, item.id);
      if (mounted)
        setState(() => _items.removeWhere((entry) => entry.id == item.id));
    } on Object catch (error) {
      if (mounted) {
        setState(
            () => _error = error.toString().replaceFirst('Exception: ', ''));
      }
    }
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
                      icon: const Icon(Icons.arrow_back_ios_new_rounded,
                          size: 14, color: Colors.white70),
                      label: const Text('Back',
                          style:
                              TextStyle(color: Colors.white70, fontSize: 12)),
                      style: TextButton.styleFrom(padding: EdgeInsets.zero),
                    ),
                    if (unreadCount > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
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
                Row(
                  children: [
                    const Text(
                      'Notifications',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Spacer(),
                    if (unreadCount > 0)
                      TextButton(
                        onPressed: _markAllRead,
                        style: TextButton.styleFrom(
                          backgroundColor: Colors.white.withValues(alpha: 0.12),
                          foregroundColor: Colors.white70,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                        ),
                        child: const Text('Mark all read',
                            style: TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w600)),
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _filterChip('All', 'all'),
                    const SizedBox(width: 8),
                    _filterChip('Unread', 'unread'),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 18),
              children: [
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 48),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 24, 8, 12),
                    child: Text(_error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.red)),
                  ),
                if (today.isNotEmpty) _section('Today', today),
                if (yesterday.isNotEmpty) _section('Yesterday', yesterday),
                if (earlier.isNotEmpty) _section('Earlier', earlier),
                if (today.isEmpty && yesterday.isEmpty && earlier.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 48),
                    child: Center(
                      child: Text(
                        'No notifications',
                        style: TextStyle(
                            color: muted,
                            fontSize: 16,
                            fontWeight: FontWeight.w600),
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
      'critical': {
        'bg': const Color(0xFFFFF5F5),
        'border': const Color(0xFFFFCDD2),
        'dot': const Color(0xFFD32F2F)
      },
      'warning': {
        'bg': const Color(0xFFFFF8E1),
        'border': const Color(0xFFFFE082),
        'dot': const Color(0xFFF9A825)
      },
      'success': {
        'bg': const Color(0xFFF1F8E9),
        'border': const Color(0xFFC5E1A5),
        'dot': const Color(0xFF2E7D32)
      },
      'info': {
        'bg': const Color(0xFFE3F2FD),
        'border': const Color(0xFF90CAF9),
        'dot': const Color(0xFF0288D1)
      },
    }[item.type]!;

    return GestureDetector(
      onTap: () => _markRead(item),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: item.read ? Colors.white : palette['bg'] as Color,
          borderRadius: BorderRadius.circular(14),
          border: Border(
              left: BorderSide(
                  color:
                      item.read ? Colors.transparent : palette['dot'] as Color,
                  width: 3)),
          boxShadow: item.read
              ? const [
                  BoxShadow(
                      color: Color(0x0F000000),
                      blurRadius: 8,
                      offset: Offset(0, 2))
                ]
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
                color: item.read
                    ? const Color(0xFFF5F7FA)
                    : palette['bg'] as Color,
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
                            fontWeight:
                                item.read ? FontWeight.w600 : FontWeight.w700,
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
                      if (item.read)
                        GestureDetector(
                          onTap: () => _deleteNotification(item),
                          child: const Padding(
                            padding: EdgeInsets.only(left: 8),
                            child: Icon(Icons.close_rounded,
                                color: Color(0xFFB0BAD3), size: 18),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.body,
                    style: const TextStyle(
                        fontSize: 12, color: muted, height: 1.5),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.time,
                    style:
                        const TextStyle(fontSize: 11, color: Color(0xFFB0BAD3)),
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

class CreditBookScreen extends StatefulWidget {
  const CreditBookScreen(
      {required this.onBack, this.initialCustomerId, super.key});
  final VoidCallback onBack;
  final String? initialCustomerId;

  @override
  State<CreditBookScreen> createState() => _CreditBookScreenState();
}

class _CreditBookScreenState extends State<CreditBookScreen> {
  final CreditService _creditService = CreditService.instance;
  final TextEditingController _repaymentController = TextEditingController();
  List<CreditAccount> _accounts = const [];
  List<Map<String, dynamic>> _ledger = const [];
  bool _loading = true;
  bool _savingPayment = false;
  String _paymentMethod = 'CASH';
  String? _error;
  CreditAccount? _selected;
  bool _showRepayment = false;

  @override
  void initState() {
    super.initState();
    _loadAccounts();
  }

  Future<void> _loadAccounts() async {
    try {
      final accounts = await _creditService.loadCreditAccounts();
      if (!mounted) return;
      setState(() {
        _accounts = accounts;
        _loading = false;
        _error = null;
      });
      final initialCustomerId = widget.initialCustomerId;
      if (initialCustomerId != null) await _openAccount(initialCustomerId);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _openAccount(String customerId) async {
    final colorIndex =
        _accounts.indexWhere((account) => account.customerId == customerId);
    try {
      final values = await Future.wait<dynamic>([
        _creditService.loadCreditAccount(customerId,
            colorIndex: colorIndex < 0 ? 0 : colorIndex),
        _creditService.loadCreditLedger(customerId: customerId),
      ]);
      if (!mounted) return;
      setState(() {
        _selected = values[0] as CreditAccount;
        _ledger = values[1] as List<Map<String, dynamic>>;
        _error = null;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _recordRepayment() async {
    final account = _selected;
    final amount = double.tryParse(_repaymentController.text.trim());
    if (account == null ||
        amount == null ||
        amount <= 0 ||
        amount > account.balance) {
      setState(() =>
          _error = 'Enter a payment amount within the outstanding balance.');
      return;
    }
    setState(() => _savingPayment = true);
    try {
      await _creditService.recordOfflinePayment(
        customerId: account.customerId,
        amount: amount,
        paymentMethod: _paymentMethod,
      );
      await _loadAccounts();
      await _openAccount(account.customerId);
      if (!mounted) return;
      setState(() {
        _showRepayment = false;
        _repaymentController.clear();
        _savingPayment = false;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _savingPayment = false;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  void dispose() {
    _repaymentController.dispose();
    super.dispose();
  }

  int _daysOutstanding(CreditAccount account) {
    final value = account.lastTransactionAt;
    if (value == null) return 0;
    final date = DateTime.tryParse(value);
    if (date == null) return 0;
    return DateTime.now().difference(date).inDays;
  }

  String _lastTransactionLabel(CreditAccount account) {
    final ledgerEntry = _ledger.cast<Map<String, dynamic>?>().firstWhere(
          (entry) => entry?['customerId'] == account.customerId,
          orElse: () => null,
        );
    final value =
        ledgerEntry?['createdAt'] as String? ?? account.lastTransactionAt;
    if (value == null) return 'No payments recorded';
    final date = DateTime.tryParse(value);
    if (date == null) return 'Recent transaction';
    return 'Last: ${date.day}/${date.month}/${date.year}';
  }

  Color _balanceColor(double balance) {
    if (balance >= 10000) return const Color(0xFFD32F2F);
    if (balance > 0) return const Color(0xFFF9A825);
    return const Color(0xFF2E7D32);
  }

  String _money(double amount) => amount
      .toStringAsFixed(0)
      .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => ',');

  Widget _repaymentView(CreditAccount account) => Scaffold(
        backgroundColor: const Color(0xFFF5F7FA),
        body: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 52, 16, 24),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                    colors: [Color(0xFFD32F2F), Color(0xFFB71C1C)]),
              ),
              child: Column(children: [
                Row(children: [
                  IconButton(
                    onPressed: () => setState(() => _showRepayment = false),
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    style:
                        IconButton.styleFrom(backgroundColor: Colors.white24),
                  ),
                  const SizedBox(width: 12),
                  const Text('Record Payment',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800)),
                ]),
                const SizedBox(height: 18),
                Text(account.customer,
                    style:
                        const TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 4),
                const Text('Outstanding Balance',
                    style: TextStyle(color: Colors.white60, fontSize: 12)),
                Text('KSh ${_money(account.balance)}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 36,
                        fontWeight: FontWeight.w900)),
              ]),
            ),
            Expanded(
              child: ListView(padding: const EdgeInsets.all(16), children: [
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8)),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Payment Amount (KSh)',
                            style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _repaymentController,
                          autofocus: true,
                          textAlign: TextAlign.center,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          style: const TextStyle(
                              color: ink,
                              fontSize: 28,
                              fontWeight: FontWeight.w800),
                          decoration: const InputDecoration(
                              hintText: '0',
                              prefixText: 'KSh ',
                              border: OutlineInputBorder()),
                        ),
                        const SizedBox(height: 8),
                        Row(
                            children: [1000.0, 2000.0, account.balance]
                                .map((amount) => Expanded(
                                      child: Padding(
                                        padding:
                                            const EdgeInsets.only(right: 6),
                                        child: TextButton(
                                          onPressed: () => setState(() =>
                                              _repaymentController.text =
                                                  amount.toStringAsFixed(0)),
                                          style: TextButton.styleFrom(
                                              backgroundColor:
                                                  const Color(0xFFEEF3FF),
                                              foregroundColor: navy,
                                              shape: RoundedRectangleBorder(
                                                  borderRadius:
                                                      BorderRadius.circular(
                                                          8))),
                                          child: Text(
                                              amount == account.balance
                                                  ? 'Full'
                                                  : 'KSh ${_money(amount)}',
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w700,
                                                  fontSize: 11)),
                                        ),
                                      ),
                                    ))
                                .toList()),
                        const SizedBox(height: 18),
                        const Text('Payment Method',
                            style: TextStyle(
                                color: muted,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Row(
                            children: ['CASH', 'MPESA']
                                .map((method) => Expanded(
                                      child: Padding(
                                        padding: EdgeInsets.only(
                                            right: method == 'CASH' ? 8 : 0),
                                        child: OutlinedButton.icon(
                                          onPressed: () => setState(
                                              () => _paymentMethod = method),
                                          icon: Icon(
                                              method == 'CASH'
                                                  ? Icons.payments_outlined
                                                  : Icons.phone_android,
                                              size: 17),
                                          label: Text(method == 'CASH'
                                              ? 'Cash'
                                              : 'M-Pesa'),
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor:
                                                _paymentMethod == method
                                                    ? navy
                                                    : muted,
                                            backgroundColor:
                                                _paymentMethod == method
                                                    ? const Color(0x140D47A1)
                                                    : Colors.white,
                                            side: BorderSide(
                                                color: _paymentMethod == method
                                                    ? navy
                                                    : const Color(0xFFE8ECF4),
                                                width: _paymentMethod == method
                                                    ? 2
                                                    : 1),
                                            padding: const EdgeInsets.symmetric(
                                                vertical: 13),
                                            shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(8)),
                                          ),
                                        ),
                                      ),
                                    ))
                                .toList()),
                      ]),
                ),
                const SizedBox(height: 20),
                TextButton(
                  onPressed: _savingPayment ? null : _recordRepayment,
                  style: TextButton.styleFrom(
                      backgroundColor: const Color(0xFF2E7D32),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8))),
                  child: Text(
                      _savingPayment ? 'Recording...' : 'Confirm Payment',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w800)),
                ),
              ]),
            ),
          ],
        ),
      );

  Widget _focusedAccountView(CreditAccount account) {
    final entries = _ledger
        .where((entry) => entry['customerId'] == account.customerId)
        .toList();
    return Container(
      color: const Color(0xFFF5F7FA),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 52, 16, 22),
            decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [ink, navy])),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => setState(() => _selected = null),
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.12)),
                ),
                const SizedBox(width: 10),
                const Text('Credit Ledger Profile',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 19,
                        fontWeight: FontWeight.w800)),
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
                      borderRadius: BorderRadius.circular(16)),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 28,
                        backgroundColor: Color(account.colorValue),
                        child: Text(account.initials,
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(account.customer,
                                style: const TextStyle(
                                    color: ink,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800)),
                            const SizedBox(height: 3),
                            Text(account.phone,
                                style: const TextStyle(
                                    color: muted, fontSize: 12)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                      color: const Color(0xFFFFEBEE),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFEF9A9A))),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Outstanding Balance',
                          style: TextStyle(
                              color: Color(0xFFB71C1C),
                              fontSize: 12,
                              fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text('KSh ${account.balance.toStringAsFixed(0)}',
                          style: TextStyle(
                              color: _balanceColor(account.balance),
                              fontSize: 28,
                              fontWeight: FontWeight.w900)),
                      const SizedBox(height: 3),
                      Text('${account.transactionCount} credit transactions',
                          style: const TextStyle(
                              color: Color(0xFFEF5350), fontSize: 11)),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                TextButton.icon(
                  onPressed: () => setState(() => _showRepayment = true),
                  icon: const Icon(Icons.payments_outlined),
                  label: const Text('Record Payment'),
                  style: TextButton.styleFrom(
                    minimumSize: const Size(double.infinity, 50),
                    backgroundColor: const Color(0xFF2E7D32),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 18),
                const Text('Ledger History',
                    style: TextStyle(
                        color: ink, fontSize: 14, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                if (entries.isEmpty)
                  const Text('No ledger entries recorded yet.',
                      style: TextStyle(color: muted, fontSize: 12))
                else
                  ...entries.map(
                    (entry) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(
                          entry['type'] == 'SALE'
                              ? Icons.receipt_long
                              : Icons.payments_outlined,
                          color: entry['type'] == 'SALE'
                              ? const Color(0xFFF9A825)
                              : const Color(0xFF2E7D32)),
                      title: Text(
                          entry['type'] == 'SALE' ? 'Credit sale' : 'Repayment',
                          style: const TextStyle(
                              color: ink, fontWeight: FontWeight.w700)),
                      subtitle: Text(entry['createdAt']?.toString() ?? '',
                          style: const TextStyle(color: muted, fontSize: 11)),
                      trailing: Text(
                          'KSh ${(entry['amount'] as num?)?.toStringAsFixed(0) ?? '0'}',
                          style: const TextStyle(
                              color: ink, fontWeight: FontWeight.w800)),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final total = _accounts.fold<double>(0, (sum, item) => sum + item.balance);
    if (_selected != null) {
      return _showRepayment
          ? _repaymentView(_selected!)
          : _focusedAccountView(_selected!);
    }

    return SizedBox.expand(
      child: ListView(
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
                      onPressed: widget.onBack,
                      icon: const Icon(Icons.arrow_back_ios_new_rounded,
                          size: 18, color: Colors.white70),
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
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.12)),
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
                        'KSh ${total.toStringAsFixed(0)}',
                        style: TextStyle(
                          color: _balanceColor(total),
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
              children: _loading
                  ? [
                      const Padding(
                          padding: EdgeInsets.all(32),
                          child: CircularProgressIndicator(color: navy))
                    ]
                  : _accounts.isEmpty
                      ? [
                          Padding(
                              padding: EdgeInsets.all(32),
                              child: Text(
                                  _error ?? 'No active credit accounts.',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                      color: muted, fontSize: 14)))
                        ]
                      : [
                          if (_error != null)
                            Container(
                              width: double.infinity,
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFEBEE),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(_error!,
                                  style: const TextStyle(
                                      color: Color(0xFFC62828), fontSize: 12)),
                            ),
                          ..._accounts.map((account) {
                            final daysOld = _daysOutstanding(account);
                            final hasOutstanding = account.balance > 0;
                            final balanceColor = _balanceColor(account.balance);
                            return InkWell(
                              onTap: () => _openAccount(account.customerId),
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                width: double.infinity,
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 12),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(8),
                                  boxShadow: const [
                                    BoxShadow(
                                        color: Color(0x0F000000),
                                        blurRadius: 8,
                                        offset: Offset(0, 2))
                                  ],
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.center,
                                  children: [
                                    Container(
                                      width: 46,
                                      height: 46,
                                      decoration: BoxDecoration(
                                        color: Color(account.colorValue),
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
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
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
                                            '${account.phone} · ${account.transactionCount} transactions',
                                            style: const TextStyle(
                                              color: muted,
                                              fontSize: 11,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            daysOld == 0
                                                ? 'Added today'
                                                : '${daysOld}d outstanding',
                                            style: TextStyle(
                                              color: hasOutstanding
                                                  ? balanceColor
                                                  : const Color(0xFF2E7D32),
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 8, vertical: 5),
                                          decoration: BoxDecoration(
                                            color: hasOutstanding
                                                ? balanceColor.withValues(
                                                    alpha: 0.12)
                                                : const Color(0xFFE8F5E9),
                                            borderRadius:
                                                BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            'KSh ${account.balance.toStringAsFixed(0)}',
                                            style: TextStyle(
                                              color: balanceColor,
                                              fontSize: 16,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          _lastTransactionLabel(account),
                                          style: const TextStyle(
                                            color: muted,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }),
                        ],
            ),
          ),
        ],
      ),
    );
  }
}

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({required this.onBack});
  final VoidCallback onBack;
  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  int tab = 0;
  final ReportsService _reportsService = ReportsService();
  List<ReportTrend> _trends = const [];
  ReportsData? _reportData;
  bool _loading = true;
  String? _error;
  static const List<Color> _categoryColors = [
    navy,
    gold,
    Color(0xFF2E7D32),
    Color(0xFFD32F2F),
    muted,
  ];

  @override
  void initState() {
    super.initState();
    _loadReports();
  }

  Future<void> _loadReports() async {
    try {
      final businessId = await AuthService().getActiveBusinessId();
      if (businessId == null || businessId.isEmpty) {
        throw Exception('Please sign in to load reports.');
      }
      final data = await _reportsService.load(businessId: businessId);
      if (!mounted) return;
      setState(() {
        _reportData = data;
        _trends = data.trends;
        _loading = false;
        _error = data.isOffline
            ? 'Live reports unavailable. Showing offline queue data.'
            : null;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Unable to load reports: $error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final report = _reportData;
    final weekSales = report?.weekSales ?? 0;
    final avgMargin = report?.avgMargin ?? 0;
    final today = _trends
        .where((trend) => trend.isToday)
        .cast<ReportTrend?>()
        .firstWhere((trend) => trend != null,
            orElse: () => _trends.isEmpty ? null : _trends.last);

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
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0x334CAF50),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: const Color(0x664CAF50)),
                    ),
                    child: const Row(
                      children: [
                        CircleAvatar(
                            radius: 4, backgroundColor: Color(0xFF4CAF50)),
                        SizedBox(width: 6),
                        Text('LIVE',
                            style: TextStyle(
                                color: Color(0xFF81C784),
                                fontSize: 10,
                                fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                ],
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: Text(
                      'Week of ${report?.currentMonth ?? ''} ${report?.year ?? DateTime.now().year} · Up to ${today?.day ?? 'Today'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.white60, fontSize: 12)),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  _metricCard(
                      "Today's Sales",
                      'KSh ${((report?.todaySales ?? 0) / 1000).round()}K',
                      today?.day ?? 'Today'),
                  _metricCard(
                      'Week Sales',
                      'KSh ${(weekSales / 1000).round()}K',
                      'Mon - ${today?.day ?? 'Today'}'),
                  _metricCard('Avg Margin', '${avgMargin.toStringAsFixed(1)}%',
                      'This week'),
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
              if (_loading) const LinearProgressIndicator(color: gold),
              if (_error != null)
                Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(_error!,
                        style: const TextStyle(color: muted, fontSize: 11))),
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
              Text(label,
                  style: const TextStyle(
                      color: Colors.white60,
                      fontSize: 9,
                      fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(value,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(sub,
                  style: const TextStyle(color: Colors.white54, fontSize: 9)),
            ],
          ),
        ),
      );

  String _formatDate(DateTime date) =>
      '${date.month.toString().padLeft(2, '0')}/${date.day.toString().padLeft(2, '0')}';

  double get _chartMaxY {
    final maximum = _trends.fold<double>(
        0, (value, item) => item.revenue > value ? item.revenue : value);
    return maximum <= 0 ? 1 : maximum * 1.2;
  }

  double get _profitMaxY {
    final maximum = _trends.fold<double>(
        0, (value, item) => item.profit > value ? item.profit : value);
    return maximum > 0 ? maximum * 1.2 : 1;
  }

  double get _profitMinY {
    final minimum = _trends.fold<double>(
        0, (value, item) => item.profit < value ? item.profit : value);
    return minimum < 0 ? minimum * 1.2 : 0;
  }

  double get _profitAxisInterval {
    final range = _profitMaxY - _profitMinY;
    return range <= 4 ? 1 : range / 4;
  }

  List<ReportMonth> get _months => _reportData?.monthly ?? const [];
  List<double> get months => _months.map((month) => month.sales).toList();
  List<String> get monthLabels => _months.map((month) => month.month).toList();
  List<Map<String, dynamic>> get categoryData =>
      (_reportData?.categories ?? const [])
          .asMap()
          .entries
          .map((entry) => {
                'name': entry.value.name,
                'value': entry.value.percent,
                'color': _categoryColors[entry.key % _categoryColors.length],
              })
          .toList();
  double get _monthMaxY {
    final maximum =
        months.fold<double>(0, (value, sales) => sales > value ? sales : value);
    return maximum <= 0 ? 1 : maximum * 1.2;
  }

  double get _monthSalesPeak {
    final maximum =
        months.fold<double>(0, (value, sales) => sales > value ? sales : value);
    return maximum <= 0 ? 1 : maximum;
  }

  String _money(double value) => value
      .round()
      .toString()
      .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => ',');

  Widget _daily() => Column(
        children: [
          Section(
            title: 'Sales & Profit — This Week',
            child: Column(
              children: [
                SizedBox(
                  height: 170,
                  child: Stack(
                    children: [
                      LineChart(
                        LineChartData(
                          minY: 0,
                          maxY: _chartMaxY,
                          gridData: const FlGridData(
                              show: true, drawVerticalLine: false),
                          titlesData: FlTitlesData(
                            leftTitles: AxisTitles(
                              sideTitles: SideTitles(
                                  showTitles: true,
                                  reservedSize: 46,
                                  getTitlesWidget: (value, meta) => Text(
                                      '${(value / 1000).round()}K',
                                      style: const TextStyle(
                                          color: Color(0xFF6B7A99),
                                          fontSize: 10))),
                            ),
                            bottomTitles: AxisTitles(
                              sideTitles: SideTitles(
                                  showTitles: true,
                                  reservedSize: 22,
                                  getTitlesWidget: (value, meta) {
                                    final index = value.toInt();
                                    if (index < 0 || index >= _trends.length)
                                      return const Text('');
                                    final label =
                                        _formatDate(_trends[index].date);
                                    return Text(label,
                                        style: const TextStyle(
                                            color: Color(0xFF6B7A99),
                                            fontSize: 10));
                                  }),
                            ),
                            rightTitles: const AxisTitles(
                                sideTitles: SideTitles(showTitles: false)),
                            topTitles: const AxisTitles(
                                sideTitles: SideTitles(showTitles: false)),
                          ),
                          borderData: FlBorderData(show: false),
                          lineBarsData: [
                            _line(_trends.map((item) => item.revenue).toList(),
                                navy),
                            _line(_trends.map((item) => item.profit).toList(),
                                gold),
                          ],
                        ),
                      ),
                      if (_loading)
                        const Positioned.fill(
                          child: ColoredBox(
                            color: Color(0xB3FFFFFF),
                            child: Center(
                                child: CircularProgressIndicator(color: navy)),
                          ),
                        ),
                    ],
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
          Container(
              width: 14,
              height: 3,
              decoration: BoxDecoration(
                  color: color, borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 6),
          Text(label,
              style: const TextStyle(color: Color(0xFF6B7A99), fontSize: 11)),
        ],
      );

  LineChartBarData _line(List<double> values, Color color) => LineChartBarData(
        spots: values
            .asMap()
            .entries
            .map((entry) => FlSpot(entry.key.toDouble(), entry.value))
            .toList(),
        isCurved: true,
        color: color,
        barWidth: 2,
        belowBarData:
            BarAreaData(show: true, color: color.withValues(alpha: 0.12)),
        dotData: const FlDotData(show: false),
      );

  Widget _dailyBreakdown() => Section(
        title: 'Daily Breakdown',
        child: Column(
          children: List.generate(_trends.length, (index) {
            final trend = _trends[index];
            final value = trend.revenue;
            final label =
                trend.day.isEmpty ? _formatDate(trend.date) : trend.day;
            final width = (value / _chartMaxY).clamp(0.0, 1.0);
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  SizedBox(
                      width: 44,
                      child: Text(label,
                          style: TextStyle(
                              color: trend.isToday
                                  ? navy
                                  : trend.future
                                      ? const Color(0xFFC8D0E0)
                                      : const Color(0xFF6B7A99),
                              fontSize: 11,
                              fontWeight: trend.isToday
                                  ? FontWeight.w800
                                  : FontWeight.w600))),
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
                          widthFactor: trend.future ? 0 : width,
                          child: Container(
                            height: 7,
                            decoration: BoxDecoration(
                              color: trend.isToday ? gold : navy,
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
                      trend.future ? '—' : 'KSh ${(value / 1000).round()}K',
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        color: const Color(0xFF0D1B3D),
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
                        Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                                color: item['color'],
                                borderRadius: BorderRadius.circular(3))),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${item['name']}  ${item['value']}%',
                            style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF0D1B3D),
                                height: 1.4),
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
            title: 'Monthly Sales ${_reportData?.year ?? DateTime.now().year}',
            child: SizedBox(
              height: 210,
              child: BarChart(
                BarChartData(
                  maxY: _monthMaxY,
                  borderData: FlBorderData(show: false),
                  gridData:
                      const FlGridData(show: true, drawVerticalLine: false),
                  titlesData: FlTitlesData(
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 36,
                          getTitlesWidget: (value, meta) => Text(
                              '${(value / 1000).round()}K',
                              style: const TextStyle(
                                  color: Color(0xFF6B7A99), fontSize: 10))),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                          showTitles: true,
                          getTitlesWidget: (value, meta) {
                            final index = value.toInt();
                            if (index < 0 || index >= monthLabels.length)
                              return const Text('');
                            return Text(monthLabels[index],
                                style: const TextStyle(
                                    color: Color(0xFF6B7A99), fontSize: 10));
                          },
                          reservedSize: 20),
                    ),
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                  ),
                  barGroups: months.asMap().entries.map((entry) {
                    return BarChartGroupData(
                      x: entry.key,
                      barRods: [
                        BarChartRodData(
                          toY: entry.value,
                          color: _months[entry.key].future
                              ? const Color(0xFFEDF0F7)
                              : _months[entry.key].isNow
                                  ? gold
                                  : navy,
                          width: 14,
                          borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(4)),
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
                final month = _months[index];
                final value = month.sales;
                final ratio = (value / _monthSalesPeak).clamp(0.0, 1.0);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      SizedBox(
                          width: 38,
                          child: Row(children: [
                            Text(label,
                                style: TextStyle(
                                    fontSize: 11,
                                    color: month.future
                                        ? const Color(0xFFC8D0E0)
                                        : month.isNow
                                            ? gold
                                            : muted,
                                    fontWeight: month.isNow
                                        ? FontWeight.w800
                                        : FontWeight.w700)),
                            if (month.isNow)
                              const Padding(
                                  padding: EdgeInsets.only(left: 3),
                                  child:
                                      Icon(Icons.circle, size: 5, color: gold))
                          ])),
                      const SizedBox(width: 4),
                      Expanded(
                        child:
                            Stack(alignment: Alignment.centerLeft, children: [
                          Container(
                              height: 6,
                              decoration: BoxDecoration(
                                  color: const Color(0xFFF0F3F9),
                                  borderRadius: BorderRadius.circular(3))),
                          if (!month.future)
                            FractionallySizedBox(
                                widthFactor: ratio,
                                child: Container(
                                    height: 6,
                                    decoration: BoxDecoration(
                                        color: month.isNow ? gold : navy,
                                        borderRadius:
                                            BorderRadius.circular(3))))
                        ]),
                      ),
                      const SizedBox(width: 10),
                      SizedBox(
                        width: 74,
                        child: Text(
                          month.future ? '—' : 'KSh ${_money(value)}',
                          textAlign: TextAlign.right,
                          style: TextStyle(
                              fontSize: 11,
                              color:
                                  month.future ? const Color(0xFFC8D0E0) : ink,
                              fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
          ),
          ..._monthlySummary(),
        ],
      );

  List<Widget> _monthlySummary() {
    final report = _reportData;
    final ytd = _months.fold<double>(0, (sum, month) => sum + month.sales);
    final daysLeft = (report?.daysInMonth ?? 0) - (report?.currentDay ?? 0);
    final items = [
      (
        'Best Month (so far)',
        report?.bestMonth ?? '-',
        'Database revenue leader',
        Icons.emoji_events_outlined,
        gold
      ),
      (
        'YTD Revenue',
        'KSh ${_money(ytd)}',
        'Current calendar year',
        Icons.trending_up_outlined,
        const Color(0xFF2E7D32)
      ),
      (
        'Days left in ${report?.currentMonth ?? 'month'}',
        '$daysLeft days',
        '${report?.currentDay ?? 0} of ${report?.daysInMonth ?? 0} elapsed',
        Icons.calendar_today_outlined,
        navy
      ),
    ];
    return items
        .map((item) => Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                boxShadow: const [
                  BoxShadow(
                      color: Color(0x0F000000),
                      blurRadius: 8,
                      offset: Offset(0, 2))
                ]),
            child: Row(children: [
              Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                      color: item.$5.withValues(alpha: .12),
                      borderRadius: BorderRadius.circular(8)),
                  child: Icon(item.$4, color: item.$5, size: 22)),
              const SizedBox(width: 14),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(item.$1,
                        style: const TextStyle(color: muted, fontSize: 11)),
                    const SizedBox(height: 2),
                    Text(item.$2,
                        style: TextStyle(
                            color: item.$5,
                            fontSize: 16,
                            fontWeight: FontWeight.w800)),
                    Text(item.$3,
                        style: const TextStyle(color: muted, fontSize: 11))
                  ]))
            ])))
        .toList();
  }

  Widget _profit() => Column(
        children: [
          Section(
            title: 'Profit This Week',
            child: SizedBox(
              height: 190,
              child: BarChart(
                BarChartData(
                  minY: _profitMinY,
                  maxY: _profitMaxY,
                  borderData: FlBorderData(show: false),
                  gridData: FlGridData(
                      show: true,
                      drawVerticalLine: false,
                      horizontalInterval: _profitAxisInterval),
                  titlesData: FlTitlesData(
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 42,
                          interval: _profitAxisInterval,
                          getTitlesWidget: (value, meta) => Text(
                              '${(value / 1000).round()}K',
                              style: const TextStyle(
                                  color: Color(0xFF6B7A99), fontSize: 10))),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 22,
                          getTitlesWidget: (value, meta) {
                            final index = value.toInt();
                            if (index < 0 || index >= _trends.length)
                              return const Text('');
                            return Text(_formatDate(_trends[index].date),
                                style: const TextStyle(
                                    color: Color(0xFF6B7A99), fontSize: 10));
                          }),
                    ),
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                  ),
                  barGroups: _trends.asMap().entries.map((entry) {
                    return BarChartGroupData(
                      x: entry.key,
                      barRods: [
                        BarChartRodData(
                          toY: entry.value.profit,
                          color: _trends[entry.key].future
                              ? const Color(0xFFEDF0F7)
                              : _trends[entry.key].isToday
                                  ? gold
                                  : const Color(0xFF2E7D32),
                          width: 20,
                          borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(5)),
                        ),
                      ],
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
          ..._profitSummary(),
          _monthlyProfit(),
        ],
      );

  List<Widget> _profitSummary() {
    final report = _reportData;
    final sales = report?.weekSales ?? 0;
    final gross = report?.weekProfit ?? 0;
    final expenses = report?.weekExpenses ?? 0;
    final net = gross - expenses;
    final rows = [
      (
        'Gross Profit (week to date)',
        gross,
        sales == 0 ? 0 : gross / sales * 100,
        const Color(0xFF2E7D32)
      ),
      (
        'Operating Expenses',
        expenses,
        sales == 0 ? 0 : expenses / sales * 100,
        const Color(0xFFD32F2F)
      ),
      (
        'Net Profit (week to date)',
        net,
        sales == 0 ? 0 : net / sales * 100,
        navy
      ),
    ];
    return rows
        .map((row) => Section(
            title: row.$1,
            child: Row(children: [
              Expanded(
                  child: Text('KSh ${_money(row.$2)}',
                      style: TextStyle(
                          color: row.$4,
                          fontSize: 17,
                          fontWeight: FontWeight.w800))),
              Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                      color: row.$4.withValues(alpha: .12),
                      borderRadius: BorderRadius.circular(999)),
                  child: Text('${row.$3.toStringAsFixed(1)}%',
                      style: TextStyle(
                          color: row.$4,
                          fontSize: 12,
                          fontWeight: FontWeight.w800)))
            ])))
        .toList();
  }

  Widget _monthlyProfit() => Section(
      title: 'Monthly Profit ${_reportData?.year ?? DateTime.now().year}',
      child: SizedBox(
          height: 170,
          child: LineChart(LineChartData(
              minY: 0,
              maxY: _months.fold<double>(
                          0,
                          (max, item) =>
                              item.profit > max ? item.profit : max) *
                      1.2 +
                  1,
              gridData: const FlGridData(show: true, drawVerticalLine: false),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 42,
                          getTitlesWidget: (value, meta) => Text(
                              '${(value / 1000).round()}K',
                              style: const TextStyle(
                                  color: muted, fontSize: 10)))),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 22,
                          getTitlesWidget: (value, meta) {
                            final index = value.toInt();
                            if (index < 0 || index >= _months.length) {
                              return const SizedBox.shrink();
                            }
                            return Text(_months[index].month,
                                style: const TextStyle(
                                    color: muted, fontSize: 10));
                          }))),
              lineBarsData: [
                _line(
                    _months
                        .map((month) => month.future ? 0.0 : month.profit)
                        .toList(),
                    const Color(0xFF2E7D32))
              ]))));
}

class Metric extends StatelessWidget {
  const Metric(this.label, this.value, this.sub);
  final String label, value, sub;
  @override
  Widget build(BuildContext context) => Expanded(
      child: Container(
          margin: const EdgeInsets.only(right: 6),
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
              color: Colors.white12, borderRadius: BorderRadius.circular(10)),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label,
                style: const TextStyle(color: Colors.white60, fontSize: 9)),
            Text(value,
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 13)),
            Text(sub,
                style: const TextStyle(color: Colors.white54, fontSize: 9))
          ])));
}
