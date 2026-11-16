import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:medicare_ai/app/router/app_routes.dart';
import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/demo_mode_banner.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();

  void _continueToRoleSelection() {
    if (_formKey.currentState?.validate() ?? false) {
      context.go(AppRoutes.roleSelection);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPage(
      title: 'Tạo tài khoản',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Thông tin cơ bản',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            const Text('Chúng tôi chỉ yêu cầu thông tin cần thiết để bắt đầu.'),
            const SizedBox(height: AccessibilityTokens.sectionGap),
            const DemoModeBanner(),
            const SizedBox(height: AccessibilityTokens.sectionGap),
            TextFormField(
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(labelText: 'Họ và tên'),
              validator: (value) => (value == null || value.trim().isEmpty)
                  ? 'Vui lòng nhập họ và tên.'
                  : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(labelText: 'Email'),
              validator: (value) => (value == null || !value.contains('@'))
                  ? 'Vui lòng nhập một email hợp lệ.'
                  : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              obscureText: true,
              onFieldSubmitted: (_) => _continueToRoleSelection(),
              decoration: const InputDecoration(labelText: 'Mật khẩu'),
              validator: (value) => (value == null || value.length < 6)
                  ? 'Mật khẩu cần có ít nhất 6 ký tự.'
                  : null,
            ),
            const SizedBox(height: AccessibilityTokens.sectionGap),
            FilledButton(
              onPressed: _continueToRoleSelection,
              child: const Text('Tạo và tiếp tục'),
            ),
          ],
        ),
      ),
    );
  }
}
