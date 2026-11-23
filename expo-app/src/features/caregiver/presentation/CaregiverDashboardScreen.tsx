import { useState } from 'react';
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

const demoSchedule = [
  { time: '08:00', label: 'Thuốc mẫu A', response: 'Tự báo đã uống' },
  { time: '13:00', label: 'Thuốc mẫu B', response: 'Tự báo bỏ qua' },
  { time: '20:00', label: 'Thuốc mẫu C', response: 'Chưa phản hồi' },
] as const;

function showDeferredFeature(feature: string) {
  Alert.alert('Chưa có trong lộ trình hiện tại', `${feature} sẽ được xây dựng ở milestone phù hợp.`);
}

export default function CaregiverDashboardScreen() {
  const user = useSessionStore((state) => state.user);
  const signOut = useSessionStore((state) => state.signOut);
  const operationStatus = useSessionStore((state) => state.operationStatus);
  const authErrorMessage = useSessionStore((state) => state.errorMessage);
  const [showDemoSchedule, setShowDemoSchedule] = useState(false);
  const isSigningOut = operationStatus === 'loading';

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch {
      // The session store exposes a safe localized error below.
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        right={<Text style={styles.roleLabel}>Người chăm sóc</Text>}
        title={`Chào ${user?.displayName ?? 'bạn'}`}
      />
      <DemoModeBanner
        description="Vai trò đã được kiểm tra từ hồ sơ của chính bạn. Hồ sơ và trạng thái dưới đây là dữ liệu giả lập; chưa có liên kết chăm sóc, đồng bộ hay quyền dữ liệu sức khỏe."
        title="Chế độ trình diễn"
      />
      {authErrorMessage ? (
        <SafetyNotice message={authErrorMessage} title="Không thể hoàn tất phiên đăng nhập" tone="error" />
      ) : null}
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
            <Text accessibilityElementsHidden style={styles.avatarText}>MH</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>Hồ sơ minh họa</Text>
            <Text style={styles.profileDescription}>Dữ liệu trình diễn · Không phải hồ sơ người dùng khác</Text>
          </View>
          <StatusBadge label="Chưa phản hồi" status="unanswered" />
        </View>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Thao tác nhanh
        </Text>
        <ActionCard
          accessibilityHint="Mở hoặc ẩn lịch minh họa, không đọc hồ sơ của người khác"
          description="Xem giờ dự kiến và phản hồi tự báo của hồ sơ minh họa."
          icon={<Text style={styles.icon}>◷</Text>}
          onPress={() => setShowDemoSchedule((visible) => !visible)}
          title={showDemoSchedule ? 'Ẩn lịch thuốc minh họa' : 'Theo dõi lịch thuốc'}
        />
        {showDemoSchedule ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Lịch thuốc hôm nay · Minh họa</Text>
            {demoSchedule.map(({ time, label, response }) => (
              <View key={time} style={styles.scheduleRow}>
                <Text style={styles.profileName}>{time} · {label}</Text>
                <Text style={styles.profileDescription}>{response}</Text>
              </View>
            ))}
          </View>
        ) : null}
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
      <SecondaryButton
        accessibilityHint="Đăng xuất và xóa trạng thái phiên trong bộ nhớ"
        disabled={isSigningOut}
        label={isSigningOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
        onPress={() => void handleSignOut()}
      />
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
  scheduleRow: {
    gap: medicareSpacing.xxs,
    padding: medicareSpacing.md,
    borderRadius: medicareRadius.lg,
    borderWidth: 1,
    borderColor: medicareColors.border,
    backgroundColor: medicareColors.surfaceElevated,
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
