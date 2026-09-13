import 'package:blue_thermal_printer/blue_thermal_printer.dart';

class PrinterService {
  final BlueThermalPrinter bluetooth = BlueThermalPrinter.instance;

  Future<List<BluetoothDevice>> getPairedDevices() => bluetooth.getBondedDevices();

  Future<void> printReceipt({
    required BluetoothDevice device,
    required String storeName,
    required String invoiceNo,
    required double totalAmount,
    required String paymentMode,
    required List<Map<String, dynamic>> items,
  }) async {
    final connected = await bluetooth.isConnected ?? false;
    if (!connected) await bluetooth.connect(device);

    bluetooth.printCustom(storeName.toUpperCase(), 3, 1);
    bluetooth.printCustom('Point of Sale Receipt', 1, 1);
    bluetooth.printCustom('--------------------------------', 1, 1);
    bluetooth.printLeftRight('Invoice No:', invoiceNo, 1);
    bluetooth.printLeftRight('Payment Mode:', paymentMode, 1);
    bluetooth.printCustom('--------------------------------', 1, 1);

    for (final item in items) {
      final name = item['name']?.toString() ?? 'Item';
      final quantity = (item['qty'] as num?)?.toInt() ?? 0;
      final price = (item['price'] as num?)?.toDouble() ?? 0;
      bluetooth.printCustom(name, 1, 0);
      bluetooth.printLeftRight('$quantity x KES ${price.toStringAsFixed(0)}', 'KES ${(quantity * price).toStringAsFixed(0)}', 1);
    }

    bluetooth.printCustom('--------------------------------', 1, 1);
    bluetooth.printCustom('TOTAL AMOUNT: KES ${totalAmount.toStringAsFixed(2)}', 2, 1);
    bluetooth.printCustom('Asante kwa biashara yako!', 1, 1);
    bluetooth.printNewLine();
    bluetooth.printNewLine();
    bluetooth.paperCut();
  }
}
