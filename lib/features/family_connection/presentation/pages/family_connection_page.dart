import 'package:flutter/material.dart';

import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/action_card.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/demo_mode_banner.dart';
import 'package:medicare_ai/core/widgets/safety_notice.dart';

class FamilyConnectionPage extends StatelessWidget {
  const FamilyConnectionPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPage(
      title: 'Kết nối người thân',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const DemoModeBanner(),
          const SizedBox(height: AccessibilityTokens.itemGap),
          const SafetyNotice(
            message: 'Người chăm sóc chỉ được xem dữ liệu sau khi bạn chủ động xác nhận liên kết. Bạn có thể thu hồi quyền bất cứ lúc nào.',
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          Text(
            'Chưa có liên kết đang hoạt động',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          const Text(
            'Tính năng lời mời, chấp thuận và thu hồi quyền sẽ sử dụng Cloud Functions và Firestore Rules ở milestone Gia đình.',
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          ActionCard(
            icon: Icons.link_outlined,
            title: 'Tạo lời mời thử',
            description:
                'Minh họa thao tác tạo mã liên kết; chưa gửi dữ liệu thật.',
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Lời mời thật chỉ được tạo sau khi Firebase được cấu hình.',
                ),
              ),
            ),
          ),
          const SizedBox(height: AccessibilityTokens.itemGap),
          ActionCard(
            icon: Icons.privacy_tip_outlined,
            title: 'Quyền chia sẻ',
            description: 'Mặc định không chia sẻ dữ liệu thuốc hoặc đơn thuốc.',
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Các quyền chi tiết được mô tả trong tài liệu Firestore Rules.',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
