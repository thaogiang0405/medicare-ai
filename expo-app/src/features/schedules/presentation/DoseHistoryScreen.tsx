import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

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
  medicareAccessibility,
  medicareColors,
  medicareRadius,
  medicareShadow,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';
import { getTodayDoseTrackingSchedules } from '@/features/elderly/presentation/elderly-dashboard-utils';
import { useMedicationManagement } from '@/features/medications/presentation/useMedicationManagement';
import { useMedicationSchedules } from '@/features/schedules/presentation/useMedicationSchedules';
import { doseHistoryRangeLabel, type DoseHistoryRange } from '@/features/schedules/domain/dose-history-repository';
import { isFirestoreMedicationsFeatureEnabled } from '@/services/firebase/firestore-medication-feature';
import { isFirestoreSchedulesFeatureEnabled } from '@/services/firebase/firestore-schedule-feature';
import type { DoseEvent } from '@/types/domain';

import { useDoseHistory } from './useDoseHistory';

const rangeOptions: readonly DoseHistoryRange[] = ['day', 'sevenDays', 'thirtyDays'];
const hcmResponseTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
});

function medicationNameFor(event: DoseEvent): string {
  return event.medicationSnapshot?.name ?? 'Thuốc đã lưu trong lịch sử';
}

function strengthFor(event: DoseEvent): string {
  return event.medicationSnapshot?.strengthText || 'Thông tin hàm lượng đã lưu';
}

function respondedTimeFor(event: DoseEvent): string {
  return event.respondedAt
    ? hcmResponseTimeFormatter.format(new Date(event.respondedAt))
    : 'Không có thời điểm phản hồi hợp lệ';
}

export default function DoseHistoryScreen() {
  const {
    enabled,
    range,
    events,
    nextCursor,
    listStatus,
    isLoadingMore,
    errorMessage,
    selectRange,
    loadMore,
    retry,
  } = useDoseHistory();
  const { medications, listStatus: medicationStatus } = useMedicationManagement();
  const { schedules, listStatus: scheduleStatus } = useMedicationSchedules();
  const [now] = useState(() => new Date());
  const usesFirestoreSchedules = isFirestoreMedicationsFeatureEnabled() && isFirestoreSchedulesFeatureEnabled();
  const todayPlans = useMemo(() => {
    if (!usesFirestoreSchedules || range !== 'day' || medicationStatus !== 'ready' || scheduleStatus !== 'ready') {
      return [];
    }

    return getTodayDoseTrackingSchedules(schedules, medications, events, now);
  }, [events, medicationStatus, medications, now, range, scheduleStatus, schedules, usesFirestoreSchedules]);
  const currentPlanEventIds = useMemo(
    () => new Set(todayPlans.flatMap((plan) => plan.event ? [plan.event.id] : [])),
    [todayPlans],
  );
  const persistedEvents = events.filter((event) => !currentPlanEventIds.has(event.id));

  if (!enabled) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader backAccessibilityLabel="Quay lại trang chủ" onBack={() => router.replace('/elderly')} title="Lịch sử uống thuốc" />
        <SafetyNotice
          message="Lịch sử chỉ dùng phản hồi tự báo đã lưu trên Firebase. Tính năng này chưa được bật trên ứng dụng hiện tại."
          title="Chưa bật lịch sử Firebase"
          tone="information"
        />
        <SecondaryButton label="Quay lại trang chủ" onPress={() => router.replace('/elderly')} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content} testID="dose-history-screen">
      <AppHeader
        backAccessibilityLabel="Quay lại trang chủ"
        onBack={() => router.replace('/elderly')}
        subtitle="Chỉ hiển thị phản hồi do bạn tự báo"
        title="Lịch sử uống thuốc"
      />
      <DemoModeBanner
        description="“Đã uống” và “Bỏ qua” không phải là xác nhận y tế. Khi không có phản hồi, ứng dụng không suy đoán quên liều."
        title="Lịch sử trên Firebase"
      />
      <View accessibilityLabel="Chọn khoảng thời gian lịch sử" accessibilityRole="radiogroup" style={styles.rangeGroup}>
        <Text accessibilityRole="header" style={styles.rangeLabel}>Khoảng xem</Text>
        <View style={styles.rangeOptions}>
          {rangeOptions.map((option) => {
            const selected = range === option;
            return (
              <Pressable
                accessibilityLabel={`Xem lịch sử ${doseHistoryRangeLabel(option)}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={option}
                onPress={() => selectRange(option)}
                style={({ pressed }) => [styles.rangeButton, selected && styles.rangeButtonSelected, pressed && styles.pressed]}>
                <Text style={[styles.rangeButtonText, selected && styles.rangeButtonTextSelected]}>
                  {doseHistoryRangeLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {listStatus === 'loading' ? (
        <View accessibilityRole="progressbar" style={styles.loading}>
          <ActivityIndicator accessibilityLabel="Đang tải lịch sử uống thuốc" color={medicareColors.primary} size="large" />
          <Text style={styles.loadingText}>Đang tải lịch sử uống thuốc…</Text>
        </View>
      ) : null}
      {listStatus === 'error' ? (
        <View style={styles.stateGroup}>
          <SafetyNotice message={errorMessage ?? 'Không thể tải lịch sử uống thuốc.'} title="Không thể tải lịch sử" tone="error" />
          <PrimaryButton accessibilityHint="Tải lại lịch sử của tài khoản hiện tại" label="Thử lại" onPress={() => void retry()} />
        </View>
      ) : null}
      {listStatus === 'ready' && range === 'day' && todayPlans.length > 0 ? (
        <View style={styles.list}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Lịch dự kiến hôm nay</Text>
          {todayPlans.map((plan) => (
            <View key={plan.eventId} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.copy}>
                  <Text style={styles.time}>{plan.schedule.localTime}</Text>
                  <Text style={styles.name}>{plan.medication.name}</Text>
                  <Text style={styles.detail}>{plan.medication.strengthText}</Text>
                </View>
                <StatusBadge status={plan.status} label={plan.event ? undefined : 'Chưa phản hồi'} />
              </View>
              <Text style={styles.detail}>
                {plan.event
                  ? `Phản hồi tự báo lúc ${respondedTimeFor(plan.event)}`
                  : plan.priorResponseEvent
                    ? `Lịch đã đổi sau phản hồi tự báo lúc ${plan.priorResponseEvent.scheduledLocalTime}. Bản ghi cũ được giữ trong lịch sử, không tạo phản hồi trùng.`
                  : 'Lịch dự kiến – chưa có phản hồi tự báo. Không đồng nghĩa với bỏ liều.'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {listStatus === 'ready' && persistedEvents.length > 0 ? (
        <View style={styles.list}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {range === 'day' ? 'Phản hồi đã lưu khác' : 'Phản hồi tự báo đã lưu'}
          </Text>
          {persistedEvents.map((event) => <DoseHistoryCard event={event} key={event.id} />)}
        </View>
      ) : null}
      {listStatus === 'ready' && events.length === 0 && todayPlans.length === 0 ? (
        <SafetyNotice
          message="Chưa có phản hồi tự báo trong khoảng thời gian này. Ứng dụng không tự đánh dấu đã uống, bỏ qua hoặc quên uống."
          title="Chưa có phản hồi"
          tone="information"
        />
      ) : null}
      {listStatus === 'ready' && nextCursor ? (
        <SecondaryButton
          accessibilityHint="Tải thêm phản hồi cũ hơn trong khoảng thời gian đang xem"
          disabled={isLoadingMore}
          label={isLoadingMore ? 'Đang tải thêm…' : 'Tải thêm lịch sử'}
          onPress={() => void loadMore()}
        />
      ) : null}
      {listStatus === 'ready' && range !== 'day' ? (
        <SafetyNotice
          message="Các ngày trước chỉ hiển thị phản hồi đã được lưu. Ứng dụng không dựng lại hoặc suy đoán những lần uống không có phản hồi từ schedule đã thay đổi."
          title="Giới hạn lịch sử"
          tone="information"
        />
      ) : null}
    </Screen>
  );
}

function DoseHistoryCard({ event }: Readonly<{ event: DoseEvent }>) {
  return (
    <View accessibilityLabel={`Phản hồi ${medicationNameFor(event)} lúc ${event.scheduledLocalTime ?? 'không rõ giờ'}`} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.copy}>
          <Text style={styles.time}>{event.scheduledLocalTime ?? '--:--'}</Text>
          <Text style={styles.name}>{medicationNameFor(event)}</Text>
          <Text style={styles.detail}>{strengthFor(event)}</Text>
        </View>
        <StatusBadge status={event.status} />
      </View>
      <Text style={styles.detail}>Ngày dự kiến: {event.scheduledLocalDate ?? 'Không xác định'}</Text>
      <Text style={styles.detail}>Phản hồi tự báo: {respondedTimeFor(event)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: medicareSpacing.lg },
  rangeGroup: { gap: medicareSpacing.xs },
  rangeLabel: {
    color: medicareColors.text,
    fontSize: medicareTypography.label,
    fontWeight: '700',
    lineHeight: 23,
  },
  rangeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: medicareSpacing.xs },
  rangeButton: {
    minHeight: medicareAccessibility.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: medicareColors.border,
    borderRadius: medicareRadius.md,
    paddingHorizontal: medicareSpacing.md,
    backgroundColor: medicareColors.surfaceElevated,
  },
  rangeButtonSelected: { borderColor: medicareColors.primary, backgroundColor: medicareColors.primaryContainer },
  rangeButtonText: { color: medicareColors.text, fontSize: medicareTypography.bodySmall, fontWeight: '700' },
  rangeButtonTextSelected: { color: medicareColors.onPrimaryContainer },
  pressed: { opacity: 0.76 },
  loading: { alignItems: 'center', gap: medicareSpacing.md, paddingVertical: medicareSpacing.xxl },
  loadingText: { color: medicareColors.textMuted, fontSize: medicareTypography.body, textAlign: 'center' },
  stateGroup: { gap: medicareSpacing.md },
  sectionTitle: {
    color: medicareColors.text,
    fontSize: medicareTypography.subheading,
    fontWeight: '800',
    lineHeight: 29,
  },
  list: { gap: medicareSpacing.md },
  card: {
    gap: medicareSpacing.sm,
    padding: medicareSpacing.lg,
    borderWidth: 1,
    borderColor: medicareColors.border,
    borderRadius: medicareRadius.lg,
    backgroundColor: medicareColors.surfaceElevated,
    ...medicareShadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: medicareSpacing.sm },
  copy: { flex: 1, gap: medicareSpacing.xxs },
  time: { color: medicareColors.primary, fontSize: medicareTypography.heading, fontWeight: '800', lineHeight: 34 },
  name: { color: medicareColors.text, fontSize: medicareTypography.subheading, fontWeight: '800', lineHeight: 29 },
  detail: { color: medicareColors.textMuted, fontSize: medicareTypography.bodySmall, lineHeight: 23 },
});
