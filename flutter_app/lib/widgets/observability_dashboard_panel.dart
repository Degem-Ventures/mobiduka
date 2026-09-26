import 'package:flutter/material.dart';

import '../services/observability_dashboard_service.dart';

class ObservabilityDashboardPanel extends StatefulWidget {
  const ObservabilityDashboardPanel({
    super.key,
    required this.businessId,
    this.service,
  });

  final String businessId;
  final ObservabilityDashboardService? service;

  @override
  State<ObservabilityDashboardPanel> createState() =>
      _ObservabilityDashboardPanelState();
}

class _ObservabilityDashboardPanelState
    extends State<ObservabilityDashboardPanel> {
  late final ObservabilityDashboardService _service =
      widget.service ?? ObservabilityDashboardService();
  late final bool _ownsService = widget.service == null;

  @override
  void initState() {
    super.initState();
    _service.start(widget.businessId);
  }

  @override
  void dispose() {
    if (_ownsService) _service.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => StreamBuilder<StoreFinancialSnapshot>(
        stream: _service.snapshots,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const SizedBox(
                height: 80, child: Center(child: CircularProgressIndicator()));
          }
          final data = snapshot.data!;
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Offline operations',
                        style: TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 17)),
                    const SizedBox(height: 12),
                    Wrap(spacing: 16, runSpacing: 12, children: [
                      _metric('Drawer cash', data.cashInDrawer),
                      _metric('Pending sales', data.pendingSales),
                      _metric('Pending expenses', data.pendingExpenses),
                      _metric('Credit outstanding', data.outstandingDebt),
                    ]),
                    const SizedBox(height: 12),
                    Text(
                        '${data.pendingEvents} sync event${data.pendingEvents == 1 ? '' : 's'} pending'
                        '${data.mpesaReceiptsAwaitingReview == 0 ? '' : ' • ${data.mpesaReceiptsAwaitingReview} M-Pesa receipt(s) need review'}'),
                  ]),
            ),
          );
        },
      );

  Widget _metric(String label, double value) => SizedBox(
        width: 135,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              style: const TextStyle(color: Colors.black54, fontSize: 12)),
          Text('KSh ${value.toStringAsFixed(0)}',
              style: const TextStyle(fontWeight: FontWeight.w700)),
        ]),
      );
}
