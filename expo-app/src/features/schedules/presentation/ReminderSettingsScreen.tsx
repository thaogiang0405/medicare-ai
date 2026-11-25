import { useFocusEffect, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import {
  AppHeader,
  DemoModeBanner,
  PrimaryButton,
  SafetyNotice,
  Screen,
  SecondaryButton,
} from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { useMedicationManagement } from '@/features/medications/presentation/useMedicationManagement';
import { isFirestoreMedicationsFeatureEnabled } from '@/services/firebase/firestore-medication-feature';
import { isFirestoreSchedulesFeatureEnabled } from '@/services/firebase/firestore-schedule-feature';
import {
  getLocalReminderService,
  isLocalRemindersFeatureEnabled,
  type LocalReminderSyncResult,
  type LocalReminderUserSettings,
} from '@/services/notifications';
import { useSessionStore } from '@/store';

import { useMedicationSchedules } from './useMedicationSchedules';

type ReminderOperation = 'idle' | 'loading' | 'enabling' | 'syncing' | 'disabling';

function safeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Không thể đồng bộ lời nhắc trên thiết bị. Lịch thuốc của bạn không bị thay đổi.';
}

/**
 * Device-scoped reminder controls. This screen never asks for an OS permission
 * until the user presses the explicit enable button.
 */
export default function ReminderSettingsScreen() {
  const user = useSessionStore((state) => state.user);
  const localRemindersEnabled = isLocalRemindersFeatureEnabled();
  const firestoreSourcesEnabled = isFirestoreMedicationsFeatureEnabled() && isFirestoreSchedulesFeatureEnabled();
  const userId = user?.role === 'elderly' ? user.id : null;
  const featureAvailable = localRemindersEnabled && firestoreSourcesEnabled && Boolean(userId);

  // Remounting the stateful body on UID/feature changes makes a pending action
  // from a prior account unable to surface settings under the new account.
  return (
    <ReminderSettingsContent
      featureAvailable={featureAvailable}
      key={`${userId ?? 'no-elderly-user'}:${featureAvailable ? 'enabled' : 'disabled'}`}
      userId={userId}
    />
  );
}

type ReminderSettingsContentProps = Readonly<{
  userId: string | null;
  featureAvailable: boolean;
}>;

function ReminderSettingsContent({ userId, featureAvailable }: ReminderSettingsContentProps) {
  const { medications, activeUserId: medicationUserId, listStatus: medicationStatus } = useMedicationManagement();
  const { schedules, activeUserId: scheduleUserId, listStatus: scheduleStatus } = useMedicationSchedules();
  const dataReady = Boolean(
    userId
    && medicationUserId === userId
    && scheduleUserId === userId
    && medicationStatus === 'ready'
    && scheduleStatus === 'ready',
  );
  const [settings, setSettings] = useState<LocalReminderUserSettings | null>(null);
  const [lastSync, setLastSync] = useState<LocalReminderSyncResult | null>(null);
  const [operation, setOperation] = useState<ReminderOperation>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const currentUserIdRef = useRef(userId);
  const operationRef = useRef<ReminderOperation>('loading');

  const updateOperation = useCallback((nextOperation: ReminderOperation) => {
    operationRef.current = nextOperation;
    setOperation(nextOperation);
  }, []);

  useEffect(() => () => {
    requestVersion.current += 1;
  }, []);

  const refreshSettings = useCallback(async (expectedUserId = userId) => {
    if (!featureAvailable || !expectedUserId) {
      return;
    }

    const version = ++requestVersion.current;
    if (operationRef.current === 'idle') {
      updateOperation('loading');
    }

    try {
      const nextSettings = await getLocalReminderService().getUserReminderSettings(expectedUserId);

      if (version === requestVersion.current && currentUserIdRef.current === expectedUserId) {
        setSettings(nextSettings);
        setErrorMessage(null);
      }
    } catch (error) {
      if (version === requestVersion.current && currentUserIdRef.current === expectedUserId) {
        setErrorMessage(safeErrorMessage(error));
      }
    } finally {
      if (version === requestVersion.current && currentUserIdRef.current === expectedUserId) {
        if (operationRef.current === 'loading') {
          updateOperation('idle');
        }
      }
    }
  }, [featureAvailable, updateOperation, userId]);

  useFocusEffect(useCallback(() => {
    void refreshSettings();
  }, [refreshSettings]));

  const syncInput = useMemo(() => userId ? ({ userId, medications, schedules }) : null, [medications, schedules, userId]);

  const runSync = useCallback(async (kind: 'enable' | 'resync') => {
    if (!syncInput || !dataReady || operationRef.current !== 'idle') {
      return;
    }

    const expectedUserId = syncInput.userId;
    const version = ++requestVersion.current;
    updateOperation(kind === 'enable' ? 'enabling' : 'syncing');
    setErrorMessage(null);

    try {
      const service = getLocalReminderService();
      const result = kind === 'enable'
        ? await service.requestPermissionAndSync(syncInput)
        : await service.syncIfConsented(syncInput);

      if (version === requestVersion.current && currentUserIdRef.current === expectedUserId) {
        setLastSync(result);
        const nextSettings = await service.getUserReminderSettings(expectedUserId);
        if (version === requestVersion.current && currentUserIdRef.current === expectedUserId) {
          setSettings(nextSettings);
        }
      }
    } catch (error) {
      if (version === requestVersion.current && currentUserIdRef.current === expectedUserId) {
        setErrorMessage(safeErrorMessage(error));
      }
    } finally {
      if (version === requestVersion.current && currentUserIdRef.current === expectedUserId) {
        updateOperation('idle');
      }
    }
  }, [dataReady, syncInput, updateOperation]);

  const disableReminders = useCallback(async () => {
    if (!userId || operationRef.current !== 'idle') {
      return;
    }

    const expectedUserId = userId;
    const version = ++requestVersion.current;
    updateOperation('disabling');
    setErrorMessage(null);

    try {
      const result = await getLocalReminderService().disableUserReminders(expectedUserId);
      if (version === requestVersion.current && currentUserIdRef.current === expectedUserId) {
        setLastSync(null);
        const nextSettings = await getLocalReminderService().getUserReminderSettings(expectedUserId);
        if (version === requestVersion.current && currentUserIdRef.current === expectedUserId) {
          setSettings(nextSettings);
          if (result.status === 'stale') {
            setErrorMessage('Không thể xác nhận việc tắt lời nhắc. Vui lòng kiểm tra lại trạng thái.');
          }
        }
      }
    } catch (error) {
      if (version === requestVersion.current && currentUserIdRef.current === expectedUserId) {
        setErrorMessage(safeErrorMessage(error));
      }
    } finally {
      if (version === requestVersion.current && currentUserIdRef.current === expectedUserId) {
        updateOperation('idle');
      }
    }
  }, [updateOperation, userId]);

  const confirmDisable = useCallback(() => {
    Alert.alert(
      'Tắt nhắc lịch trên thiết bị?',
      'Các lời nhắc MediCare AI đang chờ của tài khoản này sẽ được hủy trên thiết bị và lựa chọn đồng ý sẽ được thu hồi. Lịch thuốc trên Firebase không bị xóa.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        { text: 'Tắt lời nhắc', style: 'destructive', onPress: () => void disableReminders() },
      ],
      { cancelable: true },
    );
  }, [disableReminders]);

  if (!featureAvailable) {
    return (
      <Screen contentStyle={styles.content}>
        <AppHeader backAccessibilityLabel="Quay lại trang chủ" onBack={() => router.replace('/elderly')} title="Cài đặt nhắc lịch" />
        <SafetyNotice
          message="Nhắc lịch cục bộ đang tắt trong cấu hình ứng dụng hoặc dữ liệu thuốc/lịch Firebase chưa được bật. Ứng dụng sẽ không yêu cầu quyền thông báo ở trạng thái này."
          title="Chưa bật nhắc lịch"
          tone="information"
        />
        <SecondaryButton label="Quay lại trang chủ" onPress={() => router.replace('/elderly')} />
      </Screen>
    );
  }

  const busy = operation !== 'idle';
  const permissionLabel = settings?.permission === 'granted'
    ? 'Đã cho phép'
    : settings?.permission === 'denied'
      ? 'Đã từ chối'
      : 'Chưa quyết định';

  return (
    <Screen contentStyle={styles.content} testID="reminder-settings-screen">
      <AppHeader
        backAccessibilityLabel="Quay lại trang chủ"
        onBack={() => router.replace('/elderly')}
        subtitle="Chỉ áp dụng cho tài khoản này trên thiết bị này"
        title="Cài đặt nhắc lịch"
      />
      <DemoModeBanner
        description="Thông báo chỉ nói rằng bạn có lời nhắc cần xem, không hiển thị tên thuốc hoặc liều trên màn hình khóa."
        title="Nhắc lịch cục bộ"
      />
      {operation === 'loading' && !settings ? (
        <View accessibilityRole="progressbar" style={styles.loading}>
          <ActivityIndicator accessibilityLabel="Đang kiểm tra lời nhắc trên thiết bị" color={medicareColors.primary} size="large" />
          <Text style={styles.loadingText}>Đang kiểm tra trạng thái trên thiết bị…</Text>
        </View>
      ) : null}
      {settings ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Trạng thái hiện tại</Text>
          <Text style={styles.detail}>Quyền thông báo: {permissionLabel}</Text>
          <Text style={styles.detail}>Lựa chọn cho tài khoản này: {settings.consented ? 'Đã bật' : 'Chưa bật'}</Text>
          <Text style={styles.detail}>Lời nhắc MediCare AI đang chờ: {settings.pendingCount}/{settings.maxPendingCount}</Text>
        </View>
      ) : null}
      {!dataReady ? (
        <SafetyNotice
          message="Đang tải thuốc và lịch đang hoạt động của tài khoản này. Bạn có thể xem trạng thái quyền, nhưng chưa thể đồng bộ lời nhắc."
          title="Đang chuẩn bị dữ liệu lịch"
          tone="information"
        />
      ) : null}
      {settings?.permission === 'denied' ? (
        <SafetyNotice
          message="Bạn đã từ chối thông báo. Hãy bật quyền Thông báo cho Expo Go hoặc MediCare AI trong Cài đặt iPhone, rồi quay lại đồng bộ."
          title="Chưa có quyền thông báo"
          tone="error"
        />
      ) : null}
      {lastSync?.status === 'capacity-limited' ? (
        <SafetyNotice
          message={`Thiết bị chỉ giữ ${lastSync.pendingCount} lời nhắc của tài khoản này trong giới hạn an toàn; ${lastSync.omittedCount} lịch xa hơn sẽ được bổ sung khi bạn mở lại ứng dụng hoặc đồng bộ lại.`}
          title="Đã giới hạn lời nhắc đang chờ"
          tone="information"
        />
      ) : null}
      {lastSync?.status === 'synced' && lastSync.desiredCount === 0 ? (
        <SafetyNotice
          message="Hiện chưa có lịch thuốc đang hoạt động trong 14 ngày tới. Khi bạn thêm hoặc bật lại lịch, ứng dụng sẽ đồng bộ sau khi mở lại hoặc bạn chọn đồng bộ."
          title="Chưa có lịch để nhắc"
          tone="information"
        />
      ) : null}
      {lastSync?.status === 'permission-denied' ? (
        <SafetyNotice
          message="Không thể tạo lời nhắc vì iPhone chưa cấp quyền thông báo."
          title="Không thể bật lời nhắc"
          tone="error"
        />
      ) : null}
      {errorMessage ? <SafetyNotice message={errorMessage} title="Không thể đồng bộ lời nhắc" tone="error" /> : null}
      <View style={styles.actions}>
        <PrimaryButton
          accessibilityHint={settings?.consented
            ? 'Đồng bộ lại lời nhắc cho lịch thuốc đang hoạt động của tài khoản này'
            : 'Yêu cầu quyền thông báo nếu cần rồi tạo lời nhắc cục bộ cho tài khoản này'}
          disabled={!dataReady || busy}
          label={operation === 'enabling'
            ? 'Đang bật lời nhắc…'
            : operation === 'syncing'
              ? 'Đang đồng bộ…'
              : settings?.consented
                ? 'Đồng bộ lại lời nhắc'
                : 'Bật nhắc lịch trên thiết bị này'}
          loading={operation === 'enabling' || operation === 'syncing'}
          onPress={() => void runSync(settings?.consented ? 'resync' : 'enable')}
        />
        {settings?.consented ? (
          <SecondaryButton
            accessibilityHint="Hủy các lời nhắc MediCare AI đang chờ của tài khoản này và thu hồi lựa chọn đồng ý trên thiết bị"
            disabled={busy}
            label={operation === 'disabling' ? 'Đang tắt lời nhắc…' : 'Tắt lời nhắc trên thiết bị này'}
            onPress={confirmDisable}
          />
        ) : null}
      </View>
      <SafetyNotice
        message="Lời nhắc được lập tối đa 14 ngày và tối đa 48 thông báo do MediCare AI quản lý. Ứng dụng chỉ làm mới khi được mở/foreground hoặc khi bạn đồng bộ; không có máy chủ gửi thông báo từ xa."
        title="Giới hạn cần biết"
        tone="information"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: medicareSpacing.lg },
  loading: { alignItems: 'center', gap: medicareSpacing.md, paddingVertical: medicareSpacing.xxl },
  loadingText: { color: medicareColors.textMuted, fontSize: medicareTypography.body, textAlign: 'center' },
  card: {
    gap: medicareSpacing.sm,
    padding: medicareSpacing.lg,
    borderWidth: 1,
    borderColor: medicareColors.border,
    borderRadius: 18,
    backgroundColor: medicareColors.surfaceElevated,
  },
  sectionTitle: {
    color: medicareColors.text,
    fontSize: medicareTypography.subheading,
    fontWeight: '800',
    lineHeight: 29,
  },
  detail: { color: medicareColors.textMuted, fontSize: medicareTypography.body, lineHeight: 25 },
  actions: { gap: medicareSpacing.md },
});
