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
import { isFirestoreMedicationsFeatureEnabled } from '@/services/firebase/firestore-medication-feature';
import { isFirestoreSchedulesFeatureEnabled } from '@/services/firebase/firestore-schedule-feature';
import { useSessionStore } from '@/store';
import { formatVietnameseTime } from '@/utils/formatters';

import { useElderlyDashboard } from './useElderlyDashboard';

function showDeferredFeature(feature: string) {
  Alert.alert('Chưa có trong lộ trình hiện tại', `${feature} sẽ được xây dựng ở milestone phù hợp.`);
}

export default function ElderlyHomeScreen() {
  const { user, doses, isLoading, errorMessage, recordResponse } = useElderlyDashboard();
  const signOut = useSessionStore((state) => state.signOut);
  const operationStatus = useSessionStore((state) => state.operationStatus);
  const authErrorMessage = useSessionStore((state) => state.errorMessage);
  const isSigningOut = operationStatus === 'loading';
  const medicationsUseFirestore = isFirestoreMedicationsFeatureEnabled();
  const schedulesUseFirestore = isFirestoreSchedulesFeatureEnabled();

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
        right={<Text style={styles.roleLabel}>Người cao tuổi</Text>}
        title={`Chào ${user?.displayName ?? 'bạn'}`}
      />
      <DemoModeBanner
        description={medicationsUseFirestore && schedulesUseFirestore
          ? 'Thuốc và lịch của bạn được lưu theo hồ sơ đã xác thực. DoseEvent và phản hồi bên dưới vẫn là dữ liệu demo; không phải hồ sơ y tế.'
          : medicationsUseFirestore
            ? 'Thuốc của bạn được lưu trong Firestore theo hồ sơ đã xác thực. Lịch uống chưa được bật và DoseEvent/phản hồi bên dưới vẫn là dữ liệu demo.'
          : 'Vai trò đã được kiểm tra từ hồ sơ của chính bạn. Lịch, thuốc và phản hồi dưới đây vẫn chỉ dùng để thử giao diện; không phải hồ sơ y tế.'}
        title={medicationsUseFirestore && schedulesUseFirestore
          ? 'Thuốc và lịch trên Firebase · DoseEvent demo'
          : medicationsUseFirestore
            ? 'Thuốc trên Firebase · DoseEvent demo'
            : 'Chế độ trình diễn'}
      />
      {errorMessage ? (
        <SafetyNotice message={errorMessage} title={medicationsUseFirestore ? 'Không thể tải thuốc' : 'Không thể tải dữ liệu demo'} tone="error" />
      ) : null}
      {authErrorMessage ? (
        <SafetyNotice message={authErrorMessage} title="Không thể hoàn tất phiên đăng nhập" tone="error" />
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
          description="Tính năng OCR chưa được tích hợp trong lộ trình hiện tại."
          icon={<Text style={styles.icon}>⌁</Text>}
          onPress={() => showDeferredFeature('Quét đơn thuốc')}
          title="Quét đơn thuốc"
        />
        <ActionCard
          accessibilityHint={medicationsUseFirestore
            ? 'Mở danh sách thuốc được lưu trong hồ sơ Firebase của tài khoản này'
            : 'Mở danh sách thuốc được lưu trong chế độ trình diễn của tài khoản này'}
          description={medicationsUseFirestore
            ? 'Xem, thêm, chỉnh sửa hoặc đánh dấu ngừng sử dụng thuốc của chính bạn. Lịch thuốc vẫn là demo.'
            : 'Xem, thêm, chỉnh sửa hoặc đánh dấu ngừng sử dụng thuốc demo.'}
          icon={<Text style={styles.icon}>☰</Text>}
          onPress={() => router.push('/elderly/medications')}
          title="Thuốc của tôi"
        />
        <ActionCard
          description="Liên kết gia đình chưa được triển khai."
          icon={<Text style={styles.icon}>⌂</Text>}
          onPress={() => showDeferredFeature('Liên hệ người thân')}
          title="Liên hệ người thân"
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
  icon: {
    color: medicareColors.primary,
    fontSize: 28,
  },
});
