import 'dart:io';

import 'package:flutter/foundation.dart';
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
      version: 2,
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
            barcode TEXT,
            status TEXT
          )
        ''');
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2)
          await db.execute('ALTER TABLE products ADD COLUMN barcode TEXT');
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
          'id': product.id ?? product.name,
          'name': product.name,
          'category': product.category,
          'cost': product.cost,
          'price': product.price,
          'stock': product.stock,
          'reorder': product.reorder,
          'emoji': product.emoji,
          'barcode': product.barcode,
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
        id: row['id'] as String?,
        status: status,
        barcode: row['barcode'] as String?,
      );
    }).toList();
  }

  Future<void> upsertProduct(Product product) async {
    if (kIsWeb) {
      final index = products.indexWhere((item) => item.name == product.name);
      if (index >= 0) {
        products[index] = product;
      } else {
        products.insert(0, product);
      }
      return;
    }
    final db = await database;
    await db.insert(
      'products',
      {
        'id': product.id ?? product.name,
        'name': product.name,
        'category': product.category,
        'cost': product.cost,
        'price': product.price,
        'stock': product.stock,
        'reorder': product.reorder,
        'emoji': product.emoji,
        'barcode': product.barcode,
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
        id: row['id'] as String?,
        status: status,
        barcode: row['barcode'] as String?,
      );
    }).toList();
  }

  Future<Product?> findByBarcode(String barcode) async {
    if (kIsWeb) {
      for (final product in products) {
        if (product.barcode == barcode) return product;
      }
      return null;
    }
    final db = await database;
    final rows = await db.query('products',
        where: 'barcode = ?', whereArgs: [barcode], limit: 1);
    if (rows.isEmpty) return null;
    final row = rows.first;
    return Product(
      row['name'] as String,
      row['category'] as String,
      row['cost'] as int? ?? 0,
      row['price'] as int? ?? 0,
      row['stock'] as int? ?? 0,
      row['reorder'] as int? ?? 10,
      row['emoji'] as String? ?? '📦',
      id: row['id'] as String?,
      status: row['status'] as String? ?? 'good',
      barcode: row['barcode'] as String?,
    );
  }

  Future<List<Map<String, dynamic>>> fetchCatalogJson() async {
    final db = await database;
    final rows = await db.query('products');
    return rows.map((row) {
      return {
        'id': row['id'],
        'name': row['name'],
        'category': row['category'],
        'cost': row['cost'],
        'price': row['price'],
        'stock': row['stock'],
        'reorder': row['reorder'],
        'emoji': row['emoji'],
        'barcode': row['barcode'],
        'status': row['status'],
      };
    }).toList();
  }

  Future<void> syncLocalCatalog(List<Product> products) async {
    await saveProducts(products);
  }
}
