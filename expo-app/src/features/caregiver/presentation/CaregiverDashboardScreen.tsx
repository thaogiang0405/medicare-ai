import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader, PrimaryButton, SafetyNotice, Screen, SecondaryButton, TextField } from '@/components/medicare';
import { medicareColors, medicareRadius, medicareShadow, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import {
  requestCaregiverLink, watchCaregiverConnections, watchCaregiverPlans,
  type CaregiverConnectionRecord, type CaregiverConnectionsResult, type CaregiverScheduleResult,
} from '@/features/family-care/data/family-link-repository';
import { isFamilyCareFeatureEnabled } from '@/services/firebase/family-care-feature';
import { useSessionStore } from '@/store';

function LinkedFamilyProfile({ caregiverUid, connection }: Readonly<{ caregiverUid: string; connection: CaregiverConnectionRecord }>) {
  const [result, setResult] = useState<CaregiverScheduleResult | null>(null);
  useEffect(() => {
    let live = true;
    const stop = watchCaregiverPlans(caregiverUid, connection.ownerUid, (value) => { if (live) setResult(value); });
    return () => { live = false; stop(); };
  }, [caregiverUid, connection.ownerUid]);
  return (
    <View style={[styles.section, styles.profilePanel]}>
      <Text accessibilityRole="header" style={styles.heading}>{connection.ownerDisplayName ?? 'Hồ sơ người thân'} · Chỉ xem</Text>
      {result?.status === 'loading' || !result ? <Text style={styles.detail}>Đang kiểm tra quyền và tải thuốc, lịch thuốc…</Text>
        : result.status === 'revoked' || result.status === 'error'
          ? <SafetyNotice title={result.status === 'error' ? 'Không thể tải lịch thuốc' : 'Không có quyền xem'} message={result.message ?? 'Quyền đã bị thu hồi hoặc kết nối không còn hợp lệ.'} tone="warning" />
          : <>
            <SafetyNotice title="Lịch dự kiến, không phải xác nhận y tế" message="Các mốc sau đến từ dữ liệu thuốc và lịch trên Firebase. Không thể suy đoán người thân đã uống hay bỏ qua từ việc không có phản hồi." tone="information" />
            {result.scheduleDate ? <Text style={styles.detail}>Ngày đang xem: {result.scheduleDate.slice(8, 10)}/{result.scheduleDate.slice(5, 7)}/{result.scheduleDate.slice(0, 4)} · Giờ Việt Nam</Text> : null}
            {result.medicationNames && result.medicationNames.length > 0 ? <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.heading}>Danh sách thuốc đang dùng</Text>
              {result.medicationNames.map((name, index) => <Text key={name + ':' + index} style={styles.detail}>• {name}</Text>)}
            </View> : null}
            {result.plans.length === 0 ? <Text style={styles.detail}>Hôm nay chưa có lịch thuốc đang hoạt động.</Text> : null}
            {result.plans.map((entry, index) => <View key={entry.time + ':' + index} style={styles.scheduleRow}><Text style={styles.medication}>{entry.time} · {entry.medicationName}</Text></View>)}
          </>}
    </View>
  );
}

function FamilyCareDashboardContent() {
  const user = useSessionStore((state) => state.user);
  const signOut = useSessionStore((state) => state.signOut);
  const operationStatus = useSessionStore((state) => state.operationStatus);
  const authErrorMessage = useSessionStore((state) => state.errorMessage);
  const [inviteCode, setInviteCode] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [connectionResult, setConnectionResult] = useState<CaregiverConnectionsResult>({ status: 'loading', connections: [] });
  const connectionStop = useRef<(() => void) | null>(null);
  const connectionGeneration = useRef(0);
  const isEnabled = isFamilyCareFeatureEnabled();
  const caregiverUid = user?.role === 'caregiver' ? user.id : null;

  useEffect(() => {
    if (!isEnabled || !caregiverUid) return;
    let live = true;
    const generation = ++connectionGeneration.current;
    const stop = watchCaregiverConnections(caregiverUid, (value) => {
      if (live && connectionGeneration.current === generation) setConnectionResult(value);
    });
    connectionStop.current = stop;
    return () => {
      live = false; connectionGeneration.current += 1; stop();
      if (connectionStop.current === stop) connectionStop.current = null;
    };
  }, [isEnabled, caregiverUid]);

  const submitInvite = async () => {
    if (!isEnabled || !caregiverUid || requestBusy) return;
    setRequestBusy(true); setRequestError(''); setRequestMessage('');
    try {
      await requestCaregiverLink(caregiverUid, inviteCode);
      setInviteCode('');
      setRequestMessage('Đã gửi yêu cầu. Chờ người cao tuổi kiểm tra danh tính và xác nhận; bạn chưa được xem dữ liệu.');
    } catch (cause) {
      setRequestError(cause instanceof Error ? cause.message : 'Không thể gửi yêu cầu. Kiểm tra mã mời và kết nối mạng.');
    } finally { setRequestBusy(false); }
  };

  const handleSignOut = async () => {
    connectionGeneration.current += 1; connectionStop.current?.(); connectionStop.current = null;
    setConnectionResult({ status: 'loading', connections: [] });
    try { await signOut(); router.replace('/login'); }
    catch { setRequestError('Không thể đăng xuất. Hãy thử lại.'); }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        right={<Text style={styles.roleLabel}>Người chăm sóc</Text>}
        subtitle="Theo dõi kết nối gia đình an toàn"
        title={'Chào ' + (user?.displayName ?? 'bạn')}
      />
      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Text accessibilityElementsHidden style={styles.heroIconText}>♡</Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>MEDICARE AI · FAMILY CARE</Text>
          <Text style={styles.heroTitle}>Đồng hành chăm sóc từ xa</Text>
          <Text style={styles.heroDescription}>Kết nối với người thân bằng mã mời và chỉ xem dữ liệu khi họ chủ động đồng ý.</Text>
        </View>
      </View>
      {authErrorMessage ? <SafetyNotice title="Không thể hoàn tất phiên đăng nhập" message={authErrorMessage} tone="error" /> : null}
      {isEnabled ? <>
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.heading}>Kết nối với người thân</Text>
          <SafetyNotice title="Kết nối bằng một mã" message="Nhập mã do người cao tuổi gửi. Mã chỉ dùng một lần và hết hạn sau khoảng 24 giờ. Gửi yêu cầu không cấp quyền xem; người cao tuổi phải xác nhận trước." tone="information" />
          <TextField label="Mã mời từ người cao tuổi" autoCapitalize="none" autoCorrect={false} maxLength={20}
            value={inviteCode} onChangeText={(value) => { setInviteCode(value); setRequestError(''); setRequestMessage(''); }}
            placeholder="Dán mã kết nối 20 ký tự" />
          <PrimaryButton label={requestBusy ? 'Đang gửi yêu cầu…' : 'Gửi yêu cầu kết nối'} disabled={requestBusy || !inviteCode.trim()} onPress={() => void submitInvite()} />
          {requestError ? <SafetyNotice title="Không thể gửi yêu cầu" message={requestError} tone="error" /> : null}
          {requestMessage ? <SafetyNotice title="Đã gửi yêu cầu" message={requestMessage} tone="information" /> : null}
        </View>
        <View style={[styles.section, styles.panel]}>
          <Text accessibilityRole="header" style={styles.heading}>Hồ sơ gia đình</Text>
          {connectionResult.status === 'loading' ? <Text style={styles.detail}>Đang tải danh sách kết nối…</Text>
            : connectionResult.status === 'error' ? <SafetyNotice title="Không thể tải liên kết" message={connectionResult.message ?? 'Kiểm tra mạng và quyền Firebase.'} tone="error" />
              : connectionResult.connections.length === 0 ? <Text style={styles.detail}>Chưa có hồ sơ được liên kết. Khi người cao tuổi duyệt yêu cầu, hồ sơ sẽ tự xuất hiện tại đây.</Text>
                : connectionResult.connections.map((connection) => connection.status === 'active'
                  ? <LinkedFamilyProfile key={connection.ownerUid} caregiverUid={caregiverUid ?? ''} connection={connection} />
                  : <View key={connection.ownerUid} style={styles.section}>
                    <Text style={styles.heading}>{connection.ownerDisplayName ?? 'Hồ sơ người thân'}</Text>
                    <Text style={styles.detail}>{connection.status === 'pending'
                      ? 'Đang chờ người cao tuổi xác nhận. Bạn chưa có quyền xem thuốc hoặc lịch.'
                      : connection.status === 'rejected' ? 'Yêu cầu kết nối đã bị từ chối.' : 'Quyền xem đã bị thu hồi.'}</Text>
                  </View>)}
        </View>
      </> : <SafetyNotice title="Liên kết hồ sơ chưa được kích hoạt" message="Cần kiểm thử Security Rules trên Firebase Emulator và được chủ dự án phê duyệt triển khai trước khi bật Family Care. Không hiển thị lịch minh họa như dữ liệu thật." tone="information" />}
      <SecondaryButton disabled={operationStatus === 'loading'} label={operationStatus === 'loading' ? 'Đang đăng xuất…' : 'Đăng xuất'} onPress={() => void handleSignOut()} />
    </Screen>
  );
}

export default function CaregiverDashboardScreen() {
  const uid = useSessionStore((state) => state.user?.id ?? null);
  return <FamilyCareDashboardContent key={uid ?? 'signed-out'} />;
}

const styles = StyleSheet.create({
  content: { gap: medicareSpacing.xl },
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
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: medicareSpacing.md,
    padding: medicareSpacing.lg,
    borderRadius: medicareRadius.lg,
    borderWidth: 1,
    borderColor: '#D2DFEF',
    backgroundColor: '#F0F5FB',
  },
  heroIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#E0EAF6',
  },
  heroIconText: { color: medicareColors.secondary, fontSize: 34, fontWeight: '700' },
  heroCopy: { flex: 1, gap: medicareSpacing.xxs },
  heroEyebrow: { color: medicareColors.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: medicareColors.text, fontSize: medicareTypography.label, fontWeight: '800', lineHeight: 24 },
  heroDescription: { color: medicareColors.textMuted, fontSize: medicareTypography.bodySmall, lineHeight: 22 },
  panel: {
    gap: medicareSpacing.md,
    padding: medicareSpacing.lg,
    borderRadius: medicareRadius.lg,
    borderWidth: 1,
    borderColor: medicareColors.border,
    backgroundColor: medicareColors.surfaceElevated,
    ...medicareShadow,
  },
  profilePanel: { marginTop: medicareSpacing.xs },
  heading: { color: medicareColors.text, fontSize: medicareTypography.subheading, fontWeight: '800', lineHeight: 29 },
  section: { gap: medicareSpacing.md },
  detail: { color: medicareColors.textMuted, fontSize: medicareTypography.bodySmall, lineHeight: 23 },
  scheduleRow: {
    backgroundColor: medicareColors.surface,
    borderColor: medicareColors.border,
    borderRadius: medicareRadius.md,
    borderWidth: 1,
    padding: medicareSpacing.md,
  },
  medication: { color: medicareColors.text, fontSize: medicareTypography.body, fontWeight: '700' },
});
