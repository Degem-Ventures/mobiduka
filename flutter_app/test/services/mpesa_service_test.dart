import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobiduka_pos/services/auth_service.dart';
import 'package:mobiduka_pos/services/mpesa_service.dart';

class FakeAuthService extends AuthService {
  FakeAuthService(this.session);

  final AuthSession? session;

  @override
  Future<AuthSession?> readSession() async => session;
}

class CapturingClient extends http.BaseClient {
  http.BaseRequest? request;
  String? body;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    this.request = request;
    body = await request.finalize().bytesToString();
    return http.StreamedResponse(
      Stream<List<int>>.value(utf8.encode(jsonEncode({
        'success': true,
        'darajaResult': {
          'ResponseCode': '0',
          'CheckoutRequestID': 'ws_CO_test',
          'MerchantRequestID': 'merchant_test',
        },
      }))),
      200,
      request: request,
    );
  }
}

void main() {
  test('sends authenticated normalized STK request', () async {
    final client = CapturingClient();
    final service = MpesaService(
      baseUrl: 'https://example.test/api/payments/stk-push',
      authService: FakeAuthService(const AuthSession(
        token: 'jwt-test-token',
        user: {'id': 'user-1', 'businessId': 'business-1'},
      )),
      client: client,
    );

    final result = await service.initiateStkPush(
      phoneNumber: '+254 712 345 678',
      amount: 150,
      businessId: 'business-1',
    );

    expect(result['success'], isTrue);
    expect(client.request?.headers['authorization'], 'Bearer jwt-test-token');
    final payload = jsonDecode(client.body!) as Map<String, dynamic>;
    expect(payload['phoneNumber'], '254712345678');
    expect(payload['businessId'], 'business-1');
    expect(payload['amount'], 150);
  });

  test('rejects a business session mismatch before network dispatch', () async {
    final client = CapturingClient();
    final service = MpesaService(
      authService: FakeAuthService(const AuthSession(
        token: 'jwt-test-token',
        user: {'id': 'user-1', 'businessId': 'business-1'},
      )),
      client: client,
    );

    final result = await service.initiateStkPush(
      phoneNumber: '0712345678',
      amount: 150,
      businessId: 'business-2',
    );

    expect(result['success'], isFalse);
    expect(client.request, isNull);
  });
}
