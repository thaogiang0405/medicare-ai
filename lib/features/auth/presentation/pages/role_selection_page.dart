import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:medicare_ai/app/router/app_routes.dart';
import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/action_card.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/features/auth/domain/entities/user_role.dart';
import 'package:medicare_ai/features/auth/presentation/controllers/demo_session_controller.dart';

class RoleSelectionPage extends ConsumerWidget {
  const RoleSelectionPage({super.key});

  Future<void> _selectRole(
    BuildContext context,
    WidgetRef ref,
    UserRole role,
  ) async {
    await ref.read(demoSessionProvider.notifier).continueAs(role);
    if (!context.mounted) return;
    context.go(
      role == UserRole.elderly
          ? AppRoutes.elderlyHome
          : AppRoutes.caregiverHome,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppPage(
      title: 'Chọn vai trò',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Bạn dùng MediCare AI với vai trò nào?',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          const Text(
            'Vai trò quyết định màn hình chính và quyền truy cập. Bạn có thể thay đổi khi thiết lập hồ sơ.',
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          ActionCard(
            icon: Icons.favorite_outline,
            title: UserRole.elderly.label,
            description: UserRole.elderly.description,
            onTap: () => _selectRole(context, ref, UserRole.elderly),
          ),
          const SizedBox(height: AccessibilityTokens.itemGap),
          ActionCard(
            icon: Icons.people_outline,
            title: UserRole.caregiver.label,
            description: UserRole.caregiver.description,
            onTap: () => _selectRole(context, ref, UserRole.caregiver),
          ),
        ],
      ),
    );
  }
}
