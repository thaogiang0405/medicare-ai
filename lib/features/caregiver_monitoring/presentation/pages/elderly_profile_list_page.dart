import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:medicare_ai/app/router/app_routes.dart';
import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/action_card.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/demo_mode_banner.dart';

class ElderlyProfileListPage extends StatelessWidget {
  const ElderlyProfileListPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPage(
      title: 'Hồ sơ người cao tuổi',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const DemoModeBanner(),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          const Text(
            'Chỉ những hồ sơ có liên kết còn hiệu lực mới xuất hiện tại đây.',
          ),
          const SizedBox(height: 16),
          ActionCard(
            icon: Icons.elderly_outlined,
            title: 'Cô Minh',
            description:
                'Liên kết minh họa • quyền xem lịch thuốc và phản hồi.',
            onTap: () => context.push(AppRoutes.caregiverMonitoring),
          ),
        ],
      ),
    );
  }
}
