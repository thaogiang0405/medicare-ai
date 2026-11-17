import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ActionCard, AppHeader, DemoModeBanner, Screen } from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import type { UserRole } from '@/types/domain';

export default function RoleSelectionScreen() {
  const selectPreview = (role: UserRole) => {
    router.replace(role === 'elderly' ? '/elderly' : '/caregiver');
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Chọn giao diện xem thử" />
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Bạn sẽ dùng MediCare AI như thế nào?
        </Text>
        <Text style={styles.description}>
          Chọn một giao diện để xem thử. Lựa chọn này không được lưu và không tạo quyền truy cập dữ liệu.
        </Text>
      </View>
      <DemoModeBanner
        description="Bạn đã đăng nhập bằng Firebase. Vai trò chỉ điều hướng giao diện mô phỏng; phân quyền sẽ được triển khai sau khi có hồ sơ người dùng an toàn."
        title="Giao diện xem thử"
      />
      <View style={styles.cards}>
        <ActionCard
          accessibilityHint="Mở giao diện xem thử của người cao tuổi"
          description="Xem lịch thuốc và các phản hồi minh họa, không phải hồ sơ y tế thật."
          icon={<Text style={styles.icon}>♥</Text>}
          onPress={() => selectPreview('elderly')}
          title="Xem giao diện người cao tuổi"
        />
        <ActionCard
          accessibilityHint="Mở giao diện xem thử của người chăm sóc"
          description="Xem dashboard minh họa, không có quyền truy cập hồ sơ của người khác."
          icon={<Text style={styles.icon}>⌂</Text>}
          onPress={() => selectPreview('caregiver')}
          title="Xem giao diện người chăm sóc"
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
  icon: {
    color: medicareColors.primary,
    fontSize: 28,
  },
});
