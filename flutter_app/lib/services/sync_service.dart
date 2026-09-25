import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import 'api_config.dart';
import 'telemetry_http_client.dart';

class SyncService {
  SyncService({http.Client? client}) : _client = client ?? http.Client();

  static Database? _database;
  final String baseUrl = ApiConfig.apiBase;
  final http.Client _client;

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
      version: 2,
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
        await db.execute('''
          CREATE TABLE local_auth_roster (
            id TEXT PRIMARY KEY,
            businessId TEXT NOT NULL,
            fullName TEXT NOT NULL,
            role TEXT NOT NULL,
            pinHash TEXT NOT NULL,
            status TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          )
        ''');
        await SyncService.migrateAndEvolveSchema(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await db.execute('''
            CREATE TABLE IF NOT EXISTS local_auth_roster (
              id TEXT PRIMARY KEY,
              businessId TEXT NOT NULL,
              fullName TEXT NOT NULL,
              role TEXT NOT NULL,
              pinHash TEXT NOT NULL,
              status TEXT NOT NULL,
              updatedAt TEXT NOT NULL
            )
          ''');
        }
        await SyncService.migrateAndEvolveSchema(db);
      },
    );
  }

  static Future<void> migrateAndEvolveSchema(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )
    ''');

    final List<Map<String, dynamic>> columnInfo = await db.rawQuery("PRAGMA table_info(sync_queue)");
    final existingColumns = columnInfo.map((c) => c['name'] as String).toSet();

    final modifications = {
      'businessId': "ALTER TABLE sync_queue ADD COLUMN businessId TEXT DEFAULT '';",
      'entityName': "ALTER TABLE sync_queue ADD COLUMN entityName TEXT DEFAULT '';",
      'externalId': "ALTER TABLE sync_queue ADD COLUMN externalId TEXT DEFAULT '';",
      'payloadHash': "ALTER TABLE sync_queue ADD COLUMN payloadHash TEXT DEFAULT '';",
      'status': "ALTER TABLE sync_queue ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING';",
      'attemptCount': "ALTER TABLE sync_queue ADD COLUMN attemptCount INTEGER NOT NULL DEFAULT 0;",
      'nextRetryAt': "ALTER TABLE sync_queue ADD COLUMN nextRetryAt TEXT;",
      'lastError': "ALTER TABLE sync_queue ADD COLUMN lastError TEXT;",
      'isSynced': "ALTER TABLE sync_queue ADD COLUMN isSynced INTEGER NOT NULL DEFAULT 0;",
    };

    for (final entry in modifications.entries) {
      if (!existingColumns.contains(entry.key)) {
        await db.execute(entry.value);
      }
    }

    await db.execute('''
      UPDATE sync_queue SET 
        businessId = COALESCE(businessId, ''),
        entityName = COALESCE(entityName, ''),
        externalId = COALESCE(externalId, ''),
        payloadHash = COALESCE(payloadHash, ''),
        status = COALESCE(status, 'PENDING'),
        attemptCount = COALESCE(attemptCount, 0),
        isSynced = COALESCE(isSynced, 0),
        nextRetryAt = COALESCE(nextRetryAt, createdAt);
    ''');

    await db.execute('''
      DELETE FROM sync_queue
      WHERE id NOT IN (
        SELECT s1.id
        FROM sync_queue AS s1
        INNER JOIN (
          SELECT
            COALESCE(businessId, '') AS bId,
            COALESCE(entityName, '') AS eName,
            COALESCE(externalId, '') AS exId,
            MAX(createdAt) AS maxCreatedAt
          FROM sync_queue
          WHERE COALESCE(businessId, '') != ''
            AND COALESCE(entityName, '') != ''
            AND COALESCE(externalId, '') != ''
          GROUP BY
            COALESCE(businessId, ''),
            COALESCE(entityName, ''),
            COALESCE(externalId, '')
        ) AS s2
        ON s1.businessId = s2.bId
       AND s1.entityName = s2.eName
       AND s1.externalId = s2.exId
       AND s1.createdAt = s2.maxCreatedAt
      )
      AND COALESCE(businessId, '') != ''
      AND COALESCE(entityName, '') != ''
      AND COALESCE(externalId, '') != '';
    ''');

    await db.execute('''
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_idempotency_v4 
      ON sync_queue (businessId, entityName, externalId);
    ''');
  }

  String computeFailsafeHash(String text) {
    int hash = 5381;
    for (int i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) + text.codeUnitAt(i);
    }
    return hash.toUnsigned(32).toRadixString(16);
  }

  DateTime calculateBackoffDelay(int attemptCount) {
    if (attemptCount <= 0) return DateTime.now();
    final int delaySeconds = min(3600, pow(2, attemptCount) * 5).toInt();
    final int jitter = Random().nextInt(5);
    return DateTime.now().add(Duration(seconds: delaySeconds + jitter));
  }

  Future<void> enqueueStatefulRecord(
    Database db, {
    required String id,
    required String businessId,
    required String entityName,
    required String externalId,
    required Map<String, dynamic> payloadMap,
  }) async {
    final String jsonPayload = jsonEncode(payloadMap);
    final String hash = computeFailsafeHash(jsonPayload);
    final String timestamp = DateTime.now().toIso8601String();

    await db.insert(
      'sync_queue',
      {
        'id': id,
        'businessId': businessId,
        'entityName': entityName,
        'externalId': externalId,
        'payloadHash': hash,
        'payload': jsonPayload,
        'status': 'PENDING',
        'attemptCount': 0,
        'createdAt': timestamp,
        'nextRetryAt': timestamp,
        'isSynced': 0,
      },
      conflictAlgorithm: ConflictAlgorithm.ignore,
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
      final response = await TelemetryHttpClient(
        _client,
        businessId: businessId,
      ).post(
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
