import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:vibration/vibration.dart';

import '../main.dart';
import '../services/credit_service.dart';
import '../services/product_repository.dart';

class BarcodeScannerView extends StatefulWidget {
  const BarcodeScannerView({required this.onProductScanned, this.onCustomerQrScanned, this.onCodeScanned, super.key});

  final ValueChanged<Product> onProductScanned;
  final ValueChanged<CreditAccount>? onCustomerQrScanned;
  final ValueChanged<String>? onCodeScanned;

  @override
  State<BarcodeScannerView> createState() => _BarcodeScannerViewState();
}

class _BarcodeScannerViewState extends State<BarcodeScannerView> {
  final ProductRepository _productRepository = ProductRepository.instance;
  final CreditService _creditService = CreditService.instance;
  final MobileScannerController _scannerController = MobileScannerController(
    formats: <BarcodeFormat>[BarcodeFormat.all],
  );
  bool _isProcessing = false;

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan Product Barcode'),
        backgroundColor: navy,
        foregroundColor: Colors.white,
      ),
      body: MobileScanner(
        controller: _scannerController,
        onDetect: (capture) async {
          if (_isProcessing || capture.barcodes.isEmpty) return;
          final String? scannedCode = capture.barcodes.first.rawValue;
          if (scannedCode == null || scannedCode.isEmpty) return;

          setState(() => _isProcessing = true);
          if (await Vibration.hasVibrator()) {
            await Vibration.vibrate(duration: 100);
          }

          if (widget.onCodeScanned != null) {
            widget.onCodeScanned!(scannedCode);
            if (context.mounted) Navigator.of(context).pop();
            return;
          }

          final customerId = _customerIdFromQr(scannedCode);
          if (customerId != null) {
            final customer = await _creditService.findByCustomerId(customerId);
            if (!context.mounted) return;
            if (customer == null || widget.onCustomerQrScanned == null) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Customer account not found for QR code.'), backgroundColor: Color(0xFFD32F2F)),
              );
              setState(() => _isProcessing = false);
              return;
            }

            widget.onCustomerQrScanned!(customer);
            Navigator.of(context).pop();
            return;
          }

          final product = await _productRepository.findByBarcode(scannedCode);
          if (!context.mounted) return;

          if (product == null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Item not found for code: $scannedCode'), backgroundColor: const Color(0xFFD32F2F)),
            );
            await Future<void>.delayed(const Duration(seconds: 2));
            if (!context.mounted) return;
            setState(() => _isProcessing = false);
            return;
          }

          widget.onProductScanned(product);
          Navigator.of(context).pop();
        },
      ),
    );
  }

  String? _customerIdFromQr(String payload) {
    if (payload.startsWith('MOBIDUKA:USER:')) {
      return payload.substring('MOBIDUKA:USER:'.length);
    }
    if (payload.startsWith('CUST_')) {
      return payload.substring('CUST_'.length);
    }
    return null;
  }
}
