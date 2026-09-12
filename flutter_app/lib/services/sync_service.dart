import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

class SyncService {
  static Database? _database;
  final String baseUrl = 'http://localhost:3000/api';

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
    final path = join(documentsPath, 'mobiduka_local.db');

    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE sync_queue (
            id TEXT PRIMARY KEY,
            entityName TEXT,
            operation TEXT,
            payload TEXT,
            createdAt TEXT
          )
        ''');
      },
    );
  }

  Future<void> queueChange({
    required String id,
    required String entityName,
    required String operation,
    required Map<String, dynamic> payload,
  }) async {
    final db = await database;
    await db.insert(
      'sync_queue',
      {
        'id': id,
        'entityName': entityName,
        'operation': operation,
        'payload': jsonEncode(payload),
        'createdAt': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<bool> processCloudSync({
    required String businessId,
    required String deviceId,
    required String userId,
  }) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('sync_queue');

    if (maps.isEmpty) {
      return true;
    }

    final recordsToSync = maps.map((row) {
      return {
        'id': row['id'],
        'entityName': row['entityName'],
        'operation': row['operation'],
        'payload': jsonDecode(row['payload'] as String),
        'createdAt': row['createdAt'],
      };
    }).toList();

    final requestBody = {
      'businessId': businessId,
      'deviceId': deviceId,
      'userId': userId,
      'records': recordsToSync,
    };

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/sync'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(requestBody),
      );

      if (response.statusCode == 200) {
        for (final record in recordsToSync) {
          await db.delete(
            'sync_queue',
            where: 'id = ?',
            whereArgs: [record['id']],
          );
        }
        return true;
      }

      return false;
    } catch (_) {
      return false;
    }
  }
}
