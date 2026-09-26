import 'package:flutter_test/flutter_test.dart';
import 'package:mobiduka_pos/services/catalog_mutation_service.dart';
import 'package:mobiduka_pos/services/offline_snapshot_cache.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

class MutationMemoryCache implements OfflineSnapshotCache {
  final Map<String, Object> values = {};

  String _key(String businessId, String key) => '$businessId:$key';

  @override
  Future<Object?> readJson(
          {required String businessId, required String key}) async =>
      values[_key(businessId, key)];

  @override
  Future<void> writeJson({
    required String businessId,
    required String key,
    required Object value,
  }) async {
    values[_key(businessId, key)] = value;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  test(
      'sale stock changes update the persisted catalogue without a product sync event',
      () async {
    final cache = MutationMemoryCache();
    const businessId = 'business-1';
    await cache.writeJson(
      businessId: businessId,
      key: 'catalog.products.v1',
      value: [
        {
          'id': 'product-1',
          'name': 'Unga',
          'costPrice': 100,
          'sellingPrice': 130,
          'minimumStock': 3,
          'inventory': {'quantity': 10},
          'category': {'name': 'Flour'},
        }
      ],
    );

    final service = CatalogMutationService(cache: cache);
    final changed = await service.applySaleStock(
      businessId: businessId,
      userId: 'user-1',
      items: [
        {'productId': 'product-1', 'quantity': 4}
      ],
    );

    expect(changed, hasLength(1));
    expect(changed.single.stock, 6);
    final snapshot = await cache.readJson(
        businessId: businessId, key: 'catalog.products.v1') as List;
    final product = snapshot.single as Map;
    expect((product['inventory'] as Map)['quantity'], 6);
  });

  test('new product creation appears in the local catalogue immediately',
      () async {
    final cache = MutationMemoryCache();
    final service = CatalogMutationService(cache: cache);
    final product = await service.createProduct(
      businessId: 'business-1',
      userId: 'user-1',
      categoryId: 'category-1',
      categoryName: 'Flour',
      name: 'Unga',
      cost: 100,
      price: 130,
      stock: 10,
      reorder: 3,
      emoji: 'FLOUR',
    );

    expect(product.id, isNotEmpty);
    final snapshot = await cache.readJson(
        businessId: 'business-1', key: 'catalog.products.v1') as List;
    expect((snapshot.single as Map)['id'], product.id);
    expect(((snapshot.single as Map)['category'] as Map)['id'], 'category-1');
  });
}
