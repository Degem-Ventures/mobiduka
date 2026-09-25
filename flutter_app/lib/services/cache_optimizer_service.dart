import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';

import 'sync_service.dart';

class CacheOptimizerService {
  CacheOptimizerService({SyncService? syncService}) : _syncService = syncService ?? SyncService();

  final SyncService _syncService;

  static const Set<String> _approvedSyncTables = {
    'sync_queue',
  };

  Future<Map<String, dynamic>> optimizeLocalDatabaseCache() async {
    if (kIsWeb) return {'success': true, 'purged': 0, 'skipped': true};

    try {
      final db = await _syncService.database;
      final retentionHorizon = DateTime.now().subtract(const Duration(days: 30)).toIso8601String();
      final purged = <String, int>{};

      final tables = await db.rawQuery("SELECT name FROM sqlite_master WHERE type='table'");
      for (final tableRow in tables) {
        final tableName = tableRow['name'];
        if (tableName is! String || !_approvedSyncTables.contains(tableName)) continue;

        final deleted = await db.transaction((txn) async {
          return txn.delete(
            tableName,
            where: "isSynced = 1 AND status = 'ACKED' AND createdAt < ? AND nextRetryAt IS NULL",
            whereArgs: [retentionHorizon],
          );
        });

        if (deleted > 0) purged[tableName] = deleted;
      }

      await isolatedMaintenanceVacuum(db);
      final total = purged.values.fold<int>(0, (sum, count) => sum + count);
      debugPrint('Cache optimization complete: purged $total synced records.');
      return {'success': true, 'purged': total, 'tables': purged};
    } on Object catch (error) {
      debugPrint('Cache optimization failed: $error');
      return {'success': false, 'purged': 0, 'error': error.toString()};
    }
  }

  Future<void> pruneAcknowledgedRecords(Database db) async {
    final tables = await db.rawQuery("SELECT name FROM sqlite_master WHERE type='table'");
    final retentionHorizon = DateTime.now().subtract(const Duration(days: 30)).toIso8601String();

    for (final row in tables) {
      final tableName = row['name'];
      if (tableName is! String || !_approvedSyncTables.contains(tableName)) continue;

      await db.transaction((txn) async {
        await txn.delete(
          tableName,
          where: "isSynced = 1 AND status = 'ACKED' AND createdAt < ? AND nextRetryAt IS NULL",
          whereArgs: [retentionHorizon],
        );
      });
    }
  }

  Future<void> isolatedMaintenanceVacuum(Database db) async {
    try {
      await db.execute('PRAGMA optimize;');
      await db.execute('VACUUM;');
    } catch (error) {
      debugPrint('Database compression cycle deferred due to active transactional blocks: $error');
    }
  }
}
