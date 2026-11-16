import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:medicare_ai/app/router/app_routes.dart';
import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/safety_notice.dart';

class OnboardingPage extends StatelessWidget {
  const OnboardingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPage(
      title: 'MediCare AI',
      showBackButton: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(
            Icons.medication_outlined,
            size: 92,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          Text(
            'Quản lý thuốc nhẹ nhàng, rõ ràng',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 12),
          const Text(
            'Theo dõi lịch uống thuốc, ghi nhận phản hồi và kết nối với người thân khi bạn cho phép.',
            style: TextStyle(fontSize: 18),
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          const SafetyNotice(
            message: 'MediCare AI hỗ trợ quản lý thông tin. Ứng dụng không thay thế bác sĩ và không tự quyết định liều thuốc.',
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          FilledButton.icon(
            onPressed: () => context.go(AppRoutes.login),
            icon: const Icon(Icons.arrow_forward),
            label: const Text('Bắt đầu'),
          ),
        ],
      ),
    );
  }
}
