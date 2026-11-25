import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { PrimaryButton, SafetyNotice, Screen } from '@/components/medicare';
import {
  medicareColors,
  medicareRadius,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';

export default function OnboardingScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <View accessibilityElementsHidden style={styles.illustration}>
          <Text style={styles.illustrationText}>♥</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          Quản lý thuốc nhẹ nhàng, rõ ràng
        </Text>
        <Text style={styles.description}>
          MediCare AI giúp bạn xem lịch thuốc và tự ghi nhận phản hồi theo từng lần uống.
        </Text>
      </View>

      <SafetyNotice
        message="Ứng dụng hỗ trợ ghi nhận thông tin, không thay thế bác sĩ. Hãy làm theo đơn thuốc và liên hệ nhân viên y tế khi cần."
        title="Lưu ý an toàn"
        tone="warning"
      />

      <View style={styles.spacer} />
      <PrimaryButton
        accessibilityHint="Mở màn hình đăng nhập ở chế độ trình diễn"
        label="Bắt đầu"
        onPress={() => router.push('/login')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: medicareSpacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: medicareSpacing.lg,
    paddingTop: medicareSpacing.xxl,
  },
  illustration: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: medicareRadius.pill,
    backgroundColor: medicareColors.primaryContainer,
  },
  illustrationText: {
    color: medicareColors.primary,
    fontSize: 54,
  },
  title: {
    color: medicareColors.text,
    fontSize: medicareTypography.display,
    fontWeight: '800',
    lineHeight: 40,
    textAlign: 'center',
  },
  description: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
    minHeight: medicareSpacing.xxl,
  },
});
