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
    // The local schema is evolved additively. Existing installations can have
    // the current database version while still missing a table introduced by
    // a later offline feature, so run the idempotent evolution pass on open.
    await migrateAndEvolveSchema(_database!);
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
      version: 3,
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

    // Generic snapshots are deliberately schema-light. They give every
    // feature a durable, tenant-scoped cache while its typed repository is
    // migrated to the local-first boundary.
    await db.execute('''
      CREATE TABLE IF NOT EXISTS offline_collection_cache (
        businessId TEXT NOT NULL,
        cacheKey TEXT NOT NULL,
        payload TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (businessId, cacheKey)
      )
    ''');

    await db.execute('''
      CREATE TABLE IF NOT EXISTS offline_entity_cache (
        businessId TEXT NOT NULL,
        entityName TEXT NOT NULL,
        entityId TEXT NOT NULL,
        payload TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        isPendingSync INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (businessId, entityName, entityId)
      )
    ''');

    // Incoming M-Pesa confirmations are immutable financial evidence. Keep a
    // separate receipt ledger so repeated inbox scans never double-credit a
    // customer while the device is offline.
    await db.execute('''
      CREATE TABLE IF NOT EXISTS mpesa_sms_cache (
        receiptCode TEXT PRIMARY KEY,
        businessId TEXT NOT NULL,
        senderPhone TEXT,
        customerName TEXT,
        amount REAL NOT NULL,
        customerId TEXT,
        isMatched INTEGER NOT NULL DEFAULT 0,
        isPendingSync INTEGER NOT NULL DEFAULT 1,
        rawMessage TEXT,
        createdAt TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE IF NOT EXISTS local_supplier_directory (
        id TEXT PRIMARY KEY,
        businessId TEXT NOT NULL,
        payload TEXT NOT NULL,
        isPendingSync INTEGER NOT NULL DEFAULT 0,
        updatedAt TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS local_purchase_orders (
        id TEXT PRIMARY KEY,
        businessId TEXT NOT NULL,
        payload TEXT NOT NULL,
        isPendingSync INTEGER NOT NULL DEFAULT 0,
        updatedAt TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mpesa_sms_cache_business_receipt
      ON mpesa_sms_cache (businessId, receiptCode)
    ''');

    final List<Map<String, dynamic>> columnInfo =
        await db.rawQuery("PRAGMA table_info(sync_queue)");
    final existingColumns = columnInfo.map((c) => c['name'] as String).toSet();

    final modifications = {
      'businessId':
          "ALTER TABLE sync_queue ADD COLUMN businessId TEXT DEFAULT '';",
      'entityName':
          "ALTER TABLE sync_queue ADD COLUMN entityName TEXT DEFAULT '';",
      'externalId':
          "ALTER TABLE sync_queue ADD COLUMN externalId TEXT DEFAULT '';",
      'payloadHash':
          "ALTER TABLE sync_queue ADD COLUMN payloadHash TEXT DEFAULT '';",
      'status':
          "ALTER TABLE sync_queue ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING';",
      'attemptCount':
          "ALTER TABLE sync_queue ADD COLUMN attemptCount INTEGER NOT NULL DEFAULT 0;",
      'nextRetryAt': "ALTER TABLE sync_queue ADD COLUMN nextRetryAt TEXT;",
      'lastError': "ALTER TABLE sync_queue ADD COLUMN lastError TEXT;",
      'isSynced':
          "ALTER TABLE sync_queue ADD COLUMN isSynced INTEGER NOT NULL DEFAULT 0;",
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

    // Idempotency belongs to the immutable outbox event (`id`), not the
    // mutable entity ID. Keeping this index non-unique preserves ordered
    // updates such as OPEN then CLOSE for a cash session or repeated restocks.
    await db.execute('DROP INDEX IF EXISTS idx_sync_queue_idempotency_v4');
    await db.execute('''
      CREATE INDEX IF NOT EXISTS idx_sync_queue_pending_order_v5
      ON sync_queue (businessId, entityName, externalId, createdAt);
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
    final timestamp = DateTime.now().toIso8601String();
    final jsonPayload = jsonEncode(payload);
    final externalId = payload['id']?.toString().trim().isNotEmpty == true
        ? payload['id'].toString()
        : payload['sessionId']?.toString().trim().isNotEmpty == true
            ? payload['sessionId'].toString()
            : id;
    await db.insert(
      'sync_queue',
      {
        'id': id,
        'businessId': payload['businessId']?.toString() ?? '',
        'entityName': entityName,
        'operation': operation,
        'externalId': externalId,
        'payloadHash': computeFailsafeHash(jsonPayload),
        'payload': jsonPayload,
        'status': 'PENDING',
        'attemptCount': 0,
        'nextRetryAt': timestamp,
        'isSynced': 0,
        'createdAt': timestamp,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> cacheCollection({
    required String businessId,
    required String cacheKey,
    required Object payload,
  }) async {
    final db = await database;
    await db.insert(
      'offline_collection_cache',
      {
        'businessId': businessId,
        'cacheKey': cacheKey,
        'payload': jsonEncode(payload),
        'updatedAt': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<Object?> readCachedCollection({
    required String businessId,
    required String cacheKey,
  }) async {
    final db = await database;
    final rows = await db.query(
      'offline_collection_cache',
      where: 'businessId = ? AND cacheKey = ?',
      whereArgs: [businessId, cacheKey],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    try {
      return jsonDecode(rows.first['payload'] as String);
    } on FormatException {
      return null;
    }
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
