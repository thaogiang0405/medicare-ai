import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:medicare_ai/app/router/app_routes.dart';
import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/action_card.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/demo_mode_banner.dart';
import 'package:medicare_ai/core/widgets/safety_notice.dart';
import 'package:medicare_ai/features/auth/presentation/controllers/demo_session_controller.dart';
import 'package:medicare_ai/features/dose_event/domain/entities/dose_event.dart';
import 'package:medicare_ai/features/dose_event/presentation/controllers/demo_dose_event_controller.dart';
import 'package:medicare_ai/features/dose_event/presentation/widgets/dose_event_card.dart';
import 'package:medicare_ai/features/medication/domain/entities/medication.dart';
import 'package:medicare_ai/features/medication/presentation/controllers/demo_medication_controller.dart';

class ElderlyHomePage extends ConsumerWidget {
  const ElderlyHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(demoSessionProvider);
    final medications = ref.watch(demoMedicationsProvider);
    final events = [...ref.watch(demoDoseEventsProvider)]
      ..sort((left, right) => left.scheduledAt.compareTo(right.scheduledAt));
    final pendingEvents = events
        .where((event) => event.status == DoseStatus.pending)
        .toList();
    final nextEvent = pendingEvents.isNotEmpty ? pendingEvents.first : null;

    Medication? medicationFor(String medicationId) {
      for (final medication in medications) {
        if (medication.id == medicationId) return medication;
      }
      return null;
    }

    return AppPage(
      title:
          'Xin chào${session.displayName.isEmpty ? '' : ', ${session.displayName}'}',
      actions: [
        IconButton(
          tooltip: 'Hồ sơ',
          onPressed: () => context.push(AppRoutes.profile),
          icon: const Icon(Icons.account_circle_outlined, size: 30),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const DemoModeBanner(),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          Text(
            'Lần uống thuốc tiếp theo',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          if (nextEvent == null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  'Bạn đã phản hồi tất cả lịch thuốc hôm nay.',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            )
          else
            DoseEventCard(
              event: nextEvent,
              medication: medicationFor(nextEvent.medicationId),
              onTaken: () => _recordResponse(
                context,
                ref,
                nextEvent.id,
                DoseStatus.reportedTaken,
              ),
              onSkipped: () => _recordResponse(
                context,
                ref,
                nextEvent.id,
                DoseStatus.reportedSkipped,
              ),
              onSnooze: () => _recordResponse(
                context,
                ref,
                nextEvent.id,
                DoseStatus.snoozed,
              ),
            ),
          const SizedBox(height: AccessibilityTokens.itemGap),
          TextButton.icon(
            onPressed: () => context.push(AppRoutes.todaySchedule),
            icon: const Icon(Icons.calendar_today_outlined),
            label: const Text('Xem toàn bộ lịch hôm nay'),
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          const SafetyNotice(
            message: '“Đã uống” là phản hồi tự báo cáo; không phải bằng chứng xác nhận đã dùng thuốc thực tế.',
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          Text('Thao tác nhanh', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          ActionCard(
            icon: Icons.document_scanner_outlined,
            title: 'Quét và kiểm tra đơn thuốc',
            description: 'Kết quả nhận diện luôn cần được bạn xác nhận.',
            onTap: () => context.push(AppRoutes.prescriptionScanner),
          ),
          const SizedBox(height: AccessibilityTokens.itemGap),
          ActionCard(
            icon: Icons.medication_outlined,
            title: 'Thuốc của tôi',
            description: 'Xem, thêm hoặc ngừng thuốc đang sử dụng.',
            onTap: () => context.push(AppRoutes.medicationList),
          ),
          const SizedBox(height: AccessibilityTokens.itemGap),
          ActionCard(
            icon: Icons.call_outlined,
            title: 'Liên hệ người thân',
            description: 'Xem người chăm sóc được cấp quyền và cách liên hệ.',
            onTap: () => context.push(AppRoutes.familyConnection),
          ),
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
    final message = switch (status) {
      DoseStatus.reportedTaken => 'Đã lưu phản hồi tự báo “Đã uống”.',
      DoseStatus.reportedSkipped => 'Đã lưu phản hồi “Bỏ qua”.',
      DoseStatus.snoozed => 'Đã lưu yêu cầu nhắc lại trong bản trình diễn.',
      _ => 'Đã cập nhật trạng thái.',
    };
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}
