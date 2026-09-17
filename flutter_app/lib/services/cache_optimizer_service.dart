import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';

import 'sync_service.dart';

class CacheOptimizerService {
  CacheOptimizerService({SyncService? syncService}) : _syncService = syncService ?? SyncService();

  final SyncService _syncService;

  Future<Map<String, dynamic>> optimizeLocalDatabaseCache() async {
    if (kIsWeb) return {'success': true, 'purged': 0, 'skipped': true};

    try {
      final db = await _syncService.database;
      final cutoff = DateTime.now().subtract(const Duration(days: 30)).toIso8601String();
      final purged = <String, int>{};

      await db.transaction((transaction) async {
        final tables = await transaction.rawQuery(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        );
        for (final tableRow in tables) {
          final tableName = tableRow['name'];
          if (tableName is! String || !_isSafeIdentifier(tableName)) continue;

          final columns = await transaction.rawQuery('PRAGMA table_info("$tableName")');
          final names = columns.map((column) => column['name']).whereType<String>().toSet();
          final timestampColumn = names.contains('createdAt')
              ? 'createdAt'
              : names.contains('updatedAt')
                  ? 'updatedAt'
                  : null;
          if (!names.contains('isSynced') || timestampColumn == null) continue;

          final deleted = await transaction.delete(
            tableName,
            where: 'isSynced = ? AND "$timestampColumn" < ?',
            whereArgs: [1, cutoff],
          );
          if (deleted > 0) purged[tableName] = deleted;
        }
      });

      // SQLite VACUUM cannot run inside a transaction.
      await db.execute('VACUUM');
      final total = purged.values.fold<int>(0, (sum, count) => sum + count);
      debugPrint('Cache optimization complete: purged $total synced records.');
      return {'success': true, 'purged': total, 'tables': purged};
    } on Object catch (error) {
      debugPrint('Cache optimization failed: $error');
      return {'success': false, 'purged': 0, 'error': error.toString()};
    }
  }

  bool _isSafeIdentifier(String value) => RegExp(r'^[A-Za-z_][A-Za-z0-9_]*$').hasMatch(value);
}
