import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:medicare_ai/app/router/app_routes.dart';
import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/safety_notice.dart';
import 'package:medicare_ai/features/auth/presentation/controllers/demo_session_controller.dart';
import 'package:medicare_ai/features/medication/presentation/controllers/demo_medication_controller.dart';

class AddMedicationPage extends ConsumerStatefulWidget {
  const AddMedicationPage({super.key});

  @override
  ConsumerState<AddMedicationPage> createState() => _AddMedicationPageState();
}

class _AddMedicationPageState extends ConsumerState<AddMedicationPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _strengthController = TextEditingController();
  final _directionsController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _strengthController.dispose();
    _directionsController.dispose();
    super.dispose();
  }

  void _save() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final user = ref.read(demoSessionProvider);
    ref
        .read(demoMedicationsProvider.notifier)
        .addMedication(
          name: _nameController.text,
          strengthText: _strengthController.text,
          directionsText: _directionsController.text,
          createdBy: user.id.isEmpty ? 'demo-user' : user.id,
        );
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Đã thêm thuốc vào dữ liệu giả lập.')),
    );
    context.go(AppRoutes.medicationList);
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      title: 'Thêm thuốc',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SafetyNotice(
              message: 'Chỉ nhập thông tin từ đơn thuốc đã được kiểm tra hoặc hướng dẫn của nhân viên y tế. Không để ứng dụng suy đoán liều.',
            ),
            const SizedBox(height: AccessibilityTokens.sectionGap),
            TextFormField(
              controller: _nameController,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(labelText: 'Tên thuốc'),
              validator: (value) => (value == null || value.trim().isEmpty)
                  ? 'Vui lòng nhập tên thuốc.'
                  : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _strengthController,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Hàm lượng, ví dụ 500 mg',
              ),
              validator: (value) => (value == null || value.trim().isEmpty)
                  ? 'Vui lòng nhập hàm lượng đúng theo đơn.'
                  : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _directionsController,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Hướng dẫn sử dụng theo đơn',
              ),
              validator: (value) => (value == null || value.trim().isEmpty)
                  ? 'Vui lòng nhập hướng dẫn đã được kiểm tra.'
                  : null,
            ),
            const SizedBox(height: AccessibilityTokens.sectionGap),
            FilledButton.icon(
              onPressed: _save,
              icon: const Icon(Icons.save_outlined),
              label: const Text('Lưu thuốc'),
            ),
          ],
        ),
      ),
    );
  }
}
