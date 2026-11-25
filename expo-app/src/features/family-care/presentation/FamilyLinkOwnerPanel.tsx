import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';

import { SafetyNotice, SecondaryButton } from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { useSessionStore } from '@/store';
import {
  approvePendingCaregiverLink, createFamilyInvite, listOwnCaregiverLinks,
  rejectPendingCaregiverLink, revokeCaregiverLink, type FamilyLinkRecord,
} from '../data/family-link-repository';

export function FamilyLinkOwnerPanel({ ownerUid }: Readonly<{ ownerUid: string }>) {
  const sessionUser = useSessionStore((state) => state.user);
  const sessionUid = sessionUser?.id;
  const role = sessionUser?.role;
  const [inviteCode, setInviteCode] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState<Date | null>(null);
  const [links, setLinks] = useState<FamilyLinkRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadedForOwnerUid, setLoadedForOwnerUid] = useState<string | null>(null);
  const [errorForOwnerUid, setErrorForOwnerUid] = useState<string | null>(null);
  const listRequestGeneration = useRef(0);
  const authorizedOwner = Boolean(ownerUid && role === 'elderly' && sessionUid === ownerUid);
  const visibleLinks = loadedForOwnerUid === ownerUid ? links : [];
  const hasLoadedLinks = loadedForOwnerUid === ownerUid && loaded;
  const visibleError = errorForOwnerUid === ownerUid ? error : '';
  const updateError = useCallback((message: string) => { setError(message); setErrorForOwnerUid(ownerUid); }, [ownerUid]);

  const refresh = useCallback(async () => {
    if (!authorizedOwner) return;
    const generation = ++listRequestGeneration.current;
    try {
      const result = await listOwnCaregiverLinks(ownerUid);
      if (generation !== listRequestGeneration.current) return;
      setLinks(result); setLoaded(true); setLoadedForOwnerUid(ownerUid); updateError('');
    } catch {
      if (generation !== listRequestGeneration.current) return;
      setLinks([]); setLoaded(false); setLoadedForOwnerUid(ownerUid);
      updateError('Không thể đọc danh sách yêu cầu. Kiểm tra mạng hoặc cấu hình Firebase.');
    }
  }, [authorizedOwner, ownerUid, updateError]);

  useEffect(() => {
    if (!authorizedOwner) return;
    let cancelled = false;
    const generation = ++listRequestGeneration.current;
    void listOwnCaregiverLinks(ownerUid).then((result) => {
      if (cancelled || generation !== listRequestGeneration.current) return;
      setLinks(result); setLoaded(true); setLoadedForOwnerUid(ownerUid); updateError('');
    }).catch(() => {
      if (cancelled || generation !== listRequestGeneration.current) return;
      setLinks([]); setLoaded(false); setLoadedForOwnerUid(ownerUid);
      updateError('Không thể đọc danh sách yêu cầu. Kiểm tra mạng hoặc cấu hình Firebase.');
    });
    return () => { cancelled = true; listRequestGeneration.current += 1; };
  }, [authorizedOwner, ownerUid, updateError]);

  const createAndShareInvite = async () => {
    if (!authorizedOwner || busy) return;
    setBusy(true); updateError('');
    try {
      const invitation = await createFamilyInvite(ownerUid);
      setInviteCode(invitation.code); setInviteExpiresAt(invitation.expiresAt);
      try {
        await Share.share({
          message: 'MediCare AI - mã kết nối người cao tuổi của tôi: ' + invitation.code
            + '\nMã chỉ gửi được một yêu cầu, hết hạn lúc ' + invitation.expiresAt.toLocaleString('vi-VN')
            + '. Sau khi gửi yêu cầu, tôi sẽ kiểm tra danh tính và xác nhận trong ứng dụng.',
        });
      } catch {
        updateError('Đã tạo mã mời. Bạn có thể sao chép mã đang hiển thị bên dưới để gửi cho người chăm sóc.');
      }
    } catch (cause) {
      updateError(cause instanceof Error ? cause.message : 'Không thể tạo mã kết nối. Hãy thử lại khi có mạng.');
    } finally { setBusy(false); }
  };

  const approve = (link: FamilyLinkRecord) => {
    if (!authorizedOwner || busy) return;
    Alert.alert(
      'Xác nhận người chăm sóc?',
      'Bạn đang cấp quyền cho ' + (link.caregiverDisplayName ?? 'Người chăm sóc') + ' (UID: ' + link.caregiverUid
        + '). Tài khoản này có thể đọc toàn bộ trường trong các bản ghi thuốc và lịch ĐANG HOẠT ĐỘNG trên Firestore, gồm hàm lượng và hướng dẫn dùng. Giao diện chỉ hiện tên thuốc và giờ dự kiến. Người chăm sóc không được sửa thuốc hoặc báo đã uống. Chỉ đồng ý nếu bạn xác minh đúng người.',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Tôi đồng ý cấp quyền', onPress: () => {
          setBusy(true);
          void approvePendingCaregiverLink(ownerUid, link.caregiverUid).then(refresh)
            .catch((cause) => updateError(cause instanceof Error ? cause.message : 'Không thể cấp quyền. Hãy tải lại yêu cầu và thử lại.'))
            .finally(() => setBusy(false));
        } },
      ],
    );
  };

  const reject = (link: FamilyLinkRecord) => {
    if (!authorizedOwner || busy) return;
    Alert.alert('Từ chối yêu cầu kết nối?',
      'Yêu cầu của ' + (link.caregiverDisplayName ?? link.caregiverUid) + ' sẽ bị từ chối. Mã mời đã dùng không thể sử dụng lại.',
      [
        { text: 'Quay lại', style: 'cancel' },
        { text: 'Từ chối yêu cầu', style: 'destructive', onPress: () => {
          setBusy(true);
          void rejectPendingCaregiverLink(ownerUid, link.caregiverUid).then(refresh)
            .catch((cause) => updateError(cause instanceof Error ? cause.message : 'Không thể từ chối yêu cầu. Hãy thử lại.'))
            .finally(() => setBusy(false));
        } },
      ],
    );
  };

  const revoke = (caregiverUid: string) => {
    if (!authorizedOwner || busy) return;
    Alert.alert('Thu hồi quyền xem?',
      'Người chăm sóc sẽ mất quyền đọc dữ liệu mới ngay khi Firebase áp dụng thay đổi. Không thể thu hồi thông tin họ đã xem trước đó. Liên kết đã thu hồi không thể kích hoạt lại trong bản thử nghiệm này.',
      [
        { text: 'Giữ liên kết', style: 'cancel' },
        { text: 'Thu hồi quyền', style: 'destructive', onPress: () => {
          setBusy(true);
          void revokeCaregiverLink(ownerUid, caregiverUid).then(refresh)
            .catch(() => updateError('Không thể thu hồi quyền. Hãy thử lại khi có mạng.'))
            .finally(() => setBusy(false));
        } },
      ],
    );
  };

  if (!authorizedOwner) return null;
  return (
    <View style={{ gap: medicareSpacing.md }}>
      <Text accessibilityRole="header" style={{ color: medicareColors.text, fontSize: medicareTypography.subheading, fontWeight: '800' }}>Liên kết người chăm sóc</Text>
      <SafetyNotice title="Chỉ cần chia sẻ một mã" message="Tạo mã kết nối và gửi cho người chăm sóc. Mã chỉ dùng một lần, hết hạn sau khoảng 24 giờ và KHÔNG tự cấp quyền xem. Người chăm sóc gửi yêu cầu; bạn phải kiểm tra tên tài khoản rồi chủ động đồng ý." tone="information" />
      <SafetyNotice title="Phạm vi quyền xem" message="Sau khi bạn đồng ý, người chăm sóc có thể đọc toàn bộ trường trong các bản ghi thuốc và lịch ĐANG HOẠT ĐỘNG trên Firebase, kể cả hàm lượng và hướng dẫn dùng. Rules chặn thuốc/lịch đã ngừng hoạt động và lịch sử uống thuốc. Giao diện chỉ hiển thị tên thuốc và giờ dự kiến; dữ liệu đã xem vẫn có thể được lưu bên ngoài ứng dụng." tone="warning" />
      <SecondaryButton disabled={busy} label={busy ? 'Đang tạo mã…' : 'Tạo và chia sẻ mã kết nối'} onPress={() => void createAndShareInvite()} />
      {inviteCode ? <View style={{ gap: medicareSpacing.xs }}>
        <Text style={{ color: medicareColors.text, fontWeight: '700' }}>Mã kết nối của bạn</Text>
        <Text selectable style={{ color: medicareColors.primary, fontSize: medicareTypography.subheading, fontWeight: '800' }}>{inviteCode}</Text>
        {inviteExpiresAt ? <Text style={{ color: medicareColors.textMuted }}>Hết hạn: {inviteExpiresAt.toLocaleString('vi-VN')}</Text> : null}
      </View> : null}
      {visibleError ? <SafetyNotice title="Chưa hoàn tất" message={visibleError} tone="error" /> : null}
      <SecondaryButton disabled={busy} label="Tải lại yêu cầu kết nối" onPress={() => void refresh()} />
      {!hasLoadedLinks ? <Text style={{ color: medicareColors.textMuted }}>Danh sách yêu cầu chưa được tải.</Text> : null}
      {hasLoadedLinks && visibleLinks.length === 0 ? <Text style={{ color: medicareColors.textMuted }}>Chưa có yêu cầu hoặc người chăm sóc được liên kết.</Text> : null}
      {visibleLinks.map((link) => <View key={link.caregiverUid} style={{ gap: medicareSpacing.xs }}>
        <Text selectable style={{ color: medicareColors.text, fontWeight: '700' }}>{link.caregiverDisplayName ?? 'Người chăm sóc'}</Text>
        <Text selectable style={{ color: medicareColors.textMuted }}>UID: {link.caregiverUid}</Text>
        {link.status === 'pending' ? <>
          <Text style={{ color: medicareColors.textMuted }}>Đang chờ bạn xác nhận. Chưa có quyền xem thuốc hoặc lịch.</Text>
          <SecondaryButton disabled={busy} label="Đồng ý cấp quyền" onPress={() => approve(link)} />
          <SecondaryButton disabled={busy} label="Từ chối yêu cầu" onPress={() => reject(link)} />
        </> : null}
        {link.status === 'active' ? <>
          <Text style={{ color: medicareColors.textMuted }}>Đang có quyền xem thuốc và lịch đang hoạt động.</Text>
          <SecondaryButton disabled={busy} label={'Thu hồi quyền của ' + link.caregiverUid} onPress={() => revoke(link.caregiverUid)} />
        </> : null}
        {link.status === 'revoked' ? <Text style={{ color: medicareColors.textMuted }}>Đã thu hồi quyền.</Text> : null}
        {link.status === 'rejected' ? <Text style={{ color: medicareColors.textMuted }}>Đã từ chối yêu cầu.</Text> : null}
      </View>)}
    </View>
  );
}
