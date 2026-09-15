import 'package:sqflite/sqflite.dart';

import 'sync_service.dart';

class EmployeeRepository {
  EmployeeRepository({SyncService? syncService}) : _syncService = syncService ?? SyncService();

  final SyncService _syncService;

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
    await ensureSchema();
    final db = await _syncService.database;
    final now = DateTime.now().toIso8601String();
    final employeeId = id ?? 'employee-${DateTime.now().microsecondsSinceEpoch}';
    final record = <String, dynamic>{
      'id': employeeId,
      'businessId': businessId,
      'fullName': fullName.trim(),
      'email': email?.trim() ?? '',
      'phone': phone?.trim() ?? '',
      'role': role.toUpperCase(),
      'status': active ? 'ACTIVE' : 'INACTIVE',
      'pinSet': pin == null ? 0 : 1,
      'createdAt': now,
      'updatedAt': now,
    };

    await db.insert('local_employees', record, conflictAlgorithm: ConflictAlgorithm.replace);
    await _syncService.queueChange(
      id: 'sync-$employeeId',
      entityName: 'Employee',
      operation: id == null ? 'CREATE' : 'UPDATE',
      payload: {
        ...record,
      },
    );
    return record;
  }

  Future<void> syncPending({required String userId}) => _syncService.processCloudSync(
        businessId: 'demo-business',
        deviceId: 'mobile-device',
        userId: userId,
      );
}
