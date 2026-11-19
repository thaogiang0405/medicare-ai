import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { router, type Href, useLocalSearchParams } from 'expo-router';

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
import { useMedicationManagement } from '@/features/medications/presentation/useMedicationManagement';
import { isFirestoreSchedulesFeatureEnabled } from '@/services/firebase/firestore-schedule-feature';
import type { MedicationSchedule } from '@/types/domain';

import {
  medicationScheduleDateRangeLabel,
  medicationScheduleRecurrenceLabel,
} from './medication-schedule-utils';
import { useMedicationSchedules } from './useMedicationSchedules';

function resolveParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function MedicationScheduleListScreen() {
  const { medicationId } = useLocalSearchParams<{ medicationId?: string | string[] }>();
  const resolvedMedicationId = resolveParam(medicationId);
  const { medications, listStatus: medicationListStatus } = useMedicationManagement();
  const {
    activeUserId,
    schedules,
    listStatus,
    operationStatus,
    errorMessage,
    reload,
    pauseSchedule,
  } = useMedicationSchedules();
  const medication = medications.find((item) => item.id === resolvedMedicationId);
  const visibleSchedules = schedules.filter((schedule) => schedule.medicationId === resolvedMedicationId);
  const schedulesUseFirestore = isFirestoreSchedulesFeatureEnabled();
  const isLoading = !activeUserId || listStatus === 'loading' || medicationListStatus === 'loading';
  const isPausing = operationStatus === 'loading';

  const goBack = () => {
    if (resolvedMedicationId) {
      router.replace({
        pathname: '/elderly/medications/[medicationId]',
        params: { medicationId: resolvedMedicationId },
      });
      return;
    }

    router.replace('/elderly/medications');
  };

  const requestPause = (schedule: MedicationSchedule) => {
    if (isPausing) {
      return;
    }

    Alert.alert(
      'Tạm dừng lịch uống?',
      'Lịch sẽ được giữ lại để xem lại. Thao tác này không thay đổi thuốc, không tạo DoseEvent và không phải chỉ định y tế.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Tạm dừng lịch',
          style: 'destructive',
          onPress: () => void pauseSchedule(schedule.id),
        },
      ],
    );
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (!resolvedMedicationId || !medication) {
    return <MedicationMissingState onBack={goBack} />;
  }

  return (
    <Screen contentStyle={styles.content} testID="medication-schedule-list-screen">
      <AppHeader
        backAccessibilityLabel="Quay lại chi tiết thuốc"
        onBack={goBack}
        subtitle={medication.name}
        title="Lịch uống thuốc"
      />
      <DemoModeBanner
        description={schedulesUseFirestore
          ? 'Lịch của bạn được lưu trong Firestore. DoseEvent bên ngoài màn hình này vẫn là dữ liệu demo, chưa được tạo từ lịch.'
          : 'Lịch chỉ được lưu tạm trong phiên hiện tại. DoseEvent bên ngoài màn hình này vẫn là dữ liệu demo độc lập.'}
        title={schedulesUseFirestore ? 'Lịch trên Firebase' : 'Chế độ trình diễn'}
      />
      <SafetyNotice
        message="Ứng dụng không tự suy luận giờ uống hoặc liều dùng. Hãy chỉ ghi lịch theo hướng dẫn đã được bạn hoặc nhân viên y tế xác nhận."
        title="Ghi nhận an toàn"
        tone="information"
      />
      {errorMessage ? (
        <SafetyNotice message={errorMessage} title="Không thể hoàn tất thao tác" tone="error" />
      ) : null}
      {medication.status === 'active' ? (
        <PrimaryButton
          accessibilityHint="Mở biểu mẫu để tạo một lịch uống thuốc mới cho thuốc đang sử dụng"
          label="Thêm lịch uống"
          onPress={() =>
            router.push({
              pathname: '/elderly/medications/[medicationId]/schedules/new',
              params: { medicationId: medication.id },
            } as unknown as Href)
          }
          testID="add-medication-schedule-button"
        />
      ) : (
        <SafetyNotice
          message="Thuốc đã được đánh dấu ngừng sử dụng nên không thể tạo lịch mới. Các lịch cũ vẫn được giữ lại để xem."
          title="Không thể thêm lịch mới"
          tone="information"
        />
      )}
      {listStatus === 'error' ? (
        <PrimaryButton label="Thử lại" onPress={() => void reload()} />
      ) : null}
      {listStatus === 'ready' && visibleSchedules.length === 0 ? (
        <View accessibilityRole="summary" style={styles.emptyState}>
          <Text accessibilityRole="header" style={styles.emptyTitle}>Chưa có lịch uống nào</Text>
          <Text style={styles.emptyDescription}>
            {medication.status === 'active'
              ? 'Bạn có thể thêm giờ và ngày lặp lại theo hướng dẫn đã có.'
              : 'Không có lịch nào được lưu cho thuốc này.'}
          </Text>
        </View>
      ) : null}
      <View style={styles.list}>
        {visibleSchedules.map((schedule) => (
          <View key={schedule.id} style={styles.scheduleCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardCopy}>
                <Text accessibilityRole="header" style={styles.timeText}>{schedule.localTime}</Text>
                <Text style={styles.recurrenceText}>{medicationScheduleRecurrenceLabel(schedule)}</Text>
              </View>
              <StatusBadge
                label={schedule.active ? 'Đang áp dụng' : 'Đã tạm dừng'}
                status={schedule.active ? 'active' : 'inactive'}
              />
            </View>
            <Text style={styles.dateText}>{medicationScheduleDateRangeLabel(schedule)}</Text>
            <Text style={styles.timeZoneText}>Múi giờ: {schedule.timeZone}</Text>
            <View style={styles.cardActions}>
              <SecondaryButton
                accessibilityHint="Mở biểu mẫu để chỉnh sửa lịch uống thuốc này"
                disabled={isPausing}
                label="Chỉnh sửa lịch"
                onPress={() =>
                  router.push({
                    pathname: '/elderly/medications/[medicationId]/schedules/[scheduleId]/edit',
                    params: { medicationId: medication.id, scheduleId: schedule.id },
                  } as unknown as Href)
                }
              />
              {schedule.active ? (
                <SecondaryButton
                  accessibilityHint="Hiển thị xác nhận trước khi tạm dừng lịch uống"
                  disabled={isPausing}
                  label={isPausing ? 'Đang cập nhật…' : 'Tạm dừng lịch'}
                  onPress={() => requestPause(schedule)}
                />
              ) : null}
            </View>
          </View>
        ))}
      </View>
      <SecondaryButton label="Quay lại chi tiết thuốc" onPress={goBack} />
    </Screen>
  );
}

function LoadingState() {
  return (
    <Screen contentStyle={styles.loadingContent} scroll={false}>
      <ActivityIndicator accessibilityLabel="Đang tải lịch uống thuốc" color={medicareColors.primary} size="large" />
      <Text style={styles.loadingText}>Đang tải lịch uống thuốc…</Text>
    </Screen>
  );
}

function MedicationMissingState({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <Screen contentStyle={styles.content}>
      <AppHeader backAccessibilityLabel="Quay lại danh sách thuốc" onBack={onBack} title="Không tìm thấy thuốc" />
      <SafetyNotice
        message="Không thể mở lịch vì thuốc không thuộc danh sách của tài khoản hiện tại."
        title="Không thể mở lịch"
        tone="error"
      />
      <PrimaryButton label="Quay lại" onPress={onBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: medicareSpacing.lg,
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
  emptyState: {
    gap: medicareSpacing.xs,
    padding: medicareSpacing.lg,
    borderWidth: 1,
    borderColor: medicareColors.border,
    borderRadius: medicareRadius.lg,
    backgroundColor: medicareColors.surfaceMuted,
  },
  emptyTitle: {
    color: medicareColors.text,
    fontSize: medicareTypography.subheading,
    fontWeight: '800',
    lineHeight: 29,
  },
  emptyDescription: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
  },
  list: {
    gap: medicareSpacing.md,
  },
  scheduleCard: {
    gap: medicareSpacing.sm,
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
  cardCopy: {
    flex: 1,
    gap: medicareSpacing.xxs,
  },
  timeText: {
    color: medicareColors.text,
    fontSize: medicareTypography.heading,
    fontWeight: '800',
    lineHeight: medicareTypography.lineHeightHeading,
  },
  recurrenceText: {
    color: medicareColors.primary,
    fontSize: medicareTypography.body,
    fontWeight: '700',
    lineHeight: medicareTypography.lineHeightBody,
  },
  dateText: {
    color: medicareColors.text,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 23,
  },
  timeZoneText: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.caption,
    lineHeight: 18,
  },
  cardActions: {
    gap: medicareSpacing.sm,
  },
});
