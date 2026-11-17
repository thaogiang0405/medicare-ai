import { Alert, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  ActionCard,
  AppHeader,
  DemoModeBanner,
  DoseEventCard,
  SafetyNotice,
  Screen,
  SecondaryButton,
} from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { formatVietnameseTime } from '@/utils/formatters';

import { useElderlyDashboard } from './useElderlyDashboard';

function showDeferredFeature(feature: string) {
  Alert.alert('Chưa có trong Migration 1', `${feature} sẽ được xây dựng ở milestone phù hợp.`);
}

export default function ElderlyHomeScreen() {
  const { user, doses, isLoading, errorMessage, recordResponse } = useElderlyDashboard();

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        right={<Text style={styles.roleLabel}>Người cao tuổi</Text>}
        title={`Chào ${user?.displayName ?? 'Cô Minh'}`}
      />
      <DemoModeBanner
        description="Lịch, thuốc và phản hồi dưới đây chỉ dùng để thử giao diện; không phải hồ sơ y tế."
        title="Chế độ trình diễn"
      />
      {errorMessage ? (
        <SafetyNotice message={errorMessage} title="Không thể tải dữ liệu demo" tone="error" />
      ) : null}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Lịch thuốc hôm nay
        </Text>
        {isLoading && doses.length === 0 ? <ActivityIndicator color={medicareColors.primary} size="large" /> : null}
        {doses.map(({ event, medication: resolvedMedication }) => {
          const medication = resolvedMedication ?? {
            name: 'Thuốc demo',
            strengthText: 'Thông tin đang cập nhật',
          };

          return (
            <DoseEventCard
              key={event.id}
              medicationName={medication.name}
              reportedSkippedAction={{
                label: 'Bỏ qua',
                onPress: () => void recordResponse(event.id, 'reportedSkipped'),
              }}
              reportedTakenAction={{
                label: 'Đã uống',
                onPress: () => void recordResponse(event.id, 'reportedTaken'),
              }}
              scheduledText={`Lúc ${formatVietnameseTime(event.scheduledAt)} hôm nay`}
              snoozeAction={{
                label: 'Nhắc lại sau',
                onPress: () => void recordResponse(event.id, 'snoozed'),
              }}
              status={event.status}
              strengthText={medication.strengthText}
            />
          );
        })}
      </View>
      <SafetyNotice
        message="“Đã uống” là phản hồi do bạn tự báo. Nếu quên liều hoặc có dấu hiệu bất thường, hãy liên hệ bác sĩ hoặc dược sĩ."
        title="Ghi nhận an toàn"
        tone="information"
      />
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Thao tác nhanh
        </Text>
        <ActionCard
          description="Tính năng OCR chưa được tích hợp trong Migration 1."
          icon={<Text style={styles.icon}>⌁</Text>}
          onPress={() => showDeferredFeature('Quét đơn thuốc')}
          title="Quét đơn thuốc"
        />
        <ActionCard
          description="Danh sách thuốc đầy đủ sẽ có ở migration sau."
          icon={<Text style={styles.icon}>☰</Text>}
          onPress={() => showDeferredFeature('Thuốc của tôi')}
          title="Thuốc của tôi"
        />
        <ActionCard
          description="Liên kết gia đình chưa được triển khai."
          icon={<Text style={styles.icon}>⌂</Text>}
          onPress={() => showDeferredFeature('Liên hệ người thân')}
          title="Liên hệ người thân"
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
  icon: {
    color: medicareColors.primary,
    fontSize: 28,
  },
});
