import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';

class MpesaService {
  MpesaService({String? baseUrl, AuthService? authService, http.Client? client})
      : baseUrl = baseUrl ?? '${ApiConfig.apiBase}/payments/stk-push',
        _authService = authService ?? AuthService(),
        _client = client ?? http.Client();

  final String baseUrl;
  final AuthService _authService;
  final http.Client _client;

  String get queryUrl => baseUrl.replaceFirst('/stk-push', '/stk-query');

  Future<Map<String, dynamic>> initiateStkPush({
    required String phoneNumber,
    required double amount,
    required String businessId,
    String? accountReference,
  }) async {
    try {
      final session = await _authService.readSession();
      final sessionBusinessId = session?.user['businessId']?.toString().trim();
      if (session == null || session.token.trim().isEmpty) {
        return {
          'success': false,
          'message': 'Please sign in again before starting an M-Pesa payment.'
        };
      }
      if (sessionBusinessId == null || sessionBusinessId != businessId.trim()) {
        return {
          'success': false,
          'message': 'Your active business session does not match this cart.'
        };
      }
      final normalizedPhone = _normalizePhone(phoneNumber);
      if (normalizedPhone == null || !amount.isFinite || amount <= 0) {
        return {
          'success': false,
          'message': 'Enter a valid Kenyan phone number and a positive amount.'
        };
      }

      final response = await _client.post(
        Uri.parse(baseUrl),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer ${session.token}',
        },
        body: jsonEncode({
          'phoneNumber': normalizedPhone,
          'amount': amount,
          'businessId': sessionBusinessId,
          'accountReference': accountReference ?? 'MobiDuka POS',
        }),
      );
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final darajaResult =
            data['darajaResult'] as Map<String, dynamic>? ?? const {};
        return {
          'success': false,
          'message': data['error'] ??
              darajaResult['errorMessage'] ??
              darajaResult['ResponseDescription'] ??
              'M-Pesa gateway request failed.',
        };
      }

      final result = data['darajaResult'] as Map<String, dynamic>? ?? const {};
      return {
        'success': data['success'] == true &&
            result['ResponseCode']?.toString() == '0',
        'merchantRequestId': result['MerchantRequestID'],
        'checkoutRequestId': result['CheckoutRequestID'],
        'message': result['ResponseDescription'] ??
            'STK Push sent. Awaiting customer PIN entry.',
      };
    } catch (_) {
      return {
        'success': false,
        'message': 'Unable to reach the M-Pesa payment gateway.'
      };
    }
  }

  Future<Map<String, dynamic>> pollTransactionStatus({
    required String checkoutRequestId,
    int maxAttempts = 20,
    Duration interval = const Duration(seconds: 3),
  }) async {
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      await Future.delayed(interval);

      try {
        final session = await _authService.readSession();
        if (session == null || session.token.trim().isEmpty) {
          return {
            'status': 'FAILED',
            'message': 'Your session expired. Please sign in again.'
          };
        }
        final response = await _client.post(
          Uri.parse(queryUrl),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ${session.token}',
          },
          body: jsonEncode({'checkoutRequestId': checkoutRequestId}),
        );
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        if (response.statusCode == 200) {
          final status = data['status']?.toString() ?? 'PENDING';
          if (status == 'SUCCESS') {
            return {
              'status': 'SUCCESS',
              'receipt': data['receipt'],
              'message': data['message'] ?? 'Payment verified successfully.',
            };
          }
          if (status == 'FAILED' || status == 'CANCELLED') {
            return {
              'status': 'FAILED',
              'message': data['message'] ?? 'M-Pesa payment failed.'
            };
          }
        }
      } catch (_) {
        // Keep polling through transient network failures until the timeout.
      }
    }

    return {
      'status': 'TIMEOUT',
      'message':
          'Payment verification timed out. Please inspect the customer phone before retrying.',
    };
  }

  String? _normalizePhone(String value) {
    var phone =
        value.trim().replaceAll(RegExp(r'\s+'), '').replaceFirst('+', '');
    if (phone.startsWith('0')) phone = '254${phone.substring(1)}';
    if (!phone.startsWith('254') && RegExp(r'^(?:7|1)\d{8}$').hasMatch(phone)) {
      phone = '254$phone';
    }
    return RegExp(r'^254(?:7|1)\d{8}$').hasMatch(phone) ? phone : null;
  }
}
