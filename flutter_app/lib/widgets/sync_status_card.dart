import 'package:flutter/material.dart';

import '../services/sync_scheduler.dart';

class SyncStatusCard extends StatelessWidget {
  const SyncStatusCard({
    super.key,
    required this.scheduler,
  });

  final SyncScheduler scheduler;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<SyncStatusUpdate>(
      stream: scheduler.statusStream,
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SizedBox.shrink();

        final update = snapshot.data!;
        final hasChanges = update.pendingCount > 0 || update.inFlightCount > 0;
        if (!hasChanges &&
            update.lastErrorMessage == null &&
            update.schedulerState == SyncSchedulerState.idle) {
          return const SizedBox.shrink();
        }

        final textColor = _textColor(update);
        return AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: _backgroundColor(update),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _borderColor(update)),
          ),
          child: Row(
            children: [
              _StatusIcon(update: update),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _headline(update),
                      style: TextStyle(
                          fontWeight: FontWeight.w700, color: textColor),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _description(update),
                      style: TextStyle(
                          color: textColor.withValues(alpha: 0.82),
                          fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (update.schedulerState == SyncSchedulerState.idle &&
                  update.pendingCount > 0)
                IconButton(
                  onPressed: scheduler.triggerSyncCycle,
                  tooltip: 'Sync now',
                  icon: Icon(Icons.refresh, color: textColor),
                ),
            ],
          ),
        );
      },
    );
  }

  static String _headline(SyncStatusUpdate update) {
    if (update.schedulerState == SyncSchedulerState.pausedNoNetwork) {
      return 'Sync paused - offline mode';
    }
    if (update.schedulerState == SyncSchedulerState.synchronizing) {
      return 'Synchronizing changes';
    }
    if (update.lastErrorMessage != null) {
      return 'Sync needs attention';
    }
    return 'Local changes saved offline';
  }

  static String _description(SyncStatusUpdate update) {
    final parts = <String>[];
    if (update.inFlightCount > 0) {
      parts.add('Uploading ${update.inFlightCount} items.');
    }
    if (update.pendingCount > 0) {
      parts.add('${update.pendingCount} changes remain in the local queue.');
    } else if (update.inFlightCount == 0) {
      parts.add('All changes are synchronized with the cloud.');
    }
    return parts.join(' ');
  }

  static Color _backgroundColor(SyncStatusUpdate update) {
    if (update.schedulerState == SyncSchedulerState.pausedNoNetwork) {
      return const Color(0xFFFFE8E8);
    }
    if (update.lastErrorMessage != null && update.pendingCount > 0) {
      return const Color(0xFFFFF4D6);
    }
    if (update.schedulerState == SyncSchedulerState.synchronizing) {
      return const Color(0xFFE8F1FF);
    }
    return const Color(0xFFE8F6EC);
  }

  static Color _borderColor(SyncStatusUpdate update) {
    if (update.schedulerState == SyncSchedulerState.pausedNoNetwork) {
      return const Color(0xFFE2A4A4);
    }
    if (update.lastErrorMessage != null && update.pendingCount > 0) {
      return const Color(0xFFE7C66D);
    }
    if (update.schedulerState == SyncSchedulerState.synchronizing) {
      return const Color(0xFF9DBBEA);
    }
    return const Color(0xFFA7D3B2);
  }

  static Color _textColor(SyncStatusUpdate update) {
    if (update.schedulerState == SyncSchedulerState.pausedNoNetwork) {
      return const Color(0xFF7A2020);
    }
    if (update.lastErrorMessage != null && update.pendingCount > 0) {
      return const Color(0xFF725300);
    }
    if (update.schedulerState == SyncSchedulerState.synchronizing) {
      return const Color(0xFF174A8B);
    }
    return const Color(0xFF205B2D);
  }
}

class _StatusIcon extends StatelessWidget {
  const _StatusIcon({required this.update});

  final SyncStatusUpdate update;

  @override
  Widget build(BuildContext context) {
    if (update.schedulerState == SyncSchedulerState.pausedNoNetwork) {
      return const Icon(Icons.cloud_off, color: Color(0xFFB3261E), size: 24);
    }
    if (update.lastErrorMessage != null && update.pendingCount > 0) {
      return const Icon(Icons.warning_amber_rounded,
          color: Color(0xFF856404), size: 24);
    }
    if (update.schedulerState == SyncSchedulerState.synchronizing) {
      return const SizedBox(
        width: 24,
        height: 24,
        child: CircularProgressIndicator(strokeWidth: 2.5),
      );
    }
    return const Icon(Icons.cloud_done, color: Color(0xFF26733A), size: 24);
  }
}
