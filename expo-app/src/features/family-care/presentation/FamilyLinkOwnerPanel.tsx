import { useCallback, useEffect, useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';

import { SafetyNotice, SecondaryButton, TextField } from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { getFirebaseAuth } from '@/services/firebase';
import { useSessionStore } from '@/store';
import {
  approveCaregiverLink, listOwnCaregiverLinks, revokeCaregiverLink,
  validateFamilyUid, type FamilyLinkRecord,
} from '../data/family-link-repository';

export function FamilyLinkOwnerPanel({ ownerUid }: Readonly<{ ownerUid: string }>) {
  const sessionUid = useSessionStore((state) => state.user?.id);
  const role = useSessionStore((state) => state.user?.role);
  const [target, setTarget] = useState('');
  const [links, setLinks] = useState<FamilyLinkRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const authorizedOwner = Boolean(ownerUid && role === 'elderly' && sessionUid === ownerUid);

  const refresh = useCallback(async () => {
    if (!authorizedOwner) return;
    try {
      const result = await listOwnCaregiverLinks(ownerUid);
      setLinks(result);
      setLoaded(true);
      setError('');
    } catch {
      setLinks([]);
      setError('Không thể đọc danh sách liên kết. Kiểm tra mạng hoặc cấu hình Firebase.');
    }
  }, [authorizedOwner, ownerUid]);

  useEffect(() => {
    if (!authorizedOwner) return;

    // Load as an asynchronous subscription result rather than synchronously
    // dispatching React state updates in an effect. Ignore stale responses on
    // unmount or when the authenticated owner changes.
    let cancelled = false;
    void listOwnCaregiverLinks(ownerUid)
      .then((result) => {
        if (cancelled) return;
        setLinks(result);
        setLoaded(true);
        setError('');
      })
      .catch(() => {
        if (cancelled) return;
        setLinks([]);
        setLoaded(false);
        setError('Không thể đọc danh sách liên kết. Kiểm tra mạng hoặc cấu hình Firebase.');
      });

    return () => {
      cancelled = true;
    };
  }, [authorizedOwner, ownerUid]);

  const grant = () => {
    if (!authorizedOwner || busy) return;
    let caregiverUid: string;
    try {
      caregiverUid = validateFamilyUid(target);
      if (caregiverUid === ownerUid) throw new Error('Mã người chăm sóc trùng với tài khoản này.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mã không hợp lệ.');
      return;
    }
    Alert.alert(
      'Đồng ý cấp quyền xem?',
      'Chỉ đồng ý sau khi xác minh người nhận ngoài đời. Tài khoản người chăm sóc có quyền đọc TOÀN BỘ bản ghi thuốc và lịch trong Firestore (bao gồm hàm lượng, hướng dẫn, thuốc ngừng sử dụng nếu đã lưu), dù giao diện hiện chỉ hiện tên và giờ dự kiến. Dữ liệu có thể được lưu lại bên ngoài app. Người này không được sửa thuốc hoặc báo đã uống.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Tôi đồng ý cấp quyền',
          onPress: () => {
            setBusy(true);
            void approveCaregiverLink(ownerUid, caregiverUid)
              .then(async () => { setTarget(''); await refresh(); })
              .catch(() => setError('Không thể cấp quyền. Mã phải thuộc tài khoản Người chăm sóc hợp lệ và chưa từng bị thu hồi.'))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  const revoke = (caregiverUid: string) => {
    if (!authorizedOwner || busy) return;
    Alert.alert(
      'Thu hồi quyền xem?',
      'Người chăm sóc sẽ mất quyền đọc dữ liệu mới ngay khi Firebase áp dụng thay đổi. Không thể thu hồi thông tin họ đã xem trước đó. Liên kết đã thu hồi không thể kích hoạt lại trong bản thử nghiệm này.',
      [
        { text: 'Giữ liên kết', style: 'cancel' },
        {
          text: 'Thu hồi quyền',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void revokeCaregiverLink(ownerUid, caregiverUid)
              .then(refresh)
              .catch(() => setError('Không thể thu hồi quyền. Hãy thử lại khi có mạng.'))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  const shareMyUid = async () => {
    if (!authorizedOwner || getFirebaseAuth().currentUser?.uid !== ownerUid) return;
    try {
      await Share.share({
        message: `MediCare AI - mã hồ sơ người cao tuổi của tôi: ${ownerUid}\nĐây chỉ là mã để người chăm sóc nhập vào ứng dụng sau khi tôi cấp quyền. Không phải mật khẩu.`,
      });
    } catch {
      setError('Không mở được bảng chia sẻ mã hồ sơ.');
    }
  };

  if (!authorizedOwner) return null;

  return (
    <View style={{ gap: medicareSpacing.md }}>
      <Text accessibilityRole="header" style={{ color: medicareColors.text, fontSize: medicareTypography.subheading, fontWeight: '800' }}>
        Liên kết người chăm sóc
      </Text>
      <SafetyNotice
        title="Bạn quyết định ai được xem"
        message="Nhận mã tài khoản từ người chăm sóc mà bạn quen biết, kiểm tra lại trực tiếp rồi mới đồng ý. Mã tài khoản không phải mật khẩu. Không tự động cấp quyền khi chỉ dán mã."
        tone="information"
      />
      <TextField
        label="Mã tài khoản người chăm sóc"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={128}
        value={target}
        onChangeText={(value) => { setTarget(value); setError(''); }}
        placeholder="Dán mã tài khoản được gửi"
      />
      <SecondaryButton disabled={busy || !target.trim()} label="Xem và xác nhận cấp quyền" onPress={grant} />
      {error ? <SafetyNotice title="Liên kết chưa hoàn tất" message={error} tone="error" /> : null}
      <SecondaryButton disabled={busy} label="Tải lại danh sách liên kết" onPress={() => void refresh()} />
      {!loaded ? <Text style={{ color: medicareColors.textMuted }}>Danh sách liên kết chưa được tải.</Text> : null}
      {loaded && links.length === 0 ? <Text style={{ color: medicareColors.textMuted }}>Chưa có người chăm sóc nào được cấp quyền.</Text> : null}
      {links.map((link) => (
        <View key={link.caregiverUid} style={{ gap: medicareSpacing.xs }}>
          <Text selectable style={{ color: medicareColors.text }}>Mã người chăm sóc: {link.caregiverUid}</Text>
          <Text style={{ color: medicareColors.textMuted }}>
            {link.status === 'active' ? 'Đang có quyền xem thuốc và lịch' : 'Đã thu hồi quyền'}
          </Text>
          {link.status === 'active' ? (
            <SecondaryButton disabled={busy} label={`Thu hồi quyền của ${link.caregiverUid}`} onPress={() => revoke(link.caregiverUid)} />
          ) : null}
        </View>
      ))}
      {links.some((link) => link.status === 'active') ? (
        <SecondaryButton label="Gửi mã hồ sơ của tôi cho người chăm sóc" onPress={() => void shareMyUid()} />
      ) : null}
    </View>
  );
}
