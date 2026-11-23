import { useState } from 'react';
import { Share, Text, View } from 'react-native';

import { SafetyNotice, SecondaryButton } from '@/components/medicare';
import { medicareColors, medicareRadius, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';

/**
 * Manual, two-step consent. Never start sharing when a schedule is merely
 * loaded or displayed, and never interpret a native Share result as delivery.
 */
export function ShareTodayScheduleButton({ message }: Readonly<{ message: string }>) {
  // Consent applies to exactly the current snapshot. A changed message
  // automatically hides the share action without effect-time state updates.
  const [reviewedMessage, setReviewedMessage] = useState<string | null>(null);
  const reviewing = reviewedMessage === message;
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState(false);

  const openShare = async () => {
    if (!reviewing || sharing) return;
    setSharing(true);
    setError(false);
    try {
      await Share.share({ message });
    } catch {
      setError(true);
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={{ gap: medicareSpacing.sm }}>
      <SecondaryButton
        label={reviewing ? 'Ẩn phần chia sẻ lịch thuốc' : 'Chia sẻ lịch thuốc hôm nay'}
        onPress={() => { setReviewedMessage(reviewing ? null : message); setError(false); }}
      />
      {reviewing ? (
        <>
          <SafetyNotice
            title="Chỉ chia sẻ khi bạn đồng ý"
            message="Tin nhắn chỉ gồm ngày, giờ dự kiến và tên thuốc. Sau khi đồng ý, bạn có thể chọn Zalo, Messenger hoặc ứng dụng nhắn tin khác nếu thiết bị hỗ trợ. Người nhận có thể lưu hoặc chuyển tiếp. Chỉ gửi cho người đáng tin cậy."
            tone="warning"
          />
          <View style={{
            padding: medicareSpacing.md,
            borderWidth: 1,
            borderColor: medicareColors.border,
            borderRadius: medicareRadius.md,
            backgroundColor: medicareColors.surfaceElevated,
          }}>
            <Text accessibilityLabel="Nội dung lịch thuốc sẽ chia sẻ" selectable style={{
              color: medicareColors.text,
              fontSize: medicareTypography.bodySmall,
              lineHeight: 22,
            }}>{message}</Text>
          </View>
          <SecondaryButton
            disabled={sharing}
            label={sharing ? 'Đang mở bảng chia sẻ…' : 'Tôi đồng ý — mở bảng chia sẻ'}
            onPress={() => void openShare()}
          />
          {error ? (
            <SafetyNotice
              title="Không mở được bảng chia sẻ"
              message="Chưa chia sẻ dữ liệu từ ứng dụng. Bạn có thể thử lại."
              tone="error"
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
