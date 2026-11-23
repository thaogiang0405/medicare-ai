import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { AppHeader, SafetyNotice, Screen, SecondaryButton, TextField } from '@/components/medicare';
import { medicareColors, medicareRadius, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { watchCaregiverPlans, type CaregiverScheduleResult, validateFamilyUid } from '@/features/family-care/data/family-link-repository';
import { getFirebaseAuth } from '@/services/firebase';
import { isFamilyCareFeatureEnabled } from '@/services/firebase/family-care-feature';
import { useSessionStore } from '@/store';

function FamilyCareDashboardContent() {
  const user = useSessionStore((state) => state.user);
  const signOut = useSessionStore((state) => state.signOut);
  const operationStatus = useSessionStore((state) => state.operationStatus);
  const authErrorMessage = useSessionStore((state) => state.errorMessage);
  const [ownerCode, setOwnerCode] = useState('');
  const [connectedCode, setConnectedCode] = useState<string | null>(null);
  const [result, setResult] = useState<CaregiverScheduleResult | null>(null);
  const [error, setError] = useState('');
  const unsubscribe = useRef<(() => void) | null>(null);
  const isEnabled = isFamilyCareFeatureEnabled();

  useEffect(() => () => {
    unsubscribe.current?.();
    unsubscribe.current = null;
  }, []);

  const connect = () => {
    if (!isEnabled || !user || user.role !== 'caregiver') return;
    unsubscribe.current?.();
    unsubscribe.current = null;
    setResult(null);
    setConnectedCode(null);
    setError('');
    try {
      const ownerUid = validateFamilyUid(ownerCode);
      // uid is a locator, never a grant. The listener is authorized by Rules.
      const stop = watchCaregiverPlans(user.id, ownerUid, (value) => {
        setResult(value);
      });
      unsubscribe.current = stop;
      setConnectedCode(ownerUid);
    } catch {
      setError('Không thể đọc lịch. Kiểm tra mã, đăng nhập và quyền được chủ hồ sơ cấp.');
    }
  };

  const disconnect = () => {
    unsubscribe.current?.();
    unsubscribe.current = null;
    setConnectedCode(null);
    setResult(null);
    setOwnerCode('');
    setError('');
  };

  const shareCaregiverUid = async () => {
    if (!isEnabled || !user || user.role !== 'caregiver' || getFirebaseAuth().currentUser?.uid !== user.id) return;
    try {
      await Share.share({
        message: `MediCare AI - mã tài khoản người chăm sóc của tôi: ${user.id}\nChỉ cấp quyền nếu bạn biết và tin tưởng tôi. Mã này không phải mật khẩu; bạn phải chủ động chấp thuận trong MediCare AI.`,
      });
    } catch {
      setError('Không thể mở bảng chia sẻ. Hãy thử lại trên điện thoại.');
    }
  };

  const handleSignOut = async () => {
    disconnect();
    try {
      await signOut();
      router.replace('/login');
    } catch {
      setError('Không thể đăng xuất. Hãy thử lại.');
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        right={<Text style={styles.roleLabel}>Người chăm sóc</Text>}
        title={`Chào ${user?.displayName ?? 'bạn'}`}
      />
      {authErrorMessage ? (
        <SafetyNotice title="Không thể hoàn tất phiên đăng nhập" message={authErrorMessage} tone="error" />
      ) : null}
      {isEnabled ? (
        <>
          <SafetyNotice
            title="Liên kết hồ sơ thật"
            message="Chỉ xem được dữ liệu sau khi người cao tuổi xác nhận cấp quyền trên tài khoản của họ. Bạn không thể chỉnh sửa thuốc hoặc tự báo đã uống."
            tone="information"
          />
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.heading}>Bước 1 · Gửi mã người chăm sóc</Text>
            <Text selectable style={styles.code}>{user?.id ?? ''}</Text>
            <SecondaryButton label="Chia sẻ mã người chăm sóc" onPress={() => void shareCaregiverUid()} />
            <Text style={styles.detail}>Người cao tuổi nhập mã trên, kiểm tra đúng người rồi chọn đồng ý cấp quyền xem.</Text>
          </View>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.heading}>Bước 2 · Mở lịch đã được cấp quyền</Text>
            <TextField
              label="Mã hồ sơ người cao tuổi"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={128}
              placeholder="Dán mã hồ sơ do người cao tuổi gửi"
              value={ownerCode}
              onChangeText={(value) => { setOwnerCode(value); setError(''); }}
            />
            <SecondaryButton label={connectedCode ? 'Kết nối lại để tải dữ liệu mới' : 'Xem lịch người thân'} disabled={!ownerCode.trim()} onPress={connect} />
            {connectedCode ? <SecondaryButton label="Đóng lịch người thân" onPress={disconnect} /> : null}
            {error ? <SafetyNotice title="Không thể kết nối" message={error} tone="error" /> : null}
          </View>
          {result ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.heading}>Lịch thuốc người thân · Chỉ xem</Text>
              {result.status === 'loading' ? (
                <Text style={styles.detail}>Đang kiểm tra quyền và tải thuốc, lịch thuốc…</Text>
              ) : result.status === 'revoked' || result.status === 'error' ? (
                <SafetyNotice
                  title="Không có quyền xem"
                  message={result.message ?? 'Quyền đã bị thu hồi hoặc kết nối không còn hợp lệ.'}
                  tone="warning"
                />
              ) : (
                <>
                  <SafetyNotice
                    title="Lịch dự kiến, không phải xác nhận y tế"
                    message="Các mốc sau đến từ dữ liệu thuốc và lịch trên Firebase. Không thể suy đoán người thân đã uống hay bỏ qua từ việc không có phản hồi."
                    tone="information"
                  />
                  {result.medicationNames && result.medicationNames.length > 0 ? (
                    <View style={styles.section}>
                      <Text accessibilityRole="header" style={styles.heading}>Danh sách thuốc đang dùng</Text>
                      {result.medicationNames.map((name, index) => (
                        <Text key={name + ':' + index} style={styles.detail}>• {name}</Text>
                      ))}
                    </View>
                  ) : null}
                  {result.plans.length === 0 ? <Text style={styles.detail}>Hôm nay chưa có lịch thuốc đang hoạt động.</Text> : null}
                  {result.plans.map((entry, index) => (
                    <View key={entry.time + ':' + index} style={styles.scheduleRow}>
                      <Text style={styles.medication}>{entry.time} · {entry.medicationName}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          ) : null}
        </>
      ) : (
        <SafetyNotice
          title="Liên kết hồ sơ chưa được kích hoạt"
          message="Cần kiểm thử Security Rules trên Firebase Emulator và được chủ dự án phê duyệt triển khai trước khi bật Family Care. Không hiển thị lịch minh họa như dữ liệu thật."
          tone="information"
        />
      )}
      <SecondaryButton
        disabled={operationStatus === 'loading'}
        label={operationStatus === 'loading' ? 'Đang đăng xuất…' : 'Đăng xuất'}
        onPress={() => void handleSignOut()}
      />
    </Screen>
  );
}

export default function CaregiverDashboardScreen() {
  const uid = useSessionStore((state) => state.user?.id ?? null);
  // Remount to clear sensitive caregiver data synchronously on UID switch.
  return <FamilyCareDashboardContent key={uid ?? 'signed-out'} />;
}

const styles = StyleSheet.create({
  content: { gap: medicareSpacing.xl },
  roleLabel: { color: medicareColors.primary, fontSize: medicareTypography.caption, fontWeight: '700' },
  heading: { color: medicareColors.text, fontSize: medicareTypography.subheading, fontWeight: '800' },
  section: { gap: medicareSpacing.md },
  detail: { color: medicareColors.textMuted, fontSize: medicareTypography.bodySmall, lineHeight: 22 },
  code: { color: medicareColors.text, fontSize: medicareTypography.bodySmall, lineHeight: 22 },
  scheduleRow: {
    borderWidth: 1, borderColor: medicareColors.border, borderRadius: medicareRadius.md,
    padding: medicareSpacing.md, backgroundColor: medicareColors.surfaceElevated,
  },
  medication: { color: medicareColors.text, fontSize: medicareTypography.label, fontWeight: '700' },
});
