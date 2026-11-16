import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/safety_notice.dart';
import 'package:medicare_ai/features/dose_event/domain/entities/dose_event.dart';
import 'package:medicare_ai/features/dose_event/presentation/controllers/demo_dose_event_controller.dart';
import 'package:medicare_ai/features/dose_event/presentation/widgets/dose_event_card.dart';
import 'package:medicare_ai/features/medication/domain/entities/medication.dart';
import 'package:medicare_ai/features/medication/presentation/controllers/demo_medication_controller.dart';

class TodaySchedulePage extends ConsumerWidget {
  const TodaySchedulePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final medications = ref.watch(demoMedicationsProvider);
    final events = [...ref.watch(demoDoseEventsProvider)]
      ..sort((left, right) => left.scheduledAt.compareTo(right.scheduledAt));

    Medication? medicationFor(String medicationId) {
      for (final medication in medications) {
        if (medication.id == medicationId) return medication;
      }
      return null;
    }

    return AppPage(
      title: 'Lịch uống hôm nay',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SafetyNotice(
            message: 'Lịch trong bản nền tảng là dữ liệu giả lập. Không thay đổi kế hoạch điều trị nếu chưa trao đổi với nhân viên y tế.',
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          for (final event in events) ...[
            DoseEventCard(
              event: event,
              medication: medicationFor(event.medicationId),
              onTaken: event.status == DoseStatus.pending
                  ? () => _recordResponse(
                      context,
                      ref,
                      event.id,
                      DoseStatus.reportedTaken,
                    )
                  : null,
              onSkipped: event.status == DoseStatus.pending
                  ? () => _recordResponse(
                      context,
                      ref,
                      event.id,
                      DoseStatus.reportedSkipped,
                    )
                  : null,
              onSnooze: event.status == DoseStatus.pending
                  ? () => _recordResponse(
                      context,
                      ref,
                      event.id,
                      DoseStatus.snoozed,
                    )
                  : null,
            ),
            const SizedBox(height: AccessibilityTokens.itemGap),
          ],
        ],
      ),
    );
  }

  void _recordResponse(
    BuildContext context,
    WidgetRef ref,
    String eventId,
    DoseStatus status,
  ) {
    ref.read(demoDoseEventsProvider.notifier).recordResponse(eventId, status);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Đã cập nhật: ${status.label.toLowerCase()}')),
    );
  }
}
