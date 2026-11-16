import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:medicare_ai/app/router/app_routes.dart';
import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/utils/date_formatters.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/safety_notice.dart';
import 'package:medicare_ai/core/widgets/status_badge.dart';
import 'package:medicare_ai/features/medication/domain/entities/medication.dart';
import 'package:medicare_ai/features/medication/presentation/controllers/demo_medication_controller.dart';

class MedicationDetailPage extends ConsumerWidget {
  const MedicationDetailPage({super.key, required this.medicationId});

  final String medicationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final medications = ref.watch(demoMedicationsProvider);
    Medication? medication;
    for (final item in medications) {
      if (item.id == medicationId) {
        medication = item;
        break;
      }
    }

    if (medication == null) {
      return AppPage(
        title: 'Không tìm thấy thuốc',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Thuốc này không còn trong phiên dữ liệu hiện tại.'),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => context.go(AppRoutes.medicationList),
              child: const Text('Về danh sách thuốc'),
            ),
          ],
        ),
      );
    }

    final item = medication;
    final colors = Theme.of(context).colorScheme;
    final active = item.status == MedicationStatus.active;
    return AppPage(
      title: 'Chi tiết thuốc',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.name,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ),
              StatusBadge(
                label: item.status.label,
                backgroundColor: active
                    ? colors.primaryContainer
                    : colors.surfaceContainerHighest,
                foregroundColor: active
                    ? colors.onPrimaryContainer
                    : colors.onSurfaceVariant,
              ),
            ],
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          _DetailRow(label: 'Hàm lượng', value: item.strengthText),
          _DetailRow(label: 'Hướng dẫn đã nhập', value: item.directionsText),
          _DetailRow(
            label: 'Bắt đầu',
            value: formatVietnameseDate(item.startDate),
          ),
          if (item.endDate != null)
            _DetailRow(
              label: 'Kết thúc',
              value: formatVietnameseDate(item.endDate!),
            ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          const SafetyNotice(
            message: 'Hãy đối chiếu thông tin với đơn thuốc đã được kiểm tra. Không dùng ứng dụng để tự thay đổi liều hoặc giờ uống.',
          ),
          if (active) ...[
            const SizedBox(height: AccessibilityTokens.sectionGap),
            OutlinedButton.icon(
              onPressed: () {
                ref.read(demoMedicationsProvider.notifier).deactivate(item.id);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Đã ngừng thuốc trong dữ liệu giả lập. Lịch sử vẫn được giữ lại.',
                    ),
                  ),
                );
              },
              icon: const Icon(Icons.pause_circle_outline),
              label: const Text('Ngừng sử dụng thuốc'),
            ),
          ],
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 17)),
        ],
      ),
    );
  }
}
