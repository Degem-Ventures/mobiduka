import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:sqflite/sqflite.dart';

import 'api_config.dart';
import 'sync_service.dart';

class EmployeeRepository {
  EmployeeRepository({SyncService? syncService}) : _syncService = syncService ?? SyncService();

  final SyncService _syncService;
  final http.Client _client = http.Client();
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  Future<void> ensureSchema() async {
    final db = await _syncService.database;
    await db.execute('''
      CREATE TABLE IF NOT EXISTS local_employees (
        id TEXT PRIMARY KEY,
        businessId TEXT NOT NULL,
        fullName TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        pinSet INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    ''');
  }

  Future<List<Map<String, dynamic>>> loadEmployees({String businessId = 'demo-business'}) async {
    await ensureSchema();
    final db = await _syncService.database;
    return db.query('local_employees', where: 'businessId = ?', whereArgs: [businessId], orderBy: 'fullName ASC');
  }

  Future<Map<String, dynamic>> saveEmployee({
    required String businessId,
    String? id,
    required String fullName,
    String? email,
    String? phone,
    required String role,
    String? pin,
    bool active = true,
  }) async {
    final normalizedPin = pin?.trim();
    if (normalizedPin != null && !RegExp(r'^\d{4}$').hasMatch(normalizedPin)) {
      throw const FormatException('PIN must contain exactly 4 digits.');
    }

    var employeeId = id ?? 'employee-${DateTime.now().microsecondsSinceEpoch}';
    var synced = false;
    final token = await _storage.read(key: 'mobiduka.auth.jwt');
    if (token != null && token.isNotEmpty) {
      try {
        final response = await _client.post(
          Uri.parse('${ApiConfig.apiBase}/employees'),
          headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
          body: jsonEncode({
            if (id != null) 'id': id,
            'businessId': businessId,
            'fullName': fullName.trim(),
            'email': email?.trim(),
            'phone': phone?.trim(),
            'role': role.toUpperCase(),
            if (normalizedPin != null && normalizedPin.isNotEmpty) 'pin': normalizedPin,
            'isActive': active,
          }),
        ).timeout(const Duration(seconds: 10));
        if (response.statusCode >= 200 && response.statusCode < 300) {
          final body = jsonDecode(response.body) as Map<String, dynamic>;
          employeeId = body['employeeId']?.toString() ?? employeeId;
          synced = true;
        }
      } on Object {
        // Persist locally and leave the record available for a later sync attempt.
      }
    }

    await ensureSchema();
    final db = await _syncService.database;
    final now = DateTime.now().toIso8601String();
    final record = <String, dynamic>{
      'id': employeeId,
      'businessId': businessId,
      'fullName': fullName.trim(),
      'email': email?.trim() ?? '',
      'phone': phone?.trim() ?? '',
      'role': role.toUpperCase(),
      'status': active ? 'ACTIVE' : 'INACTIVE',
      'pinSet': normalizedPin == null || normalizedPin.isEmpty ? 0 : 1,
      'createdAt': now,
      'updatedAt': now,
    };

    await db.insert('local_employees', record, conflictAlgorithm: ConflictAlgorithm.replace);
    if (!synced) {
      await _syncService.queueChange(
        id: 'sync-$employeeId',
        entityName: 'Employee',
        operation: id == null ? 'CREATE' : 'UPDATE',
        payload: {...record},
      );
    }
    return {...record, 'synced': synced};
  }

  Future<void> syncPending({required String userId}) => _syncService.processCloudSync(
        businessId: 'demo-business',
        deviceId: 'mobile-device',
        userId: userId,
      );
}
