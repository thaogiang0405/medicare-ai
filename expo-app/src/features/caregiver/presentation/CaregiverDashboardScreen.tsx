import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  ActionCard,
  AppHeader,
  DemoModeBanner,
  SafetyNotice,
  Screen,
  SecondaryButton,
  StatusBadge,
} from '@/components/medicare';
import { medicareColors, medicareRadius, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { useSessionStore } from '@/store';

function showDeferredFeature(feature: string) {
  Alert.alert('Chưa có trong Migration 1', `${feature} sẽ được xây dựng ở milestone phù hợp.`);
}

export default function CaregiverDashboardScreen() {
  const user = useSessionStore((state) => state.user);

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        right={<Text style={styles.roleLabel}>Người chăm sóc</Text>}
        title={`Chào ${user?.displayName ?? 'Anh Nam'}`}
      />
      <DemoModeBanner
        description="Hồ sơ và trạng thái dưới đây là dữ liệu giả lập; chưa có đồng bộ hoặc phân quyền Firebase."
        title="Chế độ trình diễn"
      />
      <SafetyNotice
        message="“Chưa phản hồi” không đồng nghĩa người dùng chưa uống thuốc. Hãy liên hệ nhẹ nhàng khi cần."
        title="Hiểu đúng trạng thái"
        tone="warning"
      />
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Hồ sơ được chia sẻ
        </Text>
        <View accessibilityRole="summary" style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text accessibilityElementsHidden style={styles.avatarText}>CM</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>Cô Minh</Text>
            <Text style={styles.profileDescription}>Dữ liệu trình diễn · Quyền chia sẻ mô phỏng</Text>
          </View>
          <StatusBadge label="Chưa phản hồi" status="unanswered" />
        </View>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Thao tác nhanh
        </Text>
        <ActionCard
          description="Màn hình theo dõi chi tiết chưa được triển khai."
          icon={<Text style={styles.icon}>◷</Text>}
          onPress={() => showDeferredFeature('Theo dõi lịch thuốc')}
          title="Theo dõi lịch thuốc"
        />
        <ActionCard
          description="Thông báo và chăm sóc từ xa sẽ được bổ sung sau."
          icon={<Text style={styles.icon}>♥</Text>}
          onPress={() => showDeferredFeature('Nhắc người thân')}
          title="Nhắc người thân"
        />
        <ActionCard
          description="Luồng xin cấp quyền chưa được tích hợp."
          icon={<Text style={styles.icon}>⌁</Text>}
          onPress={() => showDeferredFeature('Liên kết hồ sơ')}
          title="Liên kết hồ sơ"
        />
      </View>
      <SecondaryButton label="Đổi vai trò (demo)" onPress={() => router.replace('/role-selection')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: medicareSpacing.xl,
  },
  roleLabel: {
    color: medicareColors.primary,
    fontSize: medicareTypography.caption,
    fontWeight: '700',
  },
  section: {
    gap: medicareSpacing.md,
  },
  sectionTitle: {
    color: medicareColors.text,
    fontSize: medicareTypography.subheading,
    fontWeight: '800',
    lineHeight: 29,
  },
  profileCard: {
    minHeight: 102,
    alignItems: 'center',
    flexDirection: 'row',
    gap: medicareSpacing.sm,
    padding: medicareSpacing.md,
    borderRadius: medicareRadius.lg,
    borderColor: medicareColors.border,
    borderWidth: 1,
    backgroundColor: medicareColors.surfaceElevated,
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: medicareColors.primaryContainer,
  },
  avatarText: {
    color: medicareColors.primary,
    fontSize: medicareTypography.label,
    fontWeight: '800',
  },
  profileCopy: {
    flex: 1,
    gap: medicareSpacing.xxs,
  },
  profileName: {
    color: medicareColors.text,
    fontSize: medicareTypography.label,
    fontWeight: '800',
  },
  profileDescription: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 22,
  },
  icon: {
    color: medicareColors.primary,
    fontSize: 28,
  },
});
