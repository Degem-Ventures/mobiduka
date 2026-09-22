import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:vibration/vibration.dart';

import '../main.dart' show Product, gold, ink, muted, navy;
import '../services/dashboard_service.dart';
import '../services/product_repository.dart';
import '../services/scan_lookup_service.dart';
import 'web_camera_cleanup_stub.dart'
    if (dart.library.html) 'web_camera_cleanup_web.dart';

enum _ScanMode { idle, camera, result, unknown, manual }

class SmartScanScreen extends StatefulWidget {
  const SmartScanScreen({
    required this.onProductScanned,
    this.onClose,
    super.key,
  });

  final ValueChanged<Product> onProductScanned;
  final VoidCallback? onClose;

  @override
  State<SmartScanScreen> createState() => _SmartScanScreenState();
}

class _SmartScanScreenState extends State<SmartScanScreen> {
  MobileScannerController? _scanner;
  final _repository = ProductRepository.instance;
  final _scanLookupService = ScanLookupService();
  final _dashboardService = DashboardService();
  final _manualController = TextEditingController();
  _ScanMode _mode = _ScanMode.idle;
  Map _counts = const {};
  List<Map<String, dynamic>> _recent = const [];
  Product? _product;
  String? _supplier;
  String _barcode = '';
  String? _error;
  bool _processing = false;
  String? _addingRecentBarcode;

  @override
  void initState() {
    super.initState();
    _loadActivity();
  }

  Future<void> _loadActivity() async {
    try {
      final dashboard = await _dashboardService.load();
      if (!mounted) return;
      final activity = dashboard.scanActivity;
      final values = (activity['recent'] as List? ?? const [])
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList()
        ..sort((a, b) => (b['createdAt']?.toString() ?? '')
            .compareTo(a['createdAt']?.toString() ?? ''));
      setState(() {
        _counts =
            activity['counts'] is Map ? activity['counts'] as Map : const {};
        _recent = values;
      });
    } catch (_) {
      // The scanner remains usable when activity history is temporarily unavailable.
    }
  }

  @override
  void dispose() {
    _manualController.dispose();
    _scanner?.dispose();
    super.dispose();
  }

  Future<void> _startCamera() async {
    await _releaseCamera();
    final scanner = MobileScannerController(
      formats: const [BarcodeFormat.all],
      autoStart: false,
    );
    setState(() {
      _error = null;
      _mode = _ScanMode.camera;
      _scanner = scanner;
    });
    try {
      await scanner.start();
    } catch (_) {
      if (mounted) setState(() => _mode = _ScanMode.idle);
      await WidgetsBinding.instance.endOfFrame;
      await _releaseCamera();
      if (mounted) {
        setState(() {
          _error = 'Unable to start the camera.';
        });
      }
    }
  }

  Future<void> _releaseCamera() async {
    final scanner = _scanner;
    _scanner = null;
    if (scanner == null) return;
    try {
      await scanner.stop();
    } catch (_) {
      // The preview may already have stopped after an app lifecycle change.
    }
    await scanner.dispose();
    await releaseWebCameraTracks();
  }

  Future<void> _stopCamera() async {
    final scanner = _scanner;
    // Stop the browser track while its video element still exists. Waiting to
    await releaseWebCameraTracks();

    // Remove MobileScanner before disposing its controller. Disposing first
    // makes the preview paint a disposed controller for one frame.
    if (mounted) setState(() => _mode = _ScanMode.idle);
    await WidgetsBinding.instance.endOfFrame;
    if (identical(_scanner, scanner)) {
      _scanner = null;
      await scanner?.dispose();
    }
  }

  Future<void> _lookup(String barcode, {bool manual = false}) async {
    final code = barcode.trim();
    if (code.isEmpty || _processing) return;
    _processing = true;
    await _stopCamera();
    if (await Vibration.hasVibrator()) await Vibration.vibrate(duration: 100);
    Product? product;
    try {
      final lookup = await _scanLookupService.lookup(code, manual: manual);
      product = lookup.product;
      _supplier = lookup.supplier;
    } catch (error) {
      // Keep barcode lookups usable when the device is offline, but make the
      // network failure visible if the local cache also has no match.
      product = await _repository.findByBarcode(code);
      _supplier = null;
      if (product == null && mounted)
        _error = 'Online lookup unavailable: $error';
    }
    if (!mounted) return;
    setState(() {
      _processing = false;
      _barcode = code;
      _product = product;
      _mode = product == null ? _ScanMode.unknown : _ScanMode.result;
      final status = product == null
          ? 'UNKNOWN'
          : manual
              ? 'MANUAL'
              : 'FOUND';
      _counts = {
        ..._counts,
        status: ((_counts[status] as num?) ?? 0).toInt() + 1
      };
      _recent = [
        {
          'name': product?.name ?? 'Unknown Product',
          'barcode': code,
          'status': status,
          'emoji': product?.emoji ?? '❓',
          'createdAt': DateTime.now().toIso8601String(),
        },
        ..._recent.where((item) => item['barcode'] != code),
      ].take(10).toList();
    });
  }

  String _time(Object? value) {
    final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    if (date == null) return '';
    final clock =
        '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
    final today = DateTime.now();
    final days = DateTime(today.year, today.month, today.day)
        .difference(DateTime(date.year, date.month, date.day))
        .inDays;
    return days == 0
        ? clock
        : days == 1
            ? 'Yesterday · $clock'
            : '$days days ago · $clock';
  }

  void _reset() => setState(() {
        _mode = _ScanMode.idle;
        _product = null;
        _supplier = null;
        _barcode = '';
        _error = null;
      });

  Future<void> _close() async {
    if (_mode == _ScanMode.camera) await _stopCamera();
    if (widget.onClose != null) {
      widget.onClose!();
    } else {
      Navigator.of(context).pop();
    }
  }

  Future<void> _openRecentScan(Map<String, dynamic> scan) async {
    final barcode = scan['barcode']?.toString().trim() ?? '';
    if (barcode.isEmpty || _addingRecentBarcode != null) return;

    setState(() => _addingRecentBarcode = barcode);
    try {
      // Older server history records contain a barcode rather than a full
      // product. Resolve it when tapped, while keeping cached items offline.
      final cached = await _repository.findByBarcode(barcode);
      Product? product = cached;
      String? supplier;
      if (product == null) {
        final lookup = await _scanLookupService.lookup(barcode, manual: false);
        product = lookup.product;
        supplier = lookup.supplier;
      }
      if (!mounted) return;
      setState(() {
        _product = product;
        _supplier = supplier;
        _barcode = barcode;
        _mode = product == null ? _ScanMode.unknown : _ScanMode.result;
        _error = product == null
            ? 'This scanned item is no longer available in the catalogue.'
            : null;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _product = null;
          _supplier = null;
          _barcode = barcode;
          _mode = _ScanMode.unknown;
          _error = 'Unable to open this scanned item.';
        });
      }
    } finally {
      if (mounted) setState(() => _addingRecentBarcode = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isCamera = _mode == _ScanMode.camera;
    final isResult = _mode == _ScanMode.result;
    final isUnknown = _mode == _ScanMode.unknown;
    final total =
        _counts.values.fold<num>(0, (sum, value) => sum + (value as num? ?? 0));
    return WillPopScope(
      onWillPop: () async {
        if (_mode == _ScanMode.camera) {
          await _stopCamera();
          return false;
        }
        if (widget.onClose != null) {
          await _close();
          return false;
        }
        return true;
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F7FA),
        body: SafeArea(
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                decoration: const BoxDecoration(
                    gradient: LinearGradient(colors: [ink, Color(0xFF0A1628)])),
                child: Row(children: [
                  IconButton(
                    onPressed: _close,
                    icon: const Icon(Icons.arrow_back_rounded),
                    style: IconButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: 0.10),
                        foregroundColor: Colors.white),
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Row(children: [
                          Text('SmartScan™',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800)),
                          SizedBox(width: 8),
                          DecoratedBox(
                              decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                      colors: [gold, Color(0xFFF0D060)]),
                                  borderRadius:
                                      BorderRadius.all(Radius.circular(6))),
                              child: Padding(
                                  padding: EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 2),
                                  child: Text('SMART',
                                      style: TextStyle(
                                          color: ink,
                                          fontSize: 9,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 0.5)))),
                        ]),
                        SizedBox(height: 2),
                        Text('Barcode · Product Lookup · Stock Check',
                            style: TextStyle(
                                color: Color(0x99FFFFFF), fontSize: 11)),
                      ])),
                  TextButton.icon(
                    onPressed: () => setState(() => _mode =
                        _mode == _ScanMode.manual
                            ? _ScanMode.idle
                            : _ScanMode.manual),
                    icon: const Text('✏️'),
                    label: const Text('Manual'),
                    style: TextButton.styleFrom(
                        foregroundColor: const Color(0xCCFFFFFF)),
                  ),
                ]),
              ),
              if (_error != null)
                Container(
                    width: double.infinity,
                    margin: const EdgeInsets.all(12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                        color: const Color(0xFFFFEBEE),
                        borderRadius: BorderRadius.circular(10)),
                    child: Text(_error!,
                        style: const TextStyle(
                            color: Color(0xFFC62828), fontSize: 12))),
              SizedBox(
                height: 240,
                child: Stack(fit: StackFit.expand, children: [
                  const DecoratedBox(
                      decoration: BoxDecoration(color: Color(0xFF060E1F))),
                  if (isCamera && _scanner != null)
                    MobileScanner(
                      controller: _scanner!,
                      onDetect: (capture) {
                        final code = capture.barcodes.isEmpty
                            ? null
                            : capture.barcodes.first.rawValue;
                        if (code != null) _lookup(code);
                      },
                    )
                  else
                    _viewfinder(isResult: isResult, isUnknown: isUnknown),
                  if (isCamera)
                    Positioned(
                      top: 12,
                      left: 12,
                      right: 12,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: ink.withValues(alpha: 0.78),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text('Allow camera access',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700)),
                          ),
                          FilledButton(
                            onPressed: _stopCamera,
                            style: FilledButton.styleFrom(
                              backgroundColor:
                                  Colors.white.withValues(alpha: 0.16),
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 0),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 7),
                            ),
                            child: const Text('Cancel',
                                style: TextStyle(
                                    fontSize: 11, fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ),
                    ),
                  Positioned(
                    right: 12,
                    bottom: 12,
                    child: FilledButton.icon(
                      onPressed: isCamera
                          ? null
                          : (isResult || isUnknown)
                              ? _reset
                              : _startCamera,
                      icon: Icon(
                          isCamera
                              ? Icons.close
                              : isResult || isUnknown
                                  ? Icons.restart_alt
                                  : Icons.photo_camera_outlined,
                          size: 17),
                      label: Text(isCamera
                          ? 'Camera active'
                          : isResult || isUnknown
                              ? 'Reset'
                              : 'Scan'),
                      style: FilledButton.styleFrom(
                          backgroundColor: isCamera || isResult || isUnknown
                              ? Colors.white.withValues(alpha: 0.16)
                              : gold,
                          foregroundColor: isCamera || isResult || isUnknown
                              ? Colors.white
                              : ink),
                    ),
                  ),
                ]),
              ),
              if (_mode == _ScanMode.idle || _mode == _ScanMode.manual)
                Container(
                  color: const Color(0xFF111C35),
                  padding: const EdgeInsets.all(12),
                  child: Row(children: [
                    Expanded(
                        child: TextField(
                            controller: _manualController,
                            onSubmitted: (value) =>
                                _lookup(value, manual: true),
                            style: const TextStyle(
                                color: Colors.white, fontSize: 13),
                            decoration: InputDecoration(
                                hintText: 'Enter barcode manually...',
                                hintStyle: const TextStyle(
                                    color: Color(0x99FFFFFF), fontSize: 13),
                                filled: true,
                                fillColor: Colors.white.withValues(alpha: 0.08),
                                border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide.none),
                                contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 10)))),
                    const SizedBox(width: 10),
                    FilledButton(
                        onPressed: () =>
                            _lookup(_manualController.text, manual: true),
                        child: const Text('Look Up')),
                  ]),
                ),
              Expanded(
                  child: SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: isResult || isUnknown
                          ? _resultCard()
                          : _activity(total))),
            ],
          ),
        ),
      ),
    );
  }

  Widget _viewfinder({required bool isResult, required bool isUnknown}) {
    if (isResult && _product != null)
      return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Text(_product!.emoji, style: const TextStyle(fontSize: 48)),
        Text('⚡ $_barcode',
            style: const TextStyle(
                color: gold,
                fontFamily: 'monospace',
                fontWeight: FontWeight.w700))
      ]);
    if (isUnknown)
      return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const Text('❓', style: TextStyle(fontSize: 40)),
        const Text('Product Not Found',
            style: TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w700)),
        Text(_barcode,
            style: const TextStyle(
                color: Color(0x99FFFFFF), fontFamily: 'monospace'))
      ]);
    return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Container(
          width: 180,
          height: 104,
          decoration: BoxDecoration(
              border: Border.all(color: gold, width: 3),
              borderRadius: BorderRadius.circular(12)),
          child: const Center(
              child:
                  Icon(Icons.qr_code_scanner_rounded, color: gold, size: 48))),
      const SizedBox(height: 14),
      const Text('Scan a barcode or QR code with camera',
          style: TextStyle(color: Color(0xCCFFFFFF), fontSize: 13)),
    ]);
  }

  Widget _resultCard() {
    if (_mode == _ScanMode.unknown)
      return _card(Column(children: [
        const Text('❓', style: TextStyle(fontSize: 40)),
        const Text('Product Not Found',
            style: TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, color: ink)),
        const SizedBox(height: 6),
        Text(_barcode,
            style: const TextStyle(color: muted, fontFamily: 'monospace')),
        const SizedBox(height: 14),
        const Text("This barcode isn't in your inventory yet.",
            style: TextStyle(color: muted, fontSize: 13)),
        const SizedBox(height: 16),
        FilledButton(onPressed: _reset, child: const Text('Dismiss'))
      ]));
    final product = _product!;
    final stockColor = product.status == 'critical'
        ? const Color(0xFFD32F2F)
        : product.status == 'low'
            ? const Color(0xFFF57F17)
            : const Color(0xFF2E7D32);
    return Column(children: [
      _card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(product.emoji, style: const TextStyle(fontSize: 36)),
          const SizedBox(width: 12),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(product.name,
                    style: const TextStyle(
                        fontSize: 17, fontWeight: FontWeight.w800, color: ink)),
                Text('${product.barcode ?? _barcode} · ${product.category}',
                    style: const TextStyle(
                        color: muted, fontSize: 11, fontFamily: 'monospace'))
              ]))
        ]),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
          decoration: BoxDecoration(
              color: stockColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(99)),
          child: Text(
              product.status == 'good'
                  ? 'In Stock'
                  : product.status == 'low'
                      ? 'Low Stock'
                      : 'Critical Stock',
              style: TextStyle(
                  color: stockColor,
                  fontSize: 10,
                  fontWeight: FontWeight.w700)),
        ),
        const SizedBox(height: 16),
        Row(children: [
          _detail('Price', 'KSh ${product.price}', navy),
          _detail('Stock', '${product.stock} units', stockColor),
          _detail('Supplier', _supplier ?? 'N/A', muted),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          _actionTile('🛒', 'Add to Cart', navy, () {
            widget.onProductScanned(product);
            _close();
          }),
          _actionTile('📦', 'Restock', const Color(0xFF2E7D32),
              () => _restock(product)),
          _actionTile('👁️', 'View Details', navy, () => _showDetails(product)),
        ]),
        const SizedBox(height: 10),
        OutlinedButton(
          onPressed: () => _showMoreActions(product),
          style: OutlinedButton.styleFrom(
              minimumSize: const Size(double.infinity, 42),
              foregroundColor: muted,
              side: const BorderSide(color: Color(0xFFE0E6F0))),
          child: const Text('More Actions →'),
        ),
      ])),
      const SizedBox(height: 12),
      FilledButton.icon(
          onPressed: _startCamera,
          icon: const Icon(Icons.qr_code_scanner_rounded),
          label: const Text('Scan Next Product'),
          style: FilledButton.styleFrom(
              backgroundColor: ink,
              minimumSize: const Size(double.infinity, 46))),
    ]);
  }

  Widget _actionTile(
          String icon, String label, Color color, VoidCallback onTap) =>
      Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 3),
          child: Material(
            color: color.withValues(alpha: 0.09),
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(vertical: 11, horizontal: 4),
                child: Column(children: [
                  Text(icon, style: const TextStyle(fontSize: 18)),
                  const SizedBox(height: 4),
                  Text(label,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: color,
                          fontSize: 10,
                          fontWeight: FontWeight.w700))
                ]),
              ),
            ),
          ),
        ),
      );

  Future<void> _restock(Product product) async {
    final controller = TextEditingController(text: '1');
    final quantity = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Restock ${product.name}'),
        content: TextField(
            controller: controller,
            autofocus: true,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Quantity to add')),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () =>
                  Navigator.pop(context, int.tryParse(controller.text)),
              child: const Text('Restock'))
        ],
      ),
    );
    if (quantity == null || quantity <= 0) return;
    try {
      final result = await _scanLookupService.restock(product, quantity);
      if (!mounted || result.product == null) return;
      setState(() {
        _product = result.product;
        _supplier = result.supplier;
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Stock updated successfully.'),
          backgroundColor: Color(0xFF2E7D32)));
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Unable to restock: $error'),
            backgroundColor: const Color(0xFFD32F2F)));
    }
  }

  void _showDetails(Product product) => showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (context) => Padding(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 32),
          child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${product.emoji} ${product.name}',
                    style: const TextStyle(
                        color: ink, fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text('Barcode: ${product.barcode ?? _barcode}',
                    style: const TextStyle(color: muted)),
                Text('Category: ${product.category}',
                    style: const TextStyle(color: muted)),
                Text('Supplier: ${_supplier ?? 'Not assigned'}',
                    style: const TextStyle(color: muted)),
                Text('Current stock: ${product.stock} units',
                    style: const TextStyle(color: muted)),
              ]),
        ),
      );

  void _showMoreActions(Product product) => showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (context) => SafeArea(
            child: Wrap(children: [
          ListTile(
              leading: const Icon(Icons.shopping_cart_outlined),
              title: const Text('Add to Cart'),
              onTap: () {
                Navigator.pop(context);
                widget.onProductScanned(product);
                _close();
              }),
          ListTile(
              leading: const Icon(Icons.inventory_2_outlined),
              title: const Text('Restock Product'),
              onTap: () {
                Navigator.pop(context);
                _restock(product);
              }),
          ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('View Details'),
              onTap: () {
                Navigator.pop(context);
                _showDetails(product);
              }),
        ])),
      );

  Widget _activity(num total) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text("TODAY'S SCAN ACTIVITY",
            style: TextStyle(
                color: muted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6)),
        const SizedBox(height: 10),
        Row(children: [
          _detail('Barcode Scans', '$total', navy, icon: '📊'),
          _detail(
              'Unknown', '${_counts['UNKNOWN'] ?? 0}', const Color(0xFFD32F2F),
              icon: '🔍'),
          _detail('Manual Entry', '${_counts['MANUAL'] ?? 0}',
              const Color(0xFFF9A825),
              icon: '✏️')
        ]),
        const SizedBox(height: 18),
        const Text('RECENT SCANS',
            style: TextStyle(
                color: muted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6)),
        const SizedBox(height: 10),
        _card(Column(
            children: _recent.take(5).map((scan) {
          final barcode = scan['barcode']?.toString().trim() ?? '';
          final isUnknown =
              scan['status']?.toString().toUpperCase() == 'UNKNOWN';
          final isAdding = _addingRecentBarcode == barcode;
          final canOpen = barcode.isNotEmpty && !isUnknown;
          return Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: canOpen ? () => _openRecentScan(scan) : null,
              borderRadius: BorderRadius.circular(10),
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                leading: Text(scan['emoji']?.toString() ?? '📦',
                    style: const TextStyle(fontSize: 22)),
                title: Text(scan['name']?.toString() ?? 'Product',
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700)),
                subtitle: Text(
                    canOpen
                        ? '${scan['barcode']} · Tap to view options'
                        : scan['barcode']?.toString() ?? '',
                    style: const TextStyle(
                        fontSize: 10, color: muted, fontFamily: 'monospace')),
                trailing: isAdding
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : canOpen
                        ? const Icon(Icons.chevron_right_rounded,
                            color: navy, size: 20)
                        : Text(_time(scan['createdAt']),
                            style: const TextStyle(fontSize: 10, color: muted)),
              ),
            ),
          );
        }).toList())),
      ]);

  Widget _detail(String label, String value, Color color, {String? icon}) =>
      Expanded(
          child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 3),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                  color: const Color(0xFFF1F4FA),
                  borderRadius: BorderRadius.circular(10)),
              child: Column(children: [
                if (icon != null) Text(icon),
                Text(value,
                    style: TextStyle(
                        color: color,
                        fontSize: 14,
                        fontWeight: FontWeight.w800),
                    textAlign: TextAlign.center),
                const SizedBox(height: 2),
                Text(label,
                    style: const TextStyle(color: muted, fontSize: 10),
                    textAlign: TextAlign.center)
              ])));

  Widget _card(Widget child) => Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [
            BoxShadow(
                color: Color(0x11000000), blurRadius: 8, offset: Offset(0, 2))
          ]),
      child: child);
}
