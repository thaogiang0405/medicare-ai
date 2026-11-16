import 'package:flutter/material.dart';

import 'package:medicare_ai/core/utils/date_formatters.dart';
import 'package:medicare_ai/core/widgets/status_badge.dart';
import 'package:medicare_ai/features/dose_event/domain/entities/dose_event.dart';
import 'package:medicare_ai/features/medication/domain/entities/medication.dart';

class DoseEventCard extends StatelessWidget {
  const DoseEventCard({
    super.key,
    required this.event,
    required this.medication,
    this.onTaken,
    this.onSkipped,
    this.onSnooze,
  });

  final DoseEvent event;
  final Medication? medication;
  final VoidCallback? onTaken;
  final VoidCallback? onSkipped;
  final VoidCallback? onSnooze;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final isPending = event.status == DoseStatus.pending;
    final (background, foreground) = _statusColors(event.status, colors);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    formatVietnameseTime(event.scheduledAt),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                StatusBadge(
                  label: event.status.label,
                  backgroundColor: background,
                  foregroundColor: foreground,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              medication?.name ?? 'Thuốc không còn khả dụng',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            if (medication != null) ...[
              const SizedBox(height: 4),
              Text(
                '${medication!.strengthText} • ${medication!.directionsText}',
              ),
            ],
            if (event.respondedAt != null) ...[
              const SizedBox(height: 12),
              Text('Phản hồi lúc ${formatVietnameseTime(event.respondedAt!)}'),
            ],
            if (isPending && onTaken != null) ...[
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: onTaken,
                icon: const Icon(Icons.check_circle_outline),
                label: const Text('Đã uống'),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onSkipped,
                      child: const Text('Bỏ qua'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onSnooze,
                      child: const Text('Nhắc lại'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  (Color, Color) _statusColors(DoseStatus status, ColorScheme colors) {
    return switch (status) {
      DoseStatus.pending => (
        colors.primaryContainer,
        colors.onPrimaryContainer,
      ),
      DoseStatus.reportedTaken => (
        const Color(0xFFD8F3DC),
        const Color(0xFF12351B),
      ),
      DoseStatus.reportedSkipped => (
        colors.errorContainer,
        colors.onErrorContainer,
      ),
      DoseStatus.snoozed => (const Color(0xFFFFE8B6), const Color(0xFF4A3400)),
      DoseStatus.unanswered => (
        colors.surfaceContainerHighest,
        colors.onSurfaceVariant,
      ),
    };
  }
}
