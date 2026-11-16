import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:medicare_ai/app/router/app_routes.dart';
import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/status_badge.dart';
import 'package:medicare_ai/features/medication/domain/entities/medication.dart';
import 'package:medicare_ai/features/medication/presentation/controllers/demo_medication_controller.dart';

class MedicationListPage extends ConsumerWidget {
  const MedicationListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final medications = ref.watch(demoMedicationsProvider);
    final active = medications
        .where((item) => item.status == MedicationStatus.active)
        .toList();
    final inactive = medications
        .where((item) => item.status == MedicationStatus.inactive)
        .toList();

    return AppPage(
      title: 'Thuốc của tôi',
      actions: [
        IconButton(
          tooltip: 'Lịch sử thuốc',
          onPressed: () => context.push(AppRoutes.medicationHistory),
          icon: const Icon(Icons.history_outlined),
        ),
      ],
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(AppRoutes.addMedication),
        icon: const Icon(Icons.add),
        label: const Text('Thêm thuốc'),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Đang sử dụng', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          if (active.isEmpty)
            const Text('Chưa có thuốc đang sử dụng.')
          else
            for (final medication in active) ...[
              _MedicationListItem(
                medication: medication,
                onTap: () =>
                    context.push(AppRoutes.medicationDetail(medication.id)),
              ),
              const SizedBox(height: AccessibilityTokens.itemGap),
            ],
          if (inactive.isNotEmpty) ...[
            const SizedBox(height: AccessibilityTokens.sectionGap),
            Text('Đã kết thúc', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            for (final medication in inactive) ...[
              _MedicationListItem(
                medication: medication,
                onTap: () =>
                    context.push(AppRoutes.medicationDetail(medication.id)),
              ),
              const SizedBox(height: AccessibilityTokens.itemGap),
            ],
          ],
          const SizedBox(height: 84),
        ],
      ),
    );
  }
}

class _MedicationListItem extends StatelessWidget {
  const _MedicationListItem({required this.medication, required this.onTap});

  final Medication medication;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final active = medication.status == MedicationStatus.active;
    return Semantics(
      button: true,
      label:
          '${medication.name}, ${medication.strengthText}, ${medication.status.label}',
      child: Card(
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                const Icon(Icons.medication_outlined, size: 30),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        medication.name,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(medication.strengthText),
                    ],
                  ),
                ),
                StatusBadge(
                  label: medication.status.label,
                  backgroundColor: active
                      ? colors.primaryContainer
                      : colors.surfaceContainerHighest,
                  foregroundColor: active
                      ? colors.onPrimaryContainer
                      : colors.onSurfaceVariant,
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
