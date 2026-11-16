import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:medicare_ai/app/router/app_routes.dart';
import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/action_card.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/demo_mode_banner.dart';
import 'package:medicare_ai/features/auth/domain/entities/user_role.dart';
import 'package:medicare_ai/features/auth/presentation/controllers/demo_session_controller.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(demoSessionProvider);
    final roleText = session.role?.label ?? 'Chưa chọn vai trò';
    return AppPage(
      title: 'Hồ sơ',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const DemoModeBanner(),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          Center(
            child: CircleAvatar(
              radius: 42,
              child: Icon(
                session.role?.name == 'caregiver'
                    ? Icons.people_outline
                    : Icons.favorite_outline,
                size: 42,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Center(
            child: Text(
              session.displayName.isEmpty ? 'Khách' : session.displayName,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
          ),
          const SizedBox(height: 6),
          Center(child: Text(roleText)),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          ActionCard(
            icon: Icons.settings_outlined,
            title: 'Cài đặt trợ năng',
            description: 'Cỡ chữ, đọc nội dung và phản hồi của ứng dụng.',
            onTap: () => context.push(AppRoutes.settings),
          ),
          const SizedBox(height: AccessibilityTokens.itemGap),
          ActionCard(
            icon: Icons.swap_horiz_outlined,
            title: 'Đổi vai trò trình diễn',
            description:
                'Trở lại màn hình chọn Người cao tuổi hoặc Người chăm sóc.',
            onTap: () => context.go(AppRoutes.roleSelection),
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          OutlinedButton.icon(
            onPressed: () async {
              await ref.read(demoSessionProvider.notifier).signOut();
              if (!context.mounted) return;
              context.go(AppRoutes.login);
            },
            icon: const Icon(Icons.logout),
            label: const Text('Đăng xuất phiên trình diễn'),
          ),
        ],
      ),
    );
  }
}
