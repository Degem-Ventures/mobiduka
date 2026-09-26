import 'package:flutter_test/flutter_test.dart';
import 'package:mobiduka_pos/services/offline_snapshot_cache.dart';
import 'package:mobiduka_pos/services/pos_cart_draft_service.dart';

class MemorySnapshotCache implements OfflineSnapshotCache {
  final values = <String, Object>{};

  String _id(String businessId, String key) => '$businessId:$key';

  @override
  Future<Object?> readJson(
          {required String businessId, required String key}) async =>
      values[_id(businessId, key)];

  @override
  Future<void> writeJson({
    required String businessId,
    required String key,
    required Object value,
  }) async {
    values[_id(businessId, key)] = value;
  }
}

void main() {
  test('persists an unfinished cart per cashier and clears it after checkout',
      () async {
    final service = PosCartDraftService(cache: MemorySnapshotCache());
    await service.save(
      businessId: 'business-1',
      userId: 'cashier-a',
      cart: {'Unga': 2, 'Milk': 1},
      paymentMethod: 'cash',
      discount: 5,
    );

    final restored =
        await service.load(businessId: 'business-1', userId: 'cashier-a');
    expect(restored?['cart'], {'Unga': 2, 'Milk': 1});
    expect(restored?['discount'], 5);
    expect(await service.load(businessId: 'business-1', userId: 'cashier-b'),
        isNull);

    await service.clear(businessId: 'business-1', userId: 'cashier-a');
    expect(
        (await service.load(
            businessId: 'business-1', userId: 'cashier-a'))?['cart'],
        isEmpty);
  });
}
