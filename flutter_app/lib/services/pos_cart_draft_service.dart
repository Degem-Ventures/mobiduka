import 'offline_snapshot_cache.dart';

/// Persists an unfinished POS sale independently of the widget lifecycle.
/// Drafts are scoped to the signed-in tenant and cashier so a restored session
/// never exposes one cashier's cart to another.
class PosCartDraftService {
  PosCartDraftService({OfflineSnapshotCache? cache})
      : _cache = cache ?? SecureOfflineSnapshotCache();

  static const _key = 'pos.cart_draft.v1';
  final OfflineSnapshotCache _cache;

  Future<void> save({
    required String businessId,
    required String userId,
    required Map<String, int> cart,
    required String paymentMethod,
    required int discount,
  }) =>
      _cache.writeJson(
        businessId: businessId,
        key: '$_key.$userId',
        value: {
          'cart': cart,
          'paymentMethod': paymentMethod,
          'discount': discount,
          'updatedAt': DateTime.now().toIso8601String(),
        },
      );

  Future<Map<String, dynamic>?> load({
    required String businessId,
    required String userId,
  }) async {
    final value = await _cache.readJson(
      businessId: businessId,
      key: '$_key.$userId',
    );
    return value is Map ? Map<String, dynamic>.from(value) : null;
  }

  Future<void> clear({required String businessId, required String userId}) =>
      save(
        businessId: businessId,
        userId: userId,
        cart: const {},
        paymentMethod: 'cash',
        discount: 0,
      );
}
