import 'package:flutter/material.dart';

import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/safety_notice.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool _ttsEnabled = true;
  bool _largeTextPreference = true;

  @override
  Widget build(BuildContext context) {
    return AppPage(
      title: 'Cài đặt trợ năng',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SafetyNotice(
            message: 'Tùy chọn này minh họa giao diện Phase 1. Sở thích sẽ được lưu theo hồ sơ khi hệ thống dữ liệu được kết nối.',
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'Đọc lời nhắc bằng giọng nói',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            subtitle: const Text(
              'Sẽ dùng giọng nói tiếng Việt khi thiết bị và quyền cho phép.',
            ),
            value: _ttsEnabled,
            onChanged: (value) => setState(() => _ttsEnabled = value),
          ),
          const Divider(),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'Ưu tiên chữ lớn',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            subtitle: const Text(
              'Ứng dụng luôn giữ vùng chạm lớn và độ tương phản rõ.',
            ),
            value: _largeTextPreference,
            onChanged: (value) => setState(() => _largeTextPreference = value),
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          OutlinedButton.icon(
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Đã cập nhật tùy chọn trong phiên trình diễn.'),
              ),
            ),
            icon: const Icon(Icons.volume_up_outlined),
            label: const Text('Kiểm tra phản hồi âm thanh'),
          ),
        ],
      ),
    );
  }
}
