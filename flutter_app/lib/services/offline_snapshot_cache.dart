import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Small cross-platform snapshot store for read models. On web,
/// flutter_secure_storage is backed by browser storage; on native it uses the
/// platform secure store. Mutations still use the durable sync outbox.
abstract class OfflineSnapshotCache {
  Future<void> writeJson({
    required String businessId,
    required String key,
    required Object value,
  });

  Future<Object?> readJson({
    required String businessId,
    required String key,
  });
}

class SecureOfflineSnapshotCache implements OfflineSnapshotCache {
  SecureOfflineSnapshotCache({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  String _storageKey(String businessId, String key) {
    final encoded = base64UrlEncode(utf8.encode('$businessId:$key'));
    return 'mobiduka.snapshot.$encoded';
  }

  @override
  Future<void> writeJson({
    required String businessId,
    required String key,
    required Object value,
  }) {
    return _storage.write(
      key: _storageKey(businessId, key),
      value: jsonEncode(value),
    );
  }

  @override
  Future<Object?> readJson({
    required String businessId,
    required String key,
  }) async {
    final value = await _storage.read(key: _storageKey(businessId, key));
    if (value == null || value.isEmpty) return null;
    try {
      return jsonDecode(value);
    } on FormatException {
      return null;
    }
  }
}
