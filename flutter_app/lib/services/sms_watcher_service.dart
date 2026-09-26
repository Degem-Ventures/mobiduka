import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_sms_inbox/flutter_sms_inbox.dart';
import 'package:permission_handler/permission_handler.dart';

class SmsWatcherService {
  final SmsQuery _query = SmsQuery();
  Timer? _smsTimer;
  Timer? _timeoutTimer;
  Timer? _ingestionTimer;
  Completer<String?>? _completion;

  Future<String?> startSmsIncomingWatcher({
    required double targetAmount,
    required String customerPhone,
    required void Function(String mpesaCode) onPaymentVerified,
    Duration interval = const Duration(seconds: 4),
    Duration timeout = const Duration(seconds: 60),
  }) {
    stopSmsWatcher();
    final completion = Completer<String?>();
    _completion = completion;
    final phoneDigits = customerPhone
        .replaceAll(RegExp(r'\D'), '')
        .replaceFirst(RegExp(r'^254'), '');
    final expectedAmount = targetAmount.toStringAsFixed(0);

    Future<void> checkInbox(Timer timer) async {
      try {
        final messages =
            await _query.querySms(kinds: [SmsQueryKind.inbox], count: 10);
        for (final sms in messages) {
          final body = sms.body ?? '';
          final sender = (sms.sender ?? '').toUpperCase();
          if (!sender.contains('MPESA')) continue;

          final amountMatches =
              RegExp(r'KES\s*([0-9,]+(?:\.\d{1,2})?)', caseSensitive: false)
                  .allMatches(body)
                  .any((match) =>
                      match.group(1)?.replaceAll(',', '').split('.').first ==
                      expectedAmount);
          final customerMatches = phoneDigits.isEmpty ||
              body.replaceAll(RegExp(r'\D'), '').contains(phoneDigits);
          if (!amountMatches || !customerMatches) continue;

          final code = RegExp(r'\b[A-Z0-9]{10}\b').firstMatch(body)?.group(0) ??
              'SMS_VERIFIED';
          onPaymentVerified(code);
          _finish(code);
          return;
        }
      } catch (error) {
        debugPrint('SMS permission or inbox read error: $error');
      }
    }

    _smsTimer = Timer.periodic(interval, checkInbox);
    _timeoutTimer = Timer(timeout, () => _finish(null));
    checkInbox(_smsTimer!);
    return completion.future;
  }

  void _finish(String? code) {
    _smsTimer?.cancel();
    _timeoutTimer?.cancel();
    _smsTimer = null;
    _timeoutTimer = null;
    if (!(_completion?.isCompleted ?? true)) {
      _completion!.complete(code);
    }
    _completion = null;
  }

  void stopSmsWatcher() {
    _smsTimer?.cancel();
    _timeoutTimer?.cancel();
    _smsTimer = null;
    _timeoutTimer = null;
    if (!(_completion?.isCompleted ?? true)) {
      _completion!.complete(null);
    }
    _completion = null;
  }

  /// Polls recent M-Pesa messages while the app process is alive. Android
  /// inbox access is permission-gated; this is intentionally not presented as
  /// an OS background SMS receiver.
  Future<void> startMpesaInboxIngestion({
    required Future<void> Function(String message) onMpesaMessage,
    Duration interval = const Duration(seconds: 20),
  }) async {
    _ingestionTimer?.cancel();
    final permission = await Permission.sms.request();
    if (!permission.isGranted) {
      debugPrint(
          'SMS permission was not granted; M-Pesa inbox ingestion is unavailable.');
      return;
    }
    Future<void> scan() async {
      try {
        final messages = await _query.querySms(
          kinds: [SmsQueryKind.inbox],
          count: 30,
        );
        for (final sms in messages) {
          final sender = (sms.sender ?? '').toUpperCase();
          final body = sms.body ?? '';
          if (sender.contains('MPESA') ||
              body.toUpperCase().contains('CONFIRMED.')) {
            await onMpesaMessage(body);
          }
        }
      } catch (error) {
        debugPrint('SMS permission or inbox ingestion error: $error');
      }
    }

    _ingestionTimer = Timer.periodic(interval, (_) => scan());
    await scan();
  }

  void stopMpesaInboxIngestion() {
    _ingestionTimer?.cancel();
    _ingestionTimer = null;
  }
}
