import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
    debugPrint('Background notification received: ${message.messageId}');
  } on Object catch (error) {
    debugPrint('Firebase background initialization failed: $error');
  }
}

class NotificationReceiverService {
  NotificationReceiverService({FirebaseMessaging? messaging, FlutterLocalNotificationsPlugin? localNotifications})
    : _messaging = kIsWeb ? null : (messaging ?? FirebaseMessaging.instance),
      _localNotifications = kIsWeb ? null : (localNotifications ?? FlutterLocalNotificationsPlugin());

    final FirebaseMessaging? _messaging;
    final FlutterLocalNotificationsPlugin? _localNotifications;
  bool _initialized = false;
  String? _subscribedBusinessId;

  Future<void> initializeNotificationEngine(BuildContext context) async {
    if (_initialized) return;
    if (!context.mounted) return;
    if (kIsWeb) {
      debugPrint('Firebase notifications are disabled for the web preview.');
      return;
    }

    try {
      await Firebase.initializeApp();
      final messaging = _messaging;
      final localNotifications = _localNotifications;
      if (messaging == null || localNotifications == null) return;
      await messaging.requestPermission(alert: true, badge: true, sound: true);

      const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosSettings = DarwinInitializationSettings();
      const settings = InitializationSettings(android: androidSettings, iOS: iosSettings);
      await localNotifications.initialize(
        settings,
        onDidReceiveNotificationResponse: (response) => debugPrint('Notification tapped: ${response.payload}'),
      );

      const channel = AndroidNotificationChannel(
        'mobiduka_alerts_id',
        'MobiDuka Business Alerts',
        description: 'Shift and expense alerts for this store.',
        importance: Importance.max,
      );
      await localNotifications.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(channel);

      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
      _initialized = true;
    } on Object catch (error) {
      debugPrint('Firebase notification initialization skipped: $error');
    }
  }

  Future<void> subscribeToTenantAlerts(String businessId) async {
    if (kIsWeb || !_initialized || businessId.isEmpty || _subscribedBusinessId == businessId) return;
    try {
      await _messaging!.subscribeToTopic('business_shifts_$businessId');
      await _messaging!.subscribeToTopic('business_expenses_$businessId');
      _subscribedBusinessId = businessId;
    } on Object catch (error) {
      debugPrint('Firebase topic subscription failed: $error');
    }
  }

  Future<void> unsubscribeFromTenantAlerts(String businessId) async {
    if (kIsWeb || !_initialized || businessId.isEmpty) return;
    try {
      await _messaging!.unsubscribeFromTopic('business_shifts_$businessId');
      await _messaging!.unsubscribeFromTopic('business_expenses_$businessId');
      if (_subscribedBusinessId == businessId) _subscribedBusinessId = null;
    } on Object catch (error) {
      debugPrint('Firebase topic unsubscribe failed: $error');
    }
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    final localNotifications = _localNotifications;
    if (localNotifications == null) return;
    final notification = message.notification;
    await localNotifications.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      notification?.title ?? 'MobiDuka System Update',
      notification?.body ?? 'A store transaction update was received.',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'mobiduka_alerts_id',
          'MobiDuka Business Alerts',
          channelDescription: 'Shift and expense alerts for this store.',
          importance: Importance.max,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(presentAlert: true, presentSound: true, presentBadge: true),
      ),
      payload: jsonEncode(message.data),
    );
  }
}
