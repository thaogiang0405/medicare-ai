import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:medicare_ai/app/router/app_routes.dart';
import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/demo_mode_banner.dart';
import 'package:medicare_ai/core/widgets/safety_notice.dart';
import 'package:medicare_ai/features/auth/presentation/controllers/demo_session_controller.dart';
import 'package:medicare_ai/features/medication/presentation/controllers/demo_medication_controller.dart';

/// Phase 1 review shell. ML Kit image capture and OCR are added behind the
/// same editable confirmation screen in the AI integration milestone.
class PrescriptionReviewPage extends ConsumerStatefulWidget {
  const PrescriptionReviewPage({super.key});

  @override
  ConsumerState<PrescriptionReviewPage> createState() =>
      _PrescriptionReviewPageState();
}

class _PrescriptionReviewPageState
    extends ConsumerState<PrescriptionReviewPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController(text: 'Tên thuốc cần kiểm tra');
  final _strengthController = TextEditingController();
  final _directionsController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _strengthController.dispose();
    _directionsController.dispose();
    super.dispose();
  }

  void _confirm() {
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
      const SnackBar(
        content: Text('Đã xác nhận và lưu thuốc trong dữ liệu giả lập.'),
      ),
    );
    context.go(AppRoutes.medicationList);
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      title: 'Kiểm tra đơn thuốc',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const DemoModeBanner(),
            const SizedBox(height: AccessibilityTokens.itemGap),
            const SafetyNotice(
              message: 'Màn hình này chỉ là luồng kiểm tra nền tảng. OCR không được phép tự tạo lịch hoặc tự suy đoán thông tin còn thiếu.',
            ),
            const SizedBox(height: AccessibilityTokens.sectionGap),
            Text(
              'Kết quả cần bạn kiểm tra',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            const Text(
              'Điền hoặc sửa từng trường theo đơn thuốc đã được đối chiếu.',
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _nameController,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(labelText: 'Tên thuốc'),
              validator: (value) => (value == null || value.trim().isEmpty)
                  ? 'Không được để trống tên thuốc.'
                  : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _strengthController,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Hàm lượng theo đơn',
              ),
              validator: (value) => (value == null || value.trim().isEmpty)
                  ? 'Không tự suy đoán hàm lượng — hãy nhập từ đơn.'
                  : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _directionsController,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'Hướng dẫn sử dụng đã kiểm tra',
              ),
              validator: (value) => (value == null || value.trim().isEmpty)
                  ? 'Không tự suy đoán hướng dẫn — hãy nhập từ đơn.'
                  : null,
            ),
            const SizedBox(height: AccessibilityTokens.sectionGap),
            FilledButton.icon(
              onPressed: _confirm,
              icon: const Icon(Icons.verified_outlined),
              label: const Text('Tôi đã kiểm tra và xác nhận'),
            ),
          ],
        ),
      ),
    );
  }
}
