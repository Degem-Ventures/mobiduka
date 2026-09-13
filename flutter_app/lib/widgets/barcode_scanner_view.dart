import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../main.dart';
import '../services/product_repository.dart';

class BarcodeScannerView extends StatefulWidget {
  const BarcodeScannerView({required this.onProductScanned, super.key});

  final ValueChanged<Product> onProductScanned;

  @override
  State<BarcodeScannerView> createState() => _BarcodeScannerViewState();
}

class _BarcodeScannerViewState extends State<BarcodeScannerView> {
  final ProductRepository _productRepository = ProductRepository.instance;
  bool _isProcessing = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan Product Barcode'),
        backgroundColor: navy,
        foregroundColor: Colors.white,
      ),
      body: MobileScanner(
        onDetect: (capture) async {
          if (_isProcessing || capture.barcodes.isEmpty) return;
          final value = capture.barcodes.first.rawValue;
          if (value == null || value.isEmpty) return;

          setState(() => _isProcessing = true);
          final product = await _productRepository.findByBarcode(value);
          if (!mounted) return;

          if (product == null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Item not found for barcode: $value'), backgroundColor: const Color(0xFFD32F2F)),
            );
            await Future<void>.delayed(const Duration(seconds: 2));
            if (mounted) setState(() => _isProcessing = false);
            return;
          }

          widget.onProductScanned(product);
          Navigator.of(context).pop();
        },
      ),
    );
  }
}
