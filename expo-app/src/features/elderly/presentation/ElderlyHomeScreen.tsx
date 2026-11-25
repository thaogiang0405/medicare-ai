import { Alert, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useRef, useState } from 'react';

import {
  ActionCard,
  AppHeader,
  DemoModeBanner,
  DoseEventCard,
  MedicationScheduleCard,
  SafetyNotice,
  Screen,
  SecondaryButton,
} from '@/components/medicare';
import { medicareColors, medicareRadius, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { medicationScheduleRecurrenceLabel } from '@/features/schedules/presentation/medication-schedule-utils';
import { isFamilyCareFeatureEnabled } from '@/services/firebase/family-care-feature';
import { FamilyLinkOwnerPanel } from '@/features/family-care/presentation/FamilyLinkOwnerPanel';
import { isPrescriptionOcrFeatureEnabled } from '@/features/prescriptions';
import { useSessionStore } from '@/store';
import type { PersistedDoseResponseStatus } from '@/types/domain';
import { formatVietnameseTime } from '@/utils/formatters';

import { buildTodayScheduleSpeech } from './today-schedule-speech';
import { TodayScheduleSpeechButton } from './TodayScheduleSpeechButton';
import { useElderlyDashboard } from './useElderlyDashboard';

export default function ElderlyHomeScreen() {
  const {
    user,
    dashboardMode,
    medicationsFeatureEnabled,
    schedulesFeatureEnabled,
    usesFirestoreDoseTracking,
    doses,
    medicationSchedules,
    doseTrackingSchedules,
    isLoading,
    errorMessage,
    retryDashboard,
    recordResponse,
    recordDoseResponse,
    isRecordingDoseResponse,
    localRemindersFeatureEnabled,
    localReminderStatus,
    enableLocalReminders,
  } = useElderlyDashboard();
  const signOut = useSessionStore((state) => state.signOut);
  const operationStatus = useSessionStore((state) => state.operationStatus);
  const authErrorMessage = useSessionStore((state) => state.errorMessage);
  const isSigningOut = operationStatus === 'loading';
  const usesFirestoreSchedules = dashboardMode === 'firestore-schedules';
  const prescriptionOcrFeatureEnabled = isPrescriptionOcrFeatureEnabled();
  const [pendingDoseResponseId, setPendingDoseResponseId] = useState<string | null>(null);
  const pendingDoseResponseRef = useRef<string | null>(null);

  const todaySpeech = user?.id && usesFirestoreSchedules && !isLoading && !errorMessage && !isSigningOut
    ? buildTodayScheduleSpeech(usesFirestoreDoseTracking ? doseTrackingSchedules : medicationSchedules)
    : '';

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch {
      // The session store exposes a safe localized error below.
    }
  };

  const confirmDoseResponse = (
    item: (typeof doseTrackingSchedules)[number],
    status: PersistedDoseResponseStatus,
  ) => {
    if (!recordDoseResponse || !item.canRespond || isRecordingDoseResponse || pendingDoseResponseRef.current) {
      return;
    }

    const actionLabel = status === 'reportedTaken' ? 'Đã uống' : 'Bỏ qua';
    const clearPending = () => {
      if (pendingDoseResponseRef.current === item.eventId) {
        pendingDoseResponseRef.current = null;
      }
      setPendingDoseResponseId((current) => current === item.eventId ? null : current);
    };
    pendingDoseResponseRef.current = item.eventId;
    setPendingDoseResponseId(item.eventId);

    Alert.alert(
      'Xác nhận phản hồi tự báo',
      `Bạn sắp ghi nhận “${actionLabel}” cho lần uống lúc ${item.schedule.localTime}. Phản hồi này chỉ do bạn tự báo, sẽ được lưu một lần và không thể sửa hoặc xóa trên ứng dụng.`,
      [
        { text: 'Hủy', style: 'cancel', onPress: clearPending },
        {
          text: actionLabel,
          onPress: () => {
            void Promise.resolve(recordDoseResponse(item, status))
              .catch(() => undefined)
              .finally(clearPending);
          },
        },
      ],
      { cancelable: true, onDismiss: clearPending },
    );
  };

  const dashboardBanner = usesFirestoreSchedules
    ? usesFirestoreDoseTracking
      ? {
        title: 'Lịch thuốc và phản hồi trên Firebase',
        description: 'Bạn có thể tự báo Đã uống hoặc Bỏ qua sau giờ dự kiến. Đây không phải xác nhận y tế.',
      }
      : {
      title: 'Lịch thuốc trên Firebase',
      description: 'Lịch hôm nay là kế hoạch từ hồ sơ đã xác thực. DoseEvent, phản hồi uống thuốc và nhắc lại chưa được tạo từ lịch này.',
      }
    : medicationsFeatureEnabled
      ? {
        title: 'Thuốc trên Firebase · Lịch demo',
        description: 'Thuốc của bạn được lưu trong Firestore theo hồ sơ đã xác thực. Lịch hôm nay và phản hồi uống thuốc bên dưới vẫn là dữ liệu demo.',
      }
      : schedulesFeatureEnabled
        ? {
          title: 'Chế độ trình diễn',
          description: 'Lịch Firebase chỉ được dùng khi cả Thuốc và Lịch thuốc đều được bật. Nội dung bên dưới hiện là dữ liệu demo.',
        }
        : {
          title: 'Chế độ trình diễn',
          description: 'Vai trò đã được kiểm tra từ hồ sơ của chính bạn. Lịch, thuốc và phản hồi dưới đây chỉ dùng để thử giao diện; không phải hồ sơ y tế.',
        };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        right={<Text style={styles.roleLabel}>Người cao tuổi</Text>}
        subtitle="Cùng bạn chăm sóc sức khỏe mỗi ngày"
        title={`Chào ${user?.displayName ?? 'bạn'}`}
      />
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeIcon}>
          <Text accessibilityElementsHidden style={styles.welcomeIconText}>♥</Text>
        </View>
        <View style={styles.welcomeCopy}>
          <Text style={styles.welcomeEyebrow}>MEDICARE AI · CHĂM SÓC MỖI NGÀY</Text>
          <Text style={styles.welcomeTitle}>Thuốc đúng giờ, an tâm mỗi ngày</Text>
          <Text style={styles.welcomeDescription}>Xem lịch uống, quản lý thuốc và nhắc nhở trong một nơi dễ theo dõi.</Text>
        </View>
      </View>
      <DemoModeBanner description={dashboardBanner.description} title={dashboardBanner.title} />
      {errorMessage ? (
        <View style={styles.errorGroup}>
          <SafetyNotice
            message={errorMessage}
            title={usesFirestoreDoseTracking ? 'Không thể tải lịch hoặc phản hồi' : usesFirestoreSchedules ? 'Không thể tải lịch thuốc' : 'Không thể tải dữ liệu demo'}
            tone="error"
          />
          <SecondaryButton
            accessibilityHint="Tải lại dữ liệu lịch thuốc của tài khoản hiện tại"
            label={usesFirestoreSchedules ? 'Thử tải lại lịch thuốc' : 'Thử tải lại dữ liệu demo'}
            onPress={retryDashboard}
          />
        </View>
      ) : null}
      {authErrorMessage ? (
        <SafetyNotice message={authErrorMessage} title="Không thể hoàn tất phiên đăng nhập" tone="error" />
      ) : null}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Lịch thuốc hôm nay
        </Text>
        {todaySpeech ? <TodayScheduleSpeechButton key={`${user?.id ?? 'anonymous'}:${todaySpeech}`} message={todaySpeech} /> : null}
        {isLoading ? <ActivityIndicator color={medicareColors.primary} size="large" /> : null}
        {!isLoading && !errorMessage && usesFirestoreSchedules && medicationSchedules.length === 0 ? (
          <SafetyNotice
            message="Hôm nay chưa có lịch thuốc đang hoạt động. Bạn có thể tạo lịch trong mục Thuốc của tôi."
            title="Chưa có lịch thuốc hôm nay"
            tone="information"
          />
        ) : null}
        {!isLoading && !errorMessage && usesFirestoreDoseTracking ? doseTrackingSchedules.map((item) => (
          <MedicationScheduleCard
            key={item.schedule.id}
            doseStatus={item.status}
            localTime={item.schedule.localTime}
            medicationName={item.medication.name}
            recurrenceText={medicationScheduleRecurrenceLabel(item.schedule)}
            responseActions={{
              canRespond: item.canRespond && pendingDoseResponseId === null,
              isSubmitting: isRecordingDoseResponse,
              blockedMessage: item.priorResponseEvent
                ? `Đã có phản hồi tự báo lúc ${item.priorResponseEvent.scheduledLocalTime}; lịch sử được giữ nguyên sau khi lịch đổi giờ.`
                : undefined,
              onReportTaken: () => confirmDoseResponse(item, 'reportedTaken'),
              onReportSkipped: () => confirmDoseResponse(item, 'reportedSkipped'),
            }}
            strengthText={item.medication.strengthText}
            testID={`dose-tracking-schedule-${item.schedule.id}`}
          />
        )) : null}
        {!isLoading && !errorMessage && usesFirestoreSchedules && !usesFirestoreDoseTracking ? medicationSchedules.map(({ schedule, medication }) => (
          <MedicationScheduleCard
            key={schedule.id}
            localTime={schedule.localTime}
            medicationName={medication.name}
            recurrenceText={medicationScheduleRecurrenceLabel(schedule)}
            strengthText={medication.strengthText}
            testID={`medication-schedule-${schedule.id}`}
          />
        )) : null}
        {!isLoading && !errorMessage && !usesFirestoreSchedules && doses.length === 0 ? (
          <SafetyNotice
            message="Hôm nay chưa có lịch demo để hiển thị."
            title="Chưa có lịch demo hôm nay"
            tone="information"
          />
        ) : null}
        {!isLoading && !errorMessage && !usesFirestoreSchedules ? doses.map(({ event, medication: resolvedMedication }) => {
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
                onPress: () => void recordResponse?.(event.id, 'reportedSkipped'),
              }}
              reportedTakenAction={{
                label: 'Đã uống',
                onPress: () => void recordResponse?.(event.id, 'reportedTaken'),
              }}
              scheduledText={`Lúc ${formatVietnameseTime(event.scheduledAt)} hôm nay`}
              snoozeAction={{
                label: 'Nhắc lại sau',
                onPress: () => void recordResponse?.(event.id, 'snoozed'),
              }}
              status={event.status}
              strengthText={medication.strengthText}
            />
          );
        }) : null}
      </View>
      <SafetyNotice
        message={usesFirestoreDoseTracking
          ? '“Đã uống” và “Bỏ qua” là phản hồi do bạn tự báo. Ứng dụng không tự xác nhận việc uống thuốc và chưa có cảnh báo y tế.'
          : usesFirestoreSchedules
            ? 'Đây là lịch dự kiến. Ứng dụng chưa ghi nhận bạn đã uống thuốc, chưa tự tạo DoseEvent và chưa gửi thông báo.'
          : '“Đã uống” là phản hồi do bạn tự báo. Nếu quên liều hoặc có dấu hiệu bất thường, hãy liên hệ bác sĩ hoặc dược sĩ.'}
        title={usesFirestoreDoseTracking ? 'Phản hồi tự báo' : usesFirestoreSchedules ? 'Giới hạn hiện tại' : 'Ghi nhận an toàn'}
        tone="information"
      />
      {usesFirestoreSchedules && localRemindersFeatureEnabled ? (
        <View style={styles.reminderGroup}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Nhắc lịch trên thiết bị này
          </Text>
          <SafetyNotice
            message="Chỉ bật khi bạn đồng ý. Thông báo không hiển thị tên thuốc trên màn hình khóa và có thể bị trễ khi thiết bị hoặc ứng dụng chưa đồng bộ."
            title="Nhắc lịch cục bộ"
            tone="information"
          />
          {localReminderStatus === 'permission-denied' ? (
            <SafetyNotice
              message="Bạn chưa cho phép thông báo. Hãy bật quyền Thông báo cho Expo Go hoặc MediCare AI trong Cài đặt để thử lại."
              title="Chưa có quyền thông báo"
              tone="error"
            />
          ) : null}
          {localReminderStatus === 'error' ? (
            <SafetyNotice
              message="Không thể đồng bộ lời nhắc trên thiết bị. Lịch thuốc và phản hồi uống thuốc vẫn không bị thay đổi."
              title="Không thể đồng bộ lời nhắc"
              tone="error"
            />
          ) : null}
          {localReminderStatus === 'capacity-limited' ? (
            <SafetyNotice
              message="Thiết bị đang giữ giới hạn an toàn cho lời nhắc gần nhất. Mở Cài đặt nhắc lịch để xem trạng thái và đồng bộ lại khi cần."
              title="Đã giới hạn lời nhắc đang chờ"
              tone="information"
            />
          ) : null}
          <SecondaryButton
            accessibilityHint="Yêu cầu quyền thông báo nếu cần, rồi tạo lời nhắc cục bộ cho lịch thuốc đang hoạt động"
            disabled={isLoading || localReminderStatus === 'syncing'}
            label={localReminderStatus === 'synced' || localReminderStatus === 'capacity-limited'
              ? 'Đồng bộ lại lời nhắc'
              : localReminderStatus === 'syncing'
                ? 'Đang đồng bộ…'
                : 'Bật nhắc lịch trên thiết bị này'}
            onPress={() => void enableLocalReminders()}
          />
        </View>
      ) : null}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Thao tác nhanh
        </Text>
        <ActionCard
          accessibilityHint={prescriptionOcrFeatureEnabled
            ? 'Mở màn hình quét đơn thuốc để chụp, kiểm tra và xác nhận trước khi lưu thuốc'
            : 'Mở chức năng dán chữ từ Live Text miễn phí, kiểm tra và lưu thông tin thuốc'}
          description={prescriptionOcrFeatureEnabled
            ? 'Chụp hoặc chọn tối đa 3 trang đơn thuốc, kiểm tra kết quả rồi xác nhận từng thuốc.'
            : 'Dán văn bản nhận dạng từ ảnh bằng Live Text trên iPhone và kiểm tra trước khi lưu. Không dùng API trả phí.'}
          icon={<Text style={styles.icon}>⌁</Text>}
          onPress={() => router.push('/elderly/prescription-ocr')}
          title="Quét đơn thuốc"
        />
        <ActionCard
          accessibilityHint="Quét chữ in trên bao bì thuốc với OCR miễn phí và xác nhận tên, hàm lượng trước khi lưu"
          description="Đọc chữ trên hộp/vỉ thuốc bằng OCR cục bộ; không xác minh viên thuốc qua màu sắc hoặc hình dạng."
          icon={<Text style={styles.icon}>▣</Text>}
          onPress={() => router.push('/elderly/medication-package')}
          title="Quét vỏ hộp thuốc"
        />
        <ActionCard
          accessibilityHint={medicationsFeatureEnabled
            ? 'Mở danh sách thuốc được lưu trong hồ sơ Firebase của tài khoản này'
            : 'Mở danh sách thuốc được lưu trong chế độ trình diễn của tài khoản này'}
          description={usesFirestoreSchedules
            ? 'Xem thuốc và tạo, chỉnh sửa hoặc tạm dừng lịch uống của chính bạn.'
            : medicationsFeatureEnabled
              ? 'Xem, thêm, chỉnh sửa hoặc đánh dấu ngừng sử dụng thuốc của chính bạn. Lịch hôm nay vẫn là demo.'
              : 'Xem, thêm, chỉnh sửa hoặc đánh dấu ngừng sử dụng thuốc demo.'}
          icon={<Text style={styles.icon}>☰</Text>}
          onPress={() => router.push('/elderly/medications')}
          title="Thuốc của tôi"
        />
        <ActionCard
          accessibilityHint="Mở các phản hồi tự báo đã lưu cho tài khoản hiện tại"
          description={usesFirestoreDoseTracking
            ? 'Xem phản hồi tự báo theo hôm nay, 7 ngày hoặc 30 ngày gần đây.'
            : 'Lịch sử phản hồi sẽ sẵn sàng khi tính năng DoseEvent Firebase được bật.'}
          icon={<Text style={styles.icon}>◷</Text>}
          onPress={() => router.push('/elderly/dose-history')}
          title="Lịch sử uống thuốc"
        />
        <ActionCard
          accessibilityHint="Mở cài đặt lời nhắc lịch thuốc trên thiết bị này"
          description={localRemindersFeatureEnabled && usesFirestoreSchedules
            ? 'Bật, tắt hoặc đồng bộ lời nhắc cục bộ chỉ cho tài khoản này trên thiết bị này.'
            : 'Nhắc lịch cục bộ hiện chưa được bật trong cấu hình ứng dụng.'}
          icon={<Text style={styles.icon}>⌁</Text>}
          onPress={() => router.push('/elderly/reminder-settings')}
          title="Cài đặt nhắc lịch"
        />
        {isFamilyCareFeatureEnabled() && user?.role === 'elderly' && user.id ? (
          <FamilyLinkOwnerPanel key={user.id} ownerUid={user.id} />
        ) : (
          <SafetyNotice
            title="Family Care chưa bật"
            message="Liên kết người chăm sóc chỉ có trong bản PR #7 khi Firebase staging và Security Rules đã được kiểm thử, phê duyệt. Không cần bấm Liên hệ người thân; tính năng chưa được kích hoạt ở cấu hình này."
            tone="information"
          />
        )}
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
    overflow: 'hidden',
    color: medicareColors.primary,
    backgroundColor: medicareColors.primaryContainer,
    borderRadius: 999,
    paddingHorizontal: medicareSpacing.sm,
    paddingVertical: medicareSpacing.xs,
    fontSize: medicareTypography.caption,
    fontWeight: '800',
  },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: medicareSpacing.md,
    padding: medicareSpacing.lg,
    borderRadius: medicareRadius.lg,
    borderWidth: 1,
    borderColor: '#CBE8DE',
    backgroundColor: '#E8F5F0',
  },
  welcomeIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#D2EBE2',
  },
  welcomeIconText: {
    color: medicareColors.primary,
    fontSize: 30,
    fontWeight: '700',
  },
  welcomeCopy: {
    flex: 1,
    gap: medicareSpacing.xxs,
  },
  welcomeEyebrow: {
    color: medicareColors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  welcomeTitle: {
    color: medicareColors.text,
    fontSize: medicareTypography.label,
    fontWeight: '800',
    lineHeight: 24,
  },
  welcomeDescription: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 22,
  },
  section: {
    gap: medicareSpacing.md,
  },
  errorGroup: {
    gap: medicareSpacing.sm,
  },
  reminderGroup: {
    gap: medicareSpacing.md,
  },
  sectionTitle: {
    color: medicareColors.text,
    fontSize: medicareTypography.subheading,
    fontWeight: '800',
    letterSpacing: -0.25,
    lineHeight: 29,
  },
  icon: {
    color: medicareColors.primary,
    fontSize: 28,
  },
});
