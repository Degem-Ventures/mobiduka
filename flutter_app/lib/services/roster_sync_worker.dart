import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'sync_service.dart';

class RosterSyncWorker {
  RosterSyncWorker({http.Client? client, SyncService? syncService})
      : _client = client ?? http.Client(),
        _syncService = syncService ?? SyncService();

  final http.Client _client;
  final SyncService _syncService;

  Future<Map<String, dynamic>> synchronizeStoreRoster({
    required String businessId,
    required String jwtToken,
  }) async {
    if (kIsWeb || businessId.trim().isEmpty || jwtToken.trim().isEmpty) {
      return {'success': false, 'count': 0, 'error': 'Roster sync requires a native device session.'};
    }

    try {
      final uri = Uri.parse('${ApiConfig.apiBase}/employees').replace(
        queryParameters: {'businessId': businessId, 'includePinHashes': 'true'},
      );
      final response = await _client.get(uri, headers: {
        'Authorization': 'Bearer $jwtToken',
        'X-Business-Id': businessId,
      });
      if (response.statusCode != 200) {
        return {'success': false, 'count': 0, 'error': 'Roster request failed with HTTP ${response.statusCode}.'};
      }

      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic> || decoded['success'] != true || decoded['employees'] is! List) {
        return {'success': false, 'count': 0, 'error': 'Roster response was invalid.'};
      }

      final employees = (decoded['employees'] as List).whereType<Map<String, dynamic>>().toList();
      final cachedCount = await _cacheRoster(employees, businessId);
      debugPrint('Secure offline roster updated: $cachedCount employees.');
      return {'success': true, 'count': cachedCount};
    } on Object catch (error) {
      debugPrint('Roster synchronization skipped: $error');
      return {'success': false, 'count': 0, 'error': 'Network unavailable; existing roster cache retained.'};
    }
  }

  Future<int> _cacheRoster(List<Map<String, dynamic>> employees, String businessId) async {
    final db = await _syncService.database;
    var count = 0;
    await db.transaction((transaction) async {
      await transaction.delete('local_auth_roster', where: 'businessId = ?', whereArgs: [businessId]);
      for (final employee in employees) {
        final id = employee['id'];
        final fullName = employee['fullName'];
        final pinHash = employee['pinHash'];
        final status = employee['status'];
        if (id is! String || fullName is! String || pinHash is! String || pinHash.isEmpty || status != 'ACTIVE') continue;

        await transaction.insert('local_auth_roster', {
          'id': id,
          'businessId': businessId,
          'fullName': fullName,
          'role': employee['role']?.toString() ?? 'CASHIER',
          'pinHash': pinHash,
          'status': status,
          'updatedAt': DateTime.now().toIso8601String(),
        });
        count++;
      }
    });
    return count;
  }
}
