import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';

class MpesaService {
  MpesaService({String? baseUrl}) : baseUrl = baseUrl ?? '${ApiConfig.apiBase}/payments/stk-push';

  final String baseUrl;

  String get queryUrl => baseUrl.replaceFirst('/stk-push', '/stk-query');

  Future<Map<String, dynamic>> initiateStkPush({
    required String phoneNumber,
    required double amount,
    required String businessId,
    String? accountReference,
  }) async {
    try {
      final response = await http.post(
        Uri.parse(baseUrl),
        headers: const {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'phoneNumber': phoneNumber,
          'amount': amount,
          'businessId': businessId,
          'accountReference': accountReference ?? 'MobiDuka POS',
        }),
      );
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return {'success': false, 'message': data['error'] ?? 'M-Pesa gateway request failed.'};
      }

      final result = data['darajaResult'] as Map<String, dynamic>? ?? const {};
      return {
        'success': data['success'] == true && result['ResponseCode']?.toString() == '0',
        'merchantRequestId': result['MerchantRequestID'],
        'checkoutRequestId': result['CheckoutRequestID'],
        'message': result['ResponseDescription'] ?? 'STK Push sent. Awaiting customer PIN entry.',
      };
    } catch (_) {
      return {'success': false, 'message': 'Unable to reach the M-Pesa payment gateway.'};
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
        final response = await http.post(
          Uri.parse(queryUrl),
          headers: const {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
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
            return {'status': 'FAILED', 'message': data['message'] ?? 'M-Pesa payment failed.'};
          }
        }
      } catch (_) {
        // Keep polling through transient network failures until the timeout.
      }
    }

    return {
      'status': 'TIMEOUT',
      'message': 'Payment verification timed out. Please inspect the customer phone before retrying.',
    };
  }
}
