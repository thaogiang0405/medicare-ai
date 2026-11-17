import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ActionCard, AppHeader, DemoModeBanner, Screen } from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { useSessionStore } from '@/store';
import type { UserRole } from '@/types/domain';

export default function RoleSelectionScreen() {
  const continueAs = useSessionStore((state) => state.continueAs);
  const isLoading = useSessionStore((state) => state.isLoading);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectRole = async (role: UserRole) => {
    if (isLoading) {
      return;
    }

    setErrorMessage(null);

    try {
      await continueAs(role);
      router.replace(role === 'elderly' ? '/elderly' : '/caregiver');
    } catch {
      setErrorMessage('Không thể chọn vai trò demo. Vui lòng thử lại.');
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader onBack={() => router.back()} title="Chọn vai trò" />
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Bạn sẽ dùng MediCare AI như thế nào?
        </Text>
        <Text style={styles.description}>Bạn có thể quay lại và thử vai trò khác bất cứ lúc nào.</Text>
      </View>
      <DemoModeBanner
        description="Vai trò chỉ điều hướng giao diện demo; chưa có phân quyền hay dữ liệu Firebase."
        title="Dữ liệu mô phỏng"
      />
      <View style={styles.cards}>
        <ActionCard
          accessibilityHint="Mở trang chủ demo của người cao tuổi"
          description="Xem lịch thuốc, nhận nhắc và tự xác nhận phản hồi."
          icon={<Text style={styles.icon}>♥</Text>}
          onPress={() => void selectRole('elderly')}
          title="Tôi là người cao tuổi"
        />
        <ActionCard
          accessibilityHint="Mở bảng theo dõi demo của người chăm sóc"
          description="Theo dõi các hồ sơ đã được cấp quyền chia sẻ."
          icon={<Text style={styles.icon}>⌂</Text>}
          onPress={() => void selectRole('caregiver')}
          title="Tôi là người chăm sóc"
        />
      </View>
      {isLoading ? <ActivityIndicator color={medicareColors.primary} size="large" /> : null}
      {errorMessage ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{errorMessage}</Text> : null}
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
  icon: {
    color: medicareColors.primary,
    fontSize: 28,
  },
  error: {
    color: medicareColors.error,
    fontSize: medicareTypography.bodySmall,
    fontWeight: '600',
  },
});
