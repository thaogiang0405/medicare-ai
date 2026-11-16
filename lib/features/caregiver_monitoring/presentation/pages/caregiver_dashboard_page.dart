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

class CaregiverDashboardPage extends ConsumerWidget {
  const CaregiverDashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(demoSessionProvider);
    return AppPage(
      title:
          'Xin chào${user.displayName.isEmpty ? '' : ', ${user.displayName}'}',
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
          const SizedBox(height: AccessibilityTokens.itemGap),
          const SafetyNotice(
            message: '“Chưa phản hồi” không có nghĩa là người cao tuổi chưa uống thuốc. Chỉ liên hệ hỗ trợ khi phù hợp với thỏa thuận chăm sóc.',
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          Text(
            'Hồ sơ được phép theo dõi',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          ActionCard(
            icon: Icons.elderly_outlined,
            title: 'Cô Minh — dữ liệu trình diễn',
            description: '2 lịch hôm nay • quyền chia sẻ mẫu.',
            onTap: () => context.push(AppRoutes.caregiverMonitoring),
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          Text('Thao tác nhanh', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          ActionCard(
            icon: Icons.people_outline,
            title: 'Danh sách người cao tuổi',
            description: 'Xem các hồ sơ đã chủ động cấp quyền.',
            onTap: () => context.push(AppRoutes.elderlyProfiles),
          ),
          const SizedBox(height: AccessibilityTokens.itemGap),
          ActionCard(
            icon: Icons.monitor_heart_outlined,
            title: 'Theo dõi phản hồi',
            description: 'Xem báo cáo tự xác nhận và trạng thái nhắc thuốc.',
            onTap: () => context.push(AppRoutes.caregiverMonitoring),
          ),
          const SizedBox(height: AccessibilityTokens.itemGap),
          ActionCard(
            icon: Icons.link_outlined,
            title: 'Quản lý liên kết',
            description: 'Lời mời, phạm vi quyền và thu hồi quyền.',
            onTap: () => context.push(AppRoutes.familyConnection),
          ),
        ],
      ),
    );
  }
}
