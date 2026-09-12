import 'package:flutter_test/flutter_test.dart';
import 'package:mobiduka_pos/main.dart';
import 'package:mobiduka_pos/services/product_repository.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  databaseFactory = databaseFactoryFfi;

  test('product repository stores and loads cached products', () async {
    final repository = ProductRepository.instance;
    await repository.clear();

    final products = [
      const Product('Unga Jogoo 2kg', 'Flour', 160, 200, 45, 20, '🌾'),
      const Product('Milk 500ml', 'Dairy', 75, 100, 60, 40, '🥛'),
    ];

    await repository.saveProducts(products);
    final loaded = await repository.loadProducts();

    expect(loaded.length, 2);
    expect(loaded.first.name, 'Unga Jogoo 2kg');
    expect(loaded.last.category, 'Dairy');
  });
}
