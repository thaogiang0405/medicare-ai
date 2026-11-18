import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  AppHeader,
  DemoModeBanner,
  PrimaryButton,
  SafetyNotice,
  Screen,
  SecondaryButton,
  StatusBadge,
} from '@/components/medicare';
import {
  medicareColors,
  medicareRadius,
  medicareShadow,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';
import { isFirestoreMedicationsFeatureEnabled } from '@/services/firebase/firestore-medication-feature';
import type { Medication } from '@/types/domain';

import { useMedicationManagement } from './useMedicationManagement';

function optionalText(value: string): string {
  return value || 'Chưa cung cấp';
}

export default function MedicationDetailScreen() {
  const { medicationId } = useLocalSearchParams<{ medicationId?: string | string[] }>();
  const {
    activeUserId,
    medications,
    listStatus,
    operationStatus,
    errorMessage,
    markMedicationInactive,
  } = useMedicationManagement();
  const resolvedMedicationId = Array.isArray(medicationId) ? medicationId[0] : medicationId;
  const medication = medications.find((item) => item.id === resolvedMedicationId);
  const isUpdating = operationStatus === 'loading';
  const medicationsUseFirestore = isFirestoreMedicationsFeatureEnabled();

  const goToList = () => router.replace('/elderly/medications');

  const handleMarkInactive = async () => {
    if (!medication || isUpdating) {
      return;
    }

    try {
      await markMedicationInactive(medication.id);
      Alert.alert(
        'Đã cập nhật trạng thái',
        medicationsUseFirestore
          ? 'Thuốc được đánh dấu là đã ngừng sử dụng trong hồ sơ Firebase của bạn.'
          : 'Thuốc được đánh dấu là đã ngừng sử dụng trong chế độ trình diễn.',
      );
    } catch {
      // The store exposes a Vietnamese error in the screen below.
    }
  };

  const requestInactivation = () => {
    Alert.alert(
      'Ngừng sử dụng thuốc?',
      'Thao tác này chỉ cập nhật trạng thái quản lý trong ứng dụng. Đây không phải chỉ định ngừng thuốc của bác sĩ.',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Ngừng sử dụng', style: 'destructive', onPress: () => void handleMarkInactive() },
      ],
    );
  };

  if (!activeUserId || listStatus === 'idle' || listStatus === 'loading') {
    return <MedicationLoadingState />;
  }

  if (!medication) {
    return <MedicationMissingState detail={errorMessage} onBack={goToList} />;
  }

  return (
    <Screen contentStyle={styles.content} testID="medication-detail-screen">
      <AppHeader
        backAccessibilityLabel="Quay lại danh sách thuốc"
        onBack={goToList}
        subtitle="Thông tin bạn đã ghi nhận"
        title="Chi tiết thuốc"
      />
      <DemoModeBanner
        description={medicationsUseFirestore
          ? 'Đây là dữ liệu thuốc của hồ sơ hiện tại. Không có lịch nhắc mới được tạo hoặc cập nhật từ màn hình này.'
          : 'Đây là dữ liệu minh họa theo tài khoản hiện tại. Không có lịch nhắc mới được tạo hoặc cập nhật từ màn hình này.'}
        title={medicationsUseFirestore ? 'Thuốc trên Firebase' : 'Chế độ trình diễn'}
      />
      {errorMessage ? <SafetyNotice message={errorMessage} title="Không thể hoàn tất thao tác" tone="error" /> : null}
      <MedicationInformation medication={medication} />
      <View style={styles.actions}>
        <PrimaryButton
          accessibilityHint="Mở biểu mẫu chỉnh sửa nội dung thuốc đã ghi nhận"
          disabled={isUpdating}
          label="Chỉnh sửa"
          onPress={() =>
            router.push({
              pathname: '/elderly/medications/[medicationId]/edit',
              params: { medicationId: medication.id },
            })
          }
        />
        {medication.status === 'active' ? (
          <SecondaryButton
            accessibilityHint="Hiển thị xác nhận trước khi đánh dấu thuốc là đã ngừng sử dụng"
            disabled={isUpdating}
            label={isUpdating ? 'Đang cập nhật…' : 'Ngừng sử dụng thuốc'}
            onPress={requestInactivation}
          />
        ) : null}
      </View>
      {medication.status === 'inactive' ? (
        <SafetyNotice
          message="Thuốc vẫn được giữ trong danh sách lịch sử. Việc đánh dấu này không sửa hoặc xóa các phản hồi lịch thuốc demo."
          title="Đã ngừng sử dụng"
          tone="information"
        />
      ) : null}
      <SecondaryButton
        accessibilityHint="Quay lại danh sách tất cả thuốc"
        label="Quay lại danh sách"
        onPress={goToList}
      />
    </Screen>
  );
}

function MedicationInformation({ medication }: Readonly<{ medication: Medication }>) {
  return (
    <View accessibilityRole="summary" style={styles.card}>
      <View style={styles.cardHeader}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.45} style={styles.medicationName}>
          {medication.name}
        </Text>
        <StatusBadge status={medication.status} />
      </View>
      <MedicationField label="Hàm lượng hoặc quy cách" value={optionalText(medication.strengthText)} />
      <MedicationField label="Hướng dẫn sử dụng đã ghi nhận" value={optionalText(medication.directionsText)} />
    </View>
  );
}

function MedicationField({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View style={styles.field}>
      <Text maxFontSizeMultiplier={1.5} style={styles.fieldLabel}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={1.5} style={styles.fieldValue}>
        {value}
      </Text>
    </View>
  );
}

function MedicationLoadingState() {
  return (
    <Screen contentStyle={styles.loadingContent} scroll={false}>
      <ActivityIndicator accessibilityLabel="Đang tải chi tiết thuốc" color={medicareColors.primary} size="large" />
      <Text style={styles.loadingText}>Đang tải chi tiết thuốc…</Text>
    </Screen>
  );
}

function MedicationMissingState({ detail, onBack }: Readonly<{ detail: string | null; onBack: () => void }>) {
  return (
    <Screen contentStyle={styles.content}>
      <AppHeader backAccessibilityLabel="Quay lại danh sách thuốc" onBack={onBack} title="Không tìm thấy thuốc" />
      <SafetyNotice
        message={detail ?? 'Bản ghi không tồn tại trong danh sách thuốc của tài khoản hiện tại.'}
        title="Không thể mở chi tiết"
        tone="error"
      />
      <PrimaryButton label="Về danh sách thuốc" onPress={onBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: medicareSpacing.lg,
  },
  card: {
    gap: medicareSpacing.lg,
    padding: medicareSpacing.lg,
    borderWidth: 1,
    borderColor: medicareColors.border,
    borderRadius: medicareRadius.lg,
    backgroundColor: medicareColors.surfaceElevated,
    ...medicareShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: medicareSpacing.sm,
  },
  medicationName: {
    flex: 1,
    color: medicareColors.text,
    fontSize: medicareTypography.heading,
    fontWeight: '800',
    lineHeight: medicareTypography.lineHeightHeading,
  },
  field: {
    gap: medicareSpacing.xs,
  },
  fieldLabel: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.bodySmall,
    fontWeight: '800',
    lineHeight: 23,
  },
  fieldValue: {
    color: medicareColors.text,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
  },
  actions: {
    gap: medicareSpacing.sm,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: medicareSpacing.md,
  },
  loadingText: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
    textAlign: 'center',
  },
});
