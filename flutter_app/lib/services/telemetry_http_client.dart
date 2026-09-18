import 'dart:async';

import 'package:http/http.dart' as http;
import 'package:sentry_flutter/sentry_flutter.dart';

class TelemetryHttpClient extends http.BaseClient {
  TelemetryHttpClient(this._innerClient, {required this.businessId});

  final http.Client _innerClient;
  final String businessId;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final stopwatch = Stopwatch()..start();
    request.headers['X-Tenant-Id'] = businessId;

    try {
      final response = await _innerClient.send(request).timeout(
        const Duration(seconds: 15),
      );
      stopwatch.stop();

      if (response.statusCode == 408 || response.statusCode == 504) {
        await _capture(
          Exception('HTTP ${response.statusCode} network timeout'),
          StackTrace.current,
          request,
          stopwatch,
          level: SentryLevel.warning,
          telemetryType: 'http_timeout_response',
          statusCode: response.statusCode,
        );
      }

      return response;
    } on TimeoutException catch (error, stackTrace) {
      stopwatch.stop();
      await _capture(
        error,
        stackTrace,
        request,
        stopwatch,
        level: SentryLevel.error,
        telemetryType: 'network_timeout',
      );
      rethrow;
    } catch (error, stackTrace) {
      stopwatch.stop();
      await _capture(
        error,
        stackTrace,
        request,
        stopwatch,
        level: SentryLevel.warning,
        telemetryType: 'network_exception',
      );
      rethrow;
    }
  }

  Future<void> _capture(
    Object error,
    StackTrace stackTrace,
    http.BaseRequest request,
    Stopwatch stopwatch, {
    required SentryLevel level,
    required String telemetryType,
    int? statusCode,
  }) async {
    await Sentry.captureException(
      error,
      stackTrace: stackTrace,
      withScope: (scope) {
        scope.level = level;
        scope.setTag('telemetry.type', telemetryType);
        scope.setTag('tenant.id', businessId);
        scope.setTag('http.method', request.method);
        if (statusCode != null) {
          scope.setTag('http.status_code', statusCode.toString());
        }
        scope.setExtra('http.url', request.url.toString());
        scope.setExtra('latency_duration_ms', stopwatch.elapsedMilliseconds);
      },
    );
  }
}