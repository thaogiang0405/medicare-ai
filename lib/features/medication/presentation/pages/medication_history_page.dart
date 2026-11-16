import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/utils/date_formatters.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/status_badge.dart';
import 'package:medicare_ai/features/dose_event/domain/entities/dose_event.dart';
import 'package:medicare_ai/features/dose_event/presentation/controllers/demo_dose_event_controller.dart';
import 'package:medicare_ai/features/medication/domain/entities/medication.dart';
import 'package:medicare_ai/features/medication/presentation/controllers/demo_medication_controller.dart';

class MedicationHistoryPage extends ConsumerWidget {
  const MedicationHistoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final medications = ref.watch(demoMedicationsProvider);
    final events = [...ref.watch(demoDoseEventsProvider)]
      ..sort((left, right) => right.scheduledAt.compareTo(left.scheduledAt));

    Medication? medicationFor(String medicationId) {
      for (final item in medications) {
        if (item.id == medicationId) return item;
      }
      return null;
    }

    return AppPage(
      title: 'Lịch sử phản hồi',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Lịch sử cho biết phản hồi đã được ghi nhận, không chứng minh thuốc đã được dùng thực tế.',
            style: TextStyle(fontSize: 17),
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          for (final event in events) ...[
            _HistoryItem(
              event: event,
              medication: medicationFor(event.medicationId),
            ),
            const SizedBox(height: AccessibilityTokens.itemGap),
          ],
        ],
      ),
    );
  }
}

class _HistoryItem extends StatelessWidget {
  const _HistoryItem({required this.event, required this.medication});

  final DoseEvent event;
  final Medication? medication;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final (background, foreground) = switch (event.status) {
      DoseStatus.reportedTaken => (
        const Color(0xFFD8F3DC),
        const Color(0xFF12351B),
      ),
      DoseStatus.reportedSkipped => (
        colors.errorContainer,
        colors.onErrorContainer,
      ),
      DoseStatus.snoozed => (const Color(0xFFFFE8B6), const Color(0xFF4A3400)),
      DoseStatus.pending => (
        colors.primaryContainer,
        colors.onPrimaryContainer,
      ),
      DoseStatus.unanswered => (
        colors.surfaceContainerHighest,
        colors.onSurfaceVariant,
      ),
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(Icons.history_outlined),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    medication?.name ?? 'Thuốc không còn khả dụng',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    '${formatVietnameseDate(event.scheduledAt)} • ${formatVietnameseTime(event.scheduledAt)}',
                  ),
                ],
              ),
            ),
            StatusBadge(
              label: event.status.label,
              backgroundColor: background,
              foregroundColor: foreground,
            ),
          ],
        ),
      ),
    );
  }
}
