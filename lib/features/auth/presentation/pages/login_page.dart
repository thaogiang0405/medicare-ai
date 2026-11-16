import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:medicare_ai/app/router/app_routes.dart';
import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/demo_mode_banner.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();

  void _continueToRoleSelection() {
    if (_formKey.currentState?.validate() ?? false) {
      context.go(AppRoutes.roleSelection);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      title: 'Đăng nhập',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Chào mừng trở lại',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            const Text(
              'Đăng nhập để xem đúng hồ sơ và quyền truy cập của bạn.',
              style: TextStyle(fontSize: 17),
            ),
            const SizedBox(height: AccessibilityTokens.sectionGap),
            const DemoModeBanner(),
            const SizedBox(height: AccessibilityTokens.sectionGap),
            TextFormField(
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Email hoặc số điện thoại',
                prefixIcon: Icon(Icons.person_outline),
              ),
              validator: (value) => (value == null || value.trim().isEmpty)
                  ? 'Vui lòng nhập email hoặc số điện thoại.'
                  : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              obscureText: true,
              onFieldSubmitted: (_) => _continueToRoleSelection(),
              decoration: const InputDecoration(
                labelText: 'Mật khẩu',
                prefixIcon: Icon(Icons.lock_outline),
              ),
              validator: (value) => (value == null || value.length < 6)
                  ? 'Mật khẩu cần có ít nhất 6 ký tự.'
                  : null,
            ),
            const SizedBox(height: AccessibilityTokens.sectionGap),
            FilledButton(
              onPressed: _continueToRoleSelection,
              child: const Text('Tiếp tục'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => context.go(AppRoutes.register),
              child: const Text('Tạo tài khoản mới'),
            ),
          ],
        ),
      ),
    );
  }
}
