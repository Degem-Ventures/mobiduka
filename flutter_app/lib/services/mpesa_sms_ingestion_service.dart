import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';

import 'customer_repository.dart';
import 'sync_service.dart';

class MpesaSmsIngestionResult {
  const MpesaSmsIngestionResult({
    required this.receiptCode,
    required this.amount,
    required this.wasNew,
    required this.wasMatched,
  });

  final String receiptCode;
  final double amount;
  final bool wasNew;
  final bool wasMatched;
}

/// Stores and reconciles direct Till/Paybill confirmation SMS messages.
///
/// A parsed SMS is evidence of payment, not proof of which invoice it belongs
/// to. Automatic credit repayment is deliberately limited to a single local
/// debtor with the payer's phone number; every other receipt remains queued
/// for review rather than being assigned by amount alone.
class MpesaSmsIngestionService {
  MpesaSmsIngestionService({
    SyncService? syncService,
    CustomerRepository? customerRepository,
  })  : _syncService = syncService ?? SyncService(),
        _customerRepository =
            customerRepository ?? CustomerRepository(syncService: syncService);

  final SyncService _syncService;
  final CustomerRepository _customerRepository;

  Future<MpesaSmsIngestionResult?> ingestRawMessage({
    required String businessId,
    required String userId,
    required String message,
  }) async {
    final parsed = _parse(message);
    if (parsed == null) return null;
    return ingestConfirmation(
      businessId: businessId,
      userId: userId,
      receiptCode: parsed.receiptCode,
      amount: parsed.amount,
      senderPhone: parsed.senderPhone,
      customerName: parsed.customerName,
      rawMessage: message,
    );
  }

  Future<MpesaSmsIngestionResult> ingestConfirmation({
    required String businessId,
    required String userId,
    required String receiptCode,
    required double amount,
    String senderPhone = '',
    String customerName = '',
    String? rawMessage,
  }) async {
    if (amount <= 0 || !amount.isFinite) {
      throw ArgumentError.value(amount, 'amount', 'must be positive');
    }
    final normalizedReceipt = receiptCode.trim().toUpperCase();
    if (!RegExp(r'^[A-Z0-9]{10}$').hasMatch(normalizedReceipt)) {
      throw ArgumentError.value(
          receiptCode, 'receiptCode', 'must be an M-Pesa receipt code');
    }

    await _customerRepository.ensureCustomerSchema();
    final db = await _syncService.database;
    final existing = await db.query(
      'mpesa_sms_cache',
      where: 'receiptCode = ? AND businessId = ?',
      whereArgs: [normalizedReceipt, businessId],
      limit: 1,
    );
    if (existing.isNotEmpty) {
      final row = existing.single;
      await _queueReceipt(row);
      return MpesaSmsIngestionResult(
        receiptCode: normalizedReceipt,
        amount: _number(row['amount']),
        wasNew: false,
        wasMatched: row['isMatched'] == 1,
      );
    }

    final timestamp = DateTime.now().toIso8601String();
    await db.insert(
        'mpesa_sms_cache',
        {
          'receiptCode': normalizedReceipt,
          'businessId': businessId,
          'senderPhone': senderPhone,
          'customerName': customerName,
          'amount': amount,
          'isMatched': 0,
          'isPendingSync': 1,
          'rawMessage': rawMessage,
          'createdAt': timestamp,
        },
        conflictAlgorithm: ConflictAlgorithm.ignore);

    String? customerId;
    if (senderPhone.isNotEmpty) {
      final customer =
          await _customerRepository.findUnambiguousLocalDebtorByPhone(
        businessId: businessId,
        phone: senderPhone,
      );
      if (customer != null && amount <= _number(customer['currentDebt'])) {
        customerId = customer['id']?.toString();
        if (customerId != null && customerId.isNotEmpty) {
          final payment = await _customerRepository.recordLocalCredit(
            businessId: businessId,
            customerId: customerId,
            amount: amount,
            isPayment: true,
            paymentMethod: 'MPESA',
            userId: userId,
          );
          if (payment == null) customerId = null;
        }
      }
    }

    if (customerId != null) {
      await db.update(
          'mpesa_sms_cache',
          {
            'customerId': customerId,
            'isMatched': 1,
          },
          where: 'receiptCode = ? AND businessId = ?',
          whereArgs: [normalizedReceipt, businessId]);
    }
    final receipt = (await db.query('mpesa_sms_cache',
            where: 'receiptCode = ? AND businessId = ?',
            whereArgs: [normalizedReceipt, businessId],
            limit: 1))
        .single;
    await _queueReceipt(receipt);
    debugPrint(
        'Recorded M-Pesa SMS $normalizedReceipt (matched: ${customerId != null}).');
    return MpesaSmsIngestionResult(
      receiptCode: normalizedReceipt,
      amount: amount,
      wasNew: true,
      wasMatched: customerId != null,
    );
  }

  Future<void> _queueReceipt(Map<String, Object?> row) =>
      _syncService.queueChange(
        id: 'mpesa-sms-${row['businessId']}-${row['receiptCode']}',
        entityName: 'MpesaSmsReceipt',
        operation: 'CREATE',
        payload: {
          'id': row['receiptCode'],
          'businessId': row['businessId'],
          'receiptCode': row['receiptCode'],
          'senderPhone': row['senderPhone'],
          'customerName': row['customerName'],
          'amount': row['amount'],
          'customerId': row['customerId'],
          'isMatched': row['isMatched'] == 1,
          'createdAt': row['createdAt'],
        },
      );

  _ParsedMpesa? _parse(String text) {
    final confirmation =
        RegExp(r'\b([A-Z0-9]{10})\s+confirmed\.', caseSensitive: false)
            .firstMatch(text);
    final amount =
        RegExp(r'\b(?:ksh|kes)\s*([0-9,]+(?:\.\d{1,2})?)', caseSensitive: false)
            .firstMatch(text);
    if (confirmation == null || amount == null) return null;
    final parsedAmount = double.tryParse(amount.group(1)!.replaceAll(',', ''));
    if (parsedAmount == null || parsedAmount <= 0) return null;
    final phone =
        RegExp(r'(?:\+?254|0)[17]\d{8}').firstMatch(text)?.group(0) ?? '';
    final name = RegExp(
                r'\b(?:from|by)\s+(.+?)(?=\s+(?:\+?254|0)[17]\d{8}|\s+on\b|$)',
                caseSensitive: false)
            .firstMatch(text)
            ?.group(1)
            ?.trim() ??
        '';
    return _ParsedMpesa(
      receiptCode: confirmation.group(1)!.toUpperCase(),
      amount: parsedAmount,
      senderPhone: phone,
      customerName: name,
    );
  }

  static double _number(Object? value) => value is num
      ? value.toDouble()
      : double.tryParse(value?.toString() ?? '') ?? 0;
}

class _ParsedMpesa {
  const _ParsedMpesa({
    required this.receiptCode,
    required this.amount,
    required this.senderPhone,
    required this.customerName,
  });

  final String receiptCode;
  final double amount;
  final String senderPhone;
  final String customerName;
}
