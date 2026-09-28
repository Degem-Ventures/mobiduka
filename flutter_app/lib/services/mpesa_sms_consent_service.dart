import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:permission_handler/permission_handler.dart';

/// Stores a merchant's explicit decision to enable on-device M-Pesa SMS
/// reconciliation. Permission is requested only after that decision.
class MpesaSmsConsentService {
  MpesaSmsConsentService({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static final ValueNotifier<int> changes = ValueNotifier<int>(0);
  static const _keyPrefix = 'mobiduka.mpesa_sms_reconciliation.';

  final FlutterSecureStorage _storage;

  Future<bool> isEnabled(String businessId) async {
    if (kIsWeb) return false;
    return await _storage.read(key: _key(businessId)) == 'true';
  }

  /// Returns false when Android SMS access is denied or unavailable.
  Future<bool> enable(String businessId) async {
    if (kIsWeb) return false;
    final permission = await Permission.sms.request();
    if (!permission.isGranted) return false;
    await _storage.write(key: _key(businessId), value: 'true');
    _notifyChanged();
    return true;
  }

  Future<void> disable(String businessId) async {
    if (kIsWeb) return;
    await _storage.delete(key: _key(businessId));
    _notifyChanged();
  }

  String _key(String businessId) => '$_keyPrefix$businessId';

  void _notifyChanged() => changes.value++;
}
