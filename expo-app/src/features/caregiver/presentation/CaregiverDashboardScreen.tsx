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
  StatusBadge,
} from '@/components/medicare';
import { medicareColors, medicareRadius, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { useSessionStore } from '@/store';
import { demoSchedule, getReminderMessage, linkConversationMessage, type ReminderChoice } from '../data/caregiver-demo';

type OpenPanel = 'schedule' | 'reminder' | 'link' | null;

export default function CaregiverDashboardScreen() {
  const user = useSessionStore((state) => state.user);
  const signOut = useSessionStore((state) => state.signOut);
  const operationStatus = useSessionStore((state) => state.operationStatus);
  const authErrorMessage = useSessionStore((state) => state.errorMessage);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [reminderChoice, setReminderChoice] = useState<ReminderChoice>('schedule');
  const [shareError, setShareError] = useState(false);
  const isSigningOut = operationStatus === 'loading';

  const togglePanel = (panel: Exclude<OpenPanel, null>) => {
    setShareError(false);
    setOpenPanel((currentPanel) => currentPanel === panel ? null : panel);
  };

  // The OS opens a share sheet, not a remote push notification. Dismissing the
  // sheet must never be presented as a delivered message.
  const openShareSheet = async (message: string) => {
    setShareError(false);
    try {
      await Share.share({ message });
    } catch {
      setShareError(true);
    }
  };

  const handleSignOut = async () => {
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
        description="Vai trò đã được kiểm tra từ hồ sơ của chính bạn. Hồ sơ và trạng thái dưới đây là dữ liệu giả lập; chưa có liên kết chăm sóc, đồng bộ hay quyền dữ liệu sức khỏe."
        title="Chế độ trình diễn"
      />
      {authErrorMessage ? (
        <SafetyNotice message={authErrorMessage} title="Không thể hoàn tất phiên đăng nhập" tone="error" />
      ) : null}
      <SafetyNotice
        message="“Chưa phản hồi” không đồng nghĩa người dùng chưa uống thuốc. Hãy liên hệ nhẹ nhàng khi cần."
        title="Hiểu đúng trạng thái"
        tone="warning"
      />
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Hồ sơ được chia sẻ
        </Text>
        <View accessibilityRole="summary" style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text accessibilityElementsHidden style={styles.avatarText}>MH</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>Hồ sơ minh họa</Text>
            <Text style={styles.profileDescription}>Dữ liệu trình diễn · Không phải hồ sơ người dùng khác</Text>
          </View>
          <StatusBadge label="Chưa phản hồi" status="unanswered" />
        </View>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Thao tác nhanh
        </Text>
        <ActionCard
          accessibilityHint="Mở hoặc ẩn lịch minh họa, không đọc hồ sơ của người khác"
          description="Xem giờ dự kiến và phản hồi tự báo của hồ sơ minh họa."
          icon={<Text style={styles.icon}>◷</Text>}
          onPress={() => togglePanel('schedule')}
          title={openPanel === 'schedule' ? 'Ẩn lịch thuốc minh họa' : 'Theo dõi lịch thuốc'}
        />
        {openPanel === 'schedule' ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Lịch thuốc hôm nay · Minh họa</Text>
            <Text style={styles.profileDescription}>3 mốc trong lịch mẫu · 1 chưa phản hồi. Đây không phải dữ liệu của người thân.</Text>
            <SecondaryButton
              label={onlyUnanswered ? 'Xem tất cả lịch minh họa' : 'Chỉ xem chưa phản hồi'}
              onPress={() => setOnlyUnanswered((current) => !current)}
            />
            {demoSchedule.filter((entry) => !onlyUnanswered || entry.unanswered).map(({ time, name, response }) => (
              <View key={time} style={styles.scheduleRow}>
                <Text style={styles.profileName}>{time} · {name}</Text>
                <Text style={styles.profileDescription}>{response}</Text>
              </View>
            ))}
            <SafetyNotice
              title="Không tự suy đoán bỏ liều"
              message="“Chưa phản hồi” chỉ có nghĩa chưa có báo cáo trong ví dụ; không chứng minh người đó chưa uống thuốc."
              tone="warning"
            />
          </View>
        ) : null}
        <ActionCard
          description="Chuẩn bị lời nhắc chung, chỉ chia sẻ khi bạn tự chọn ứng dụng gửi."
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
            <Text style={styles.profileDescription}>Không có thông báo đẩy hay SMS tự động. Bạn quyết định có gửi qua ứng dụng khác hay không.</Text>
          </View>
        ) : null}
        <ActionCard
          description="Tìm hiểu việc xin phép và soạn tin trao đổi; chưa tạo liên kết tài khoản."
          icon={<Text style={styles.icon}>⌁</Text>}
          onPress={() => togglePanel('link')}
          title={openPanel === 'link' ? 'Ẩn hướng dẫn liên kết' : 'Liên kết hồ sơ'}
        />
        {openPanel === 'link' ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Liên kết hồ sơ · Chưa kích hoạt</Text>
            <SafetyNotice
              title="Chưa cấp quyền"
              message="Việc liên kết thật cần người cao tuổi chấp thuận và hệ thống kiểm tra quyền phía máy chủ. Hiện không đọc được lịch thuốc của tài khoản khác."
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
  profileCard: {
    minHeight: 102,
    alignItems: 'center',
    flexDirection: 'row',
    gap: medicareSpacing.sm,
    padding: medicareSpacing.md,
    borderRadius: medicareRadius.lg,
    borderColor: medicareColors.border,
    borderWidth: 1,
    backgroundColor: medicareColors.surfaceElevated,
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: medicareColors.primaryContainer,
  },
  avatarText: {
    color: medicareColors.primary,
    fontSize: medicareTypography.label,
    fontWeight: '800',
  },
  profileCopy: {
    flex: 1,
    gap: medicareSpacing.xxs,
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
