import 'package:flutter/material.dart';

import 'package:medicare_ai/app/theme/accessibility_tokens.dart';
import 'package:medicare_ai/core/widgets/app_page.dart';
import 'package:medicare_ai/core/widgets/demo_mode_banner.dart';
import 'package:medicare_ai/core/widgets/safety_notice.dart';

class MonitoringPage extends StatelessWidget {
  const MonitoringPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPage(
      title: 'Theo dõi phản hồi',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const DemoModeBanner(),
          const SizedBox(height: AccessibilityTokens.itemGap),
          const SafetyNotice(
            message: 'Dữ liệu dưới đây là tự báo cáo minh họa. Không dùng để kết luận việc đã hoặc chưa dùng thuốc.',
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          Text(
            'Hôm nay — Cô Minh',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          const Row(
            children: [
              Expanded(
                child: _MetricCard(
                  label: 'Đã tự báo',
                  value: '0',
                  icon: Icons.check_circle_outline,
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: _MetricCard(
                  label: 'Bỏ qua',
                  value: '0',
                  icon: Icons.skip_next_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Row(
            children: [
              Expanded(
                child: _MetricCard(
                  label: 'Chưa phản hồi',
                  value: '2',
                  icon: Icons.schedule_outlined,
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: _MetricCard(
                  label: 'Lịch hôm nay',
                  value: '2',
                  icon: Icons.calendar_today_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: AccessibilityTokens.sectionGap),
          Text('Chi tiết', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          const Card(
            child: Padding(
              padding: EdgeInsets.all(18),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.schedule_outlined),
                title: Text('08:00 — Metformin 500 mg'),
                subtitle: Text('Chưa có phản hồi được ghi nhận'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon),
            const SizedBox(height: 10),
            Text(value, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 2),
            Text(label),
          ],
        ),
      ),
    );
  }
}
