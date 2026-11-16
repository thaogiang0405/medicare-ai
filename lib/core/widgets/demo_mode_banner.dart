import 'package:flutter/material.dart';

class DemoModeBanner extends StatelessWidget {
  const DemoModeBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(
        'Chế độ nền tảng: dữ liệu trên màn hình là giả lập và chỉ lưu trong phiên hiện tại.',
        style: TextStyle(color: colors.onSurfaceVariant, fontSize: 15),
      ),
    );
  }
}
