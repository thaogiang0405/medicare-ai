import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ActionCard, AppHeader, DemoModeBanner, SafetyNotice, Screen } from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { useSessionStore } from '@/store';
import type { UserRole } from '@/types/domain';

export default function RoleSelectionScreen() {
  const completeRoleOnboarding = useSessionStore((state) => state.completeRoleOnboarding);
  const operationStatus = useSessionStore((state) => state.operationStatus);
  const sessionErrorMessage = useSessionStore((state) => state.errorMessage);
  const clearError = useSessionStore((state) => state.clearError);
  const [selectionError, setSelectionError] = useState<string | undefined>();
  const isSubmitting = operationStatus === 'loading';

  const selectInitialRole = async (role: UserRole) => {
    if (isSubmitting) {
      return;
    }

    setSelectionError(undefined);
    clearError();

    try {
      // The repository derives the UID from Firebase Auth and returns the
      // already-persisted profile if another request won the creation race.
      const profile = await completeRoleOnboarding(role);
      router.replace(profile.primaryRole === 'elderly' ? '/elderly' : '/caregiver');
    } catch {
      // The profile gate normally replaces this view for a failed write. Keep
      // a neutral fallback for the short transition before that render occurs.
      setSelectionError('Không thể lưu vai trò lúc này. Vui lòng thử lại.');
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Chọn vai trò ban đầu" />
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Bạn sẽ dùng MediCare AI như thế nào?
        </Text>
        <Text style={styles.description}>
          Vai trò này được lưu an toàn cho tài khoản của bạn và quyết định giao diện khởi đầu. Bạn chưa thể đổi
          vai trò trong phiên bản này.
        </Text>
      </View>
      <DemoModeBanner
        description="Vai trò không cấp quyền đọc dữ liệu sức khỏe của người khác. Lịch thuốc và dashboard hiện vẫn là dữ liệu minh họa."
        title="Giới hạn an toàn"
      />
      {selectionError ?? sessionErrorMessage ? (
        <SafetyNotice
          message={selectionError ?? sessionErrorMessage ?? 'Không thể lưu vai trò. Vui lòng thử lại.'}
          title="Không thể lưu vai trò"
          tone="error"
        />
      ) : null}
      {isSubmitting ? (
        <View accessibilityRole="status" style={styles.progress}>
          <ActivityIndicator accessibilityLabel="Đang lưu vai trò" color={medicareColors.primary} />
          <Text accessibilityLiveRegion="polite" style={styles.progressText}>
            Đang lưu vai trò an toàn…
          </Text>
        </View>
      ) : null}
      <View style={styles.cards}>
        <ActionCard
          accessibilityHint="Lưu vai trò người cao tuổi và mở giao diện tương ứng"
          description="Dành cho người dùng theo dõi lịch thuốc minh họa và các nhắc nhở cơ bản."
          disabled={isSubmitting}
          icon={<Text style={styles.icon}>♥</Text>}
          onPress={() => void selectInitialRole('elderly')}
          title="Tôi là người cao tuổi"
        />
        <ActionCard
          accessibilityHint="Lưu vai trò người chăm sóc và mở giao diện tương ứng"
          description="Dành cho người hỗ trợ theo dõi dashboard minh họa của chính mình."
          disabled={isSubmitting}
          icon={<Text style={styles.icon}>⌂</Text>}
          onPress={() => void selectInitialRole('caregiver')}
          title="Tôi là người chăm sóc"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: medicareSpacing.xl,
  },
  heading: {
    gap: medicareSpacing.xs,
  },
  title: {
    color: medicareColors.text,
    fontSize: medicareTypography.display,
    fontWeight: '800',
    lineHeight: 40,
  },
  description: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
  },
  cards: {
    gap: medicareSpacing.md,
  },
  progress: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: medicareSpacing.sm,
  },
  progressText: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 22,
  },
  icon: {
    color: medicareColors.primary,
    fontSize: 28,
  },
});
