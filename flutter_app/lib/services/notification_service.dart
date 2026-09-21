import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_service.dart';

class RemoteNotification {
  const RemoteNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    required this.read,
    required this.icon,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool read;
  final String icon;

  factory RemoteNotification.fromJson(Map<String, dynamic> json) {
    return RemoteNotification(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? 'info',
      title: json['title']?.toString() ?? 'Notification',
      body: json['body']?.toString() ?? '',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      read: json['read'] == true,
      icon: json['icon']?.toString() ?? '📦',
    );
  }
}

class NotificationService {
  NotificationService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<List<RemoteNotification>> fetch(AuthSession session) async {
    final response = await _client.get(
      Uri.parse('${ApiConfig.apiBase}/notifications?businessId=${Uri.encodeQueryComponent(session.user['businessId']?.toString() ?? '')}'),
      headers: {'Authorization': 'Bearer ${session.token}'},
    );
    final payload = _decode(response);
    final records = payload['notifications'];
    if (records is! List) return const [];
    return records.whereType<Map<String, dynamic>>().map(RemoteNotification.fromJson).toList();
  }

  Future<void> markRead(AuthSession session, {String? id, bool all = false}) async {
    final body = all ? {'markAllAsRead': true} : {'notificationId': id};
    final response = await _client.patch(
      Uri.parse('${ApiConfig.apiBase}/notifications'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ${session.token}'},
      body: jsonEncode(body),
    );
    _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final payload = jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(payload is Map<String, dynamic> ? payload['error'] ?? 'Notification request failed.' : 'Notification request failed.');
    }
    return payload is Map<String, dynamic> ? payload : <String, dynamic>{};
  }
}
