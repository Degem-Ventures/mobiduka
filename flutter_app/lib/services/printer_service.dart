import 'package:bluetooth_print_plus/bluetooth_print_plus.dart';

class PrinterService {
  final EscCommand _escCommand = EscCommand();

  Future<List<BluetoothDevice>> getPairedDevices() async {
    final results = await BluetoothPrintPlus.startScan(timeout: const Duration(seconds: 8));
    return List<BluetoothDevice>.from(results as List);
  }

  Future<void> printReceipt({
    required BluetoothDevice device,
    required String storeName,
    required String invoiceNo,
    required double totalAmount,
    required String paymentMode,
    required List<Map<String, dynamic>> items,
  }) async {
    if (!BluetoothPrintPlus.isConnected) {
      await BluetoothPrintPlus.connect(device);
      await Future<void>.delayed(const Duration(milliseconds: 500));
    }

    await _escCommand.cleanCommand();
    await _escCommand.text(content: storeName.toUpperCase(), alignment: Alignment.center, fontSize: EscFontSize.size3);
    await _escCommand.text(content: 'Point of Sale Receipt', alignment: Alignment.center);
    await _escCommand.text(content: '--------------------------------', alignment: Alignment.center);
    await _escCommand.text(content: 'Invoice No: $invoiceNo');
    await _escCommand.text(content: 'Payment Mode: $paymentMode');
    await _escCommand.text(content: '--------------------------------', alignment: Alignment.center);

    for (final item in items) {
      final name = item['name']?.toString() ?? 'Item';
      final quantity = (item['qty'] as num?)?.toInt() ?? 0;
      final price = (item['price'] as num?)?.toDouble() ?? 0;
      await _escCommand.text(content: name);
      await _escCommand.text(content: '$quantity x KES ${price.toStringAsFixed(0)}    KES ${(quantity * price).toStringAsFixed(0)}');
    }

    await _escCommand.text(content: '--------------------------------', alignment: Alignment.center);
    await _escCommand.text(content: 'TOTAL AMOUNT: KES ${totalAmount.toStringAsFixed(2)}', alignment: Alignment.center, style: EscTextStyle.bold, fontSize: EscFontSize.size2);
    await _escCommand.text(content: 'Asante kwa biashara yako!', alignment: Alignment.center);
    await _escCommand.newline();
    await _escCommand.newline();
    await _escCommand.cutPaper();
    await BluetoothPrintPlus.write(await _escCommand.getCommand());
  }
}
