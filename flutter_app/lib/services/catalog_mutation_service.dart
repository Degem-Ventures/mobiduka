import 'dart:math';

import 'package:flutter/foundation.dart';

import '../main.dart' show Product;
import 'offline_snapshot_cache.dart';
import 'sync_service.dart';

/// Applies inventory changes locally before adding a replay-safe event to the
/// sync outbox. The catalogue snapshot remains the source used by web and
/// native read paths between connectivity changes.
class CatalogMutationService {
  CatalogMutationService({
    OfflineSnapshotCache? cache,
    SyncService? syncService,
  })  : _cache = cache ?? SecureOfflineSnapshotCache(),
        _syncService = syncService ?? SyncService();

  final OfflineSnapshotCache _cache;
  final SyncService _syncService;

  static const _catalogKey = 'catalog.products.v1';

  Future<Product> createProduct({
    required String businessId,
    required String userId,
    required String name,
    required String categoryId,
    required String categoryName,
    required int cost,
    required int price,
    required int stock,
    required int reorder,
    required String emoji,
    String? barcode,
  }) async {
    final id = _uuidV4();
    final safeStock = max(0, stock);
    final safeReorder = max(0, reorder);
    final product = Product(
      name.trim(),
      categoryName,
      cost,
      price,
      safeStock,
      safeReorder,
      emoji,
      id: id,
      barcode: barcode?.trim().isEmpty == true ? null : barcode?.trim(),
      status: _stockStatus(safeStock, safeReorder),
    );
    await _replaceProductInSnapshot(businessId, product,
        categoryId: categoryId);
    if (!kIsWeb) {
      await _syncService.queueChange(
        id: _uuidV4(),
        entityName: 'Product',
        operation: 'CREATE',
        payload: {
          'id': id,
          'businessId': businessId,
          'categoryId': categoryId,
          'name': product.name,
          'barcode': product.barcode,
          'costPrice': cost,
          'sellingPrice': price,
          'minimumStock': reorder,
          'emoji': emoji,
          'stock': stock,
          'userId': userId,
          'createdAt': DateTime.now().toIso8601String(),
        },
      );
    }
    return product;
  }

  Future<Product> adjustStock({
    required String businessId,
    required Product product,
    required int delta,
    required String userId,
    String reason = 'RESTOCK',
    bool enqueueSync = true,
  }) async {
    final productId = product.id;
    if (productId == null || productId.isEmpty) {
      throw ArgumentError(
          'A product ID is required for offline inventory changes.');
    }
    final nextStock = max(0, product.stock + delta);
    final updated = Product(
      product.name,
      product.category,
      product.cost,
      product.price,
      nextStock,
      product.reorder,
      product.emoji,
      id: productId,
      barcode: product.barcode,
      status: _stockStatus(nextStock, product.reorder),
    );
    await _replaceProductInSnapshot(businessId, updated);

    if (enqueueSync && !kIsWeb) {
      final eventId = _uuidV4();
      final timestamp = DateTime.now().toIso8601String();
      await _syncService.queueChange(
        id: eventId,
        entityName: 'Product',
        operation: 'UPDATE',
        payload: {
          'id': productId,
          'businessId': businessId,
          'name': updated.name,
          'barcode': updated.barcode,
          'costPrice': updated.cost,
          'sellingPrice': updated.price,
          'minimumStock': updated.reorder,
          'emoji': updated.emoji,
          'stock': nextStock,
          'updatedAt': timestamp,
          'userId': userId,
          'reason': reason,
        },
      );
    }
    return updated;
  }

  Future<List<Product>> applySaleStock({
    required String businessId,
    required List<Map<String, dynamic>> items,
    required String userId,
  }) async {
    final cached = await _readProducts(businessId);
    if (cached.isEmpty) return const [];
    final quantities = <String, int>{
      for (final item in items)
        if (item['productId']?.toString().isNotEmpty == true)
          item['productId'].toString(): (item['quantity'] as num?)?.toInt() ??
              (item['qty'] as num?)?.toInt() ??
              0,
    };
    final updated = <Product>[];
    for (final product in cached) {
      final quantity = quantities[product.id];
      if (quantity == null || quantity <= 0) continue;
      updated.add(await adjustStock(
        businessId: businessId,
        product: product,
        delta: -quantity,
        userId: userId,
        reason: 'SALE',
        enqueueSync: false,
      ));
    }
    return updated;
  }

  Future<void> _replaceProductInSnapshot(
    String businessId,
    Product product, {
    String? categoryId,
  }) async {
    final values = await _readRawProducts(businessId);
    final replacement = _toSnapshot(product, categoryId: categoryId);
    final index =
        values.indexWhere((value) => value['id']?.toString() == product.id);
    if (index >= 0) {
      values[index] = {...values[index], ...replacement};
    } else {
      values.insert(0, replacement);
    }
    await _cache.writeJson(
        businessId: businessId, key: _catalogKey, value: values);
  }

  Future<List<Product>> _readProducts(String businessId) async {
    return (await _readRawProducts(businessId)).map(_fromSnapshot).toList();
  }

  Future<List<Map<String, dynamic>>> _readRawProducts(String businessId) async {
    final value =
        await _cache.readJson(businessId: businessId, key: _catalogKey);
    if (value is! List) return [];
    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Map<String, dynamic> _toSnapshot(Product product, {String? categoryId}) => {
        'id': product.id,
        'name': product.name,
        'barcode': product.barcode,
        'costPrice': product.cost,
        'sellingPrice': product.price,
        'minimumStock': product.reorder,
        'emoji': product.emoji,
        'inventory': {'quantity': product.stock},
        'category': {
          if (categoryId != null) 'id': categoryId,
          'name': product.category,
          'emoji': product.emoji,
        },
      };

  Product _fromSnapshot(Map<String, dynamic> product) {
    final category = product['category'] as Map?;
    final inventory = product['inventory'] as Map?;
    final stock = _number(inventory?['quantity'] ?? product['stock']).toInt();
    final reorder =
        _number(product['minimumStock'] ?? product['reorder']).toInt();
    return Product(
      product['name']?.toString() ?? 'Product',
      category?['name']?.toString() ??
          product['categoryName']?.toString() ??
          'Uncategorized',
      _number(product['costPrice'] ?? product['cost']).toInt(),
      _number(product['sellingPrice'] ?? product['price']).toInt(),
      stock,
      reorder,
      product['emoji']?.toString() ?? category?['emoji']?.toString() ?? '📦',
      id: product['id']?.toString(),
      barcode: product['barcode']?.toString(),
      status: _stockStatus(stock, reorder),
    );
  }

  static String _stockStatus(int stock, int reorder) => stock == 0
      ? 'critical'
      : reorder > 0 && stock <= reorder
          ? 'low'
          : 'good';

  static num _number(Object? value) =>
      value is num ? value : num.tryParse(value?.toString() ?? '') ?? 0;

  static String _uuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    String hex(int value) => value.toRadixString(16).padLeft(2, '0');
    final text = bytes.map(hex).join();
    return '${text.substring(0, 8)}-${text.substring(8, 12)}-${text.substring(12, 16)}-${text.substring(16, 20)}-${text.substring(20)}';
  }
}
