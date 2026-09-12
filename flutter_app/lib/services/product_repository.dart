import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import '../main.dart';

class ProductRepository {
  ProductRepository._();

  static final ProductRepository instance = ProductRepository._();

  static Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    String documentsPath;
    try {
      final documentsDirectory = await getApplicationDocumentsDirectory();
      documentsPath = documentsDirectory.path;
    } on Object {
      documentsPath = Directory.systemTemp.path;
    }
    final path = join(documentsPath, 'mobiduka_products.db');

    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE products (
            id TEXT PRIMARY KEY,
            name TEXT,
            category TEXT,
            cost INTEGER,
            price INTEGER,
            stock INTEGER,
            reorder INTEGER,
            emoji TEXT,
            status TEXT
          )
        ''');
      },
    );
  }

  Future<void> clear() async {
    final db = await database;
    await db.delete('products');
  }

  Future<void> saveProducts(List<Product> products) async {
    final db = await database;
    final batch = db.batch();

    for (final product in products) {
      batch.insert(
        'products',
        {
          'id': product.name,
          'name': product.name,
          'category': product.category,
          'cost': product.cost,
          'price': product.price,
          'stock': product.stock,
          'reorder': product.reorder,
          'emoji': product.emoji,
          'status': product.status,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }

    await batch.commit();
  }

  Future<List<Product>> loadProducts() async {
    final db = await database;
    final rows = await db.query('products');
    return rows.map((row) {
      final status = row['status'] as String? ?? 'good';
      return Product(
        row['name'] as String,
        row['category'] as String,
        row['cost'] as int? ?? 0,
        row['price'] as int? ?? 0,
        row['stock'] as int? ?? 0,
        row['reorder'] as int? ?? 10,
        row['emoji'] as String? ?? '📦',
        status: status,
      );
    }).toList();
  }

  Future<void> upsertProduct(Product product) async {
    final db = await database;
    await db.insert(
      'products',
      {
        'id': product.name,
        'name': product.name,
        'category': product.category,
        'cost': product.cost,
        'price': product.price,
        'stock': product.stock,
        'reorder': product.reorder,
        'emoji': product.emoji,
        'status': product.status,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Product>> searchProducts(String query) async {
    final db = await database;
    final rows = await db.query(
      'products',
      where: 'name LIKE ? OR category LIKE ?',
      whereArgs: ['%$query%', '%$query%'],
    );
    return rows.map((row) {
      final status = row['status'] as String? ?? 'good';
      return Product(
        row['name'] as String,
        row['category'] as String,
        row['cost'] as int? ?? 0,
        row['price'] as int? ?? 0,
        row['stock'] as int? ?? 0,
        row['reorder'] as int? ?? 10,
        row['emoji'] as String? ?? '📦',
        status: status,
      );
    }).toList();
  }

  Future<List<Map<String, dynamic>>> fetchCatalogJson() async {
    final db = await database;
    final rows = await db.query('products');
    return rows.map((row) {
      return {
        'name': row['name'],
        'category': row['category'],
        'cost': row['cost'],
        'price': row['price'],
        'stock': row['stock'],
        'reorder': row['reorder'],
        'emoji': row['emoji'],
        'status': row['status'],
      };
    }).toList();
  }

  Future<void> syncLocalCatalog(List<Product> products) async {
    await saveProducts(products);
  }
}
