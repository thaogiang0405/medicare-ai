import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  ActionCard,
  AppHeader,
  DemoModeBanner,
  SafetyNotice,
  Screen,
  SecondaryButton,
  TextField,
} from '@/components/medicare';
import { medicareColors, medicareRadius, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { parseSharedScheduleText, type SharedSchedule } from '@/features/family-sharing/domain/shared-schedule';
import { useSessionStore } from '@/store';

import { getReminderMessage, linkConversationMessage, type ReminderChoice } from '../data/caregiver-demo';

type OpenPanel = 'schedule' | 'reminder' | 'link' | null;

function CaregiverDashboardContent() {
  const user = useSessionStore((state) => state.user);
  const signOut = useSessionStore((state) => state.signOut);
  const operationStatus = useSessionStore((state) => state.operationStatus);
  const authErrorMessage = useSessionStore((state) => state.errorMessage);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [importText, setImportText] = useState('');
  const [imported, setImported] = useState<SharedSchedule | null>(null);
  const [importError, setImportError] = useState(false);
  const [reminderChoice, setReminderChoice] = useState<ReminderChoice>('schedule');
  const [shareError, setShareError] = useState(false);
  const isSigningOut = operationStatus === 'loading';

  const togglePanel = (panel: Exclude<OpenPanel, null>) => {
    setShareError(false);
    setOpenPanel((currentPanel) => currentPanel === panel ? null : panel);
  };

  const importSharedText = () => {
    const snapshot = parseSharedScheduleText(importText.trim());
    if (!snapshot) {
      setImportError(true);
      return;
    }
    setImported(snapshot);
    setImportText('');
    setImportError(false);
  };

  const clearSharedText = () => {
    setImported(null);
    setImportText('');
    setImportError(false);
  };

  // Opens only the OS share sheet; no push, SMS, Firestore or delivery claim.
  const openShareSheet = async (message: string) => {
    setShareError(false);
    try {
      await Share.share({ message });
    } catch {
      setShareError(true);
    }
  };

  const handleSignOut = async () => {
    clearSharedText();
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
        right={<Text style={styles.roleLabel}>Người chăm sóc</Text>}
        title={`Chào ${user?.displayName ?? 'bạn'}`}
      />
      <DemoModeBanner
        description="Chưa có quyền đọc lịch thuốc trực tuyến của người khác. Bạn chỉ có thể xem một bản lịch do người cao tuổi chủ động chia sẻ. Bản nhận được có thể bị sửa trước khi dán."
        title="Chưa liên kết hồ sơ trực tuyến"
      />
      {authErrorMessage ? (
        <SafetyNotice message={authErrorMessage} title="Không thể hoàn tất phiên đăng nhập" tone="error" />
      ) : null}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Dữ liệu người thân</Text>
        <SafetyNotice
          title={imported ? 'Đang xem bản lịch đã nhập' : 'Chưa có bản chia sẻ'}
          message={imported
            ? 'Đây là bản sao thủ công, không cập nhật tự động và không xác minh được người gửi. Không có dữ liệu uống thuốc thực tế.'
            : 'Người cao tuổi phải chủ động chia sẻ lịch từ tài khoản của họ. Ứng dụng không có quyền tự tìm hoặc đọc hồ sơ người khác.'}
          tone="information"
        />
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Thao tác nhanh</Text>
        <ActionCard
          accessibilityHint="Nhập và xem bản chia sẻ lịch thật, không đọc tài khoản khác trên Firebase"
          description="Nhận tin nhắn qua Zalo/Messenger hoặc ứng dụng khác, rồi dán để xem lịch."
          icon={<Text style={styles.icon}>◷</Text>}
          onPress={() => togglePanel('schedule')}
          title={openPanel === 'schedule' ? 'Ẩn bản lịch đã chia sẻ' : 'Theo dõi lịch thuốc'}
        />
        {openPanel === 'schedule' ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Bản chia sẻ lịch thuốc</Text>
            {imported ? (
              <>
                <Text style={styles.profileDescription}>Ngày {imported.date} · {imported.items.length} mốc · Giờ Việt Nam</Text>
                {imported.items.map(({ time, name }, index) => (
                  <View key={time + '-' + index} style={styles.scheduleRow}>
                    <Text style={styles.profileName}>{time} · {name}</Text>
                    <Text style={styles.profileDescription}>Lịch dự kiến; chưa có xác nhận đã uống</Text>
                  </View>
                ))}
                <SafetyNotice
                  title="Bản sao không tự cập nhật"
                  message="Nếu lịch thay đổi, hãy xin bản mới. Người gửi và nội dung chưa được xác thực bởi hệ thống."
                  tone="warning"
                />
                <SecondaryButton label="Xóa bản lịch đã nhập" onPress={clearSharedText} />
              </>
            ) : (
              <>
                <Text style={styles.profileDescription}>
                  Người cao tuổi mở Lịch thuốc hôm nay → Chia sẻ lịch thuốc hôm nay → đồng ý → chọn Zalo, Messenger hoặc ứng dụng có trong bảng chia sẻ. Trên điện thoại người nhận, sao chép toàn bộ tin nhắn lịch thuốc rồi dán vào ô bên dưới.
                </Text>
                <TextField
                  autoCapitalize="none"
                  autoCorrect={false}
                  errorMessage={importError ? 'Tin nhắn lịch thuốc chưa đầy đủ hoặc sai định dạng. Hãy sao chép toàn bộ tin nhắn lịch thuốc và thử lại.' : undefined}
                  helperText="Bản lịch chỉ được giữ tạm trong màn hình này; không ghi lên Firebase hay bộ nhớ lâu dài."
                  label="Dán bản chia sẻ lịch thuốc"
                  maxLength={8192}
                  multiline
                  numberOfLines={6}
                  onChangeText={(value) => { setImportText(value); setImportError(false); }}
                  placeholder="LỊCH THUỐC DỰ KIẾN - MediCare AI"
                  style={styles.pasteInput}
                  value={importText}
                />
                <SecondaryButton
                  disabled={!importText.trim()}
                  label="Đọc bản lịch đã dán"
                  onPress={importSharedText}
                />
              </>
            )}
          </View>
        ) : null}
        <ActionCard
          description="Chuẩn bị lời nhắc chung và chủ động chọn ứng dụng để gửi."
          icon={<Text style={styles.icon}>♥</Text>}
          onPress={() => togglePanel('reminder')}
          title={openPanel === 'reminder' ? 'Ẩn lời nhắc' : 'Nhắc người thân'}
        />
        {openPanel === 'reminder' ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Soạn lời nhắc · Không tự gửi</Text>
            <SecondaryButton label="Chọn lời nhắc lịch thuốc" onPress={() => setReminderChoice('schedule')} />
            <SecondaryButton label="Chọn lời hỏi thăm" onPress={() => setReminderChoice('checkIn')} />
            <View style={styles.scheduleRow}>
              <Text style={styles.profileName}>Nội dung chuẩn bị</Text>
              <Text style={styles.profileDescription}>{getReminderMessage(reminderChoice)}</Text>
            </View>
            <SecondaryButton
              label="Mở bảng chia sẻ lời nhắc"
              onPress={() => void openShareSheet(getReminderMessage(reminderChoice))}
            />
            <Text style={styles.profileDescription}>Không có thông báo đẩy hay SMS tự động. Bạn quyết định có gửi hay không.</Text>
          </View>
        ) : null}
        <ActionCard
          description="Trao đổi về việc xin phép; chưa tạo liên kết hoặc quyền trên Firebase."
          icon={<Text style={styles.icon}>⌁</Text>}
          onPress={() => togglePanel('link')}
          title={openPanel === 'link' ? 'Ẩn hướng dẫn liên kết' : 'Liên kết hồ sơ'}
        />
        {openPanel === 'link' ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Liên kết hồ sơ · Chưa kích hoạt</Text>
            <SafetyNotice
              title="Chưa cấp quyền"
              message="Kết nối trực tuyến cần người cao tuổi chấp thuận và hệ thống kiểm tra quyền phía máy chủ. Bản chia sẻ thủ công không cấp quyền này."
              tone="warning"
            />
            <View style={styles.scheduleRow}>
              <Text style={styles.profileName}>Lời đề nghị trao đổi</Text>
              <Text style={styles.profileDescription}>{linkConversationMessage}</Text>
            </View>
            <SecondaryButton
              label="Mở bảng chia sẻ lời mời trao đổi"
              onPress={() => void openShareSheet(linkConversationMessage)}
            />
          </View>
        ) : null}
        {shareError ? (
          <SafetyNotice
            title="Không mở được bảng chia sẻ"
            message="Hãy thử lại trên thiết bị. Không có tin nhắn nào được gửi từ ứng dụng."
            tone="error"
          />
        ) : null}
      </View>
      <SecondaryButton
        accessibilityHint="Đăng xuất và xóa bản lịch đang xem khỏi bộ nhớ tạm"
        disabled={isSigningOut}
        label={isSigningOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
        onPress={() => void handleSignOut()}
      />
    </Screen>
  );
}

/**
 * A changed authenticated UID remounts the presentation synchronously.
 * Imported health text cannot remain visible across account switches.
 */
export default function CaregiverDashboardScreen() {
  const accountId = useSessionStore((state) => state.user?.id ?? null);
  return <CaregiverDashboardContent key={accountId ?? 'signed-out'} />;
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
  scheduleRow: {
    gap: medicareSpacing.xxs,
    padding: medicareSpacing.md,
    borderRadius: medicareRadius.lg,
    borderWidth: 1,
    borderColor: medicareColors.border,
    backgroundColor: medicareColors.surfaceElevated,
  },
  pasteInput: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  profileName: {
    color: medicareColors.text,
    fontSize: medicareTypography.label,
    fontWeight: '800',
  },
  profileDescription: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 22,
  },
  icon: {
    color: medicareColors.primary,
    fontSize: 28,
  },
});
