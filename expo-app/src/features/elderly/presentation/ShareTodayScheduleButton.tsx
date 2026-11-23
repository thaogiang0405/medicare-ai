import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';

import { SafetyNotice, SecondaryButton } from '@/components/medicare';
import { medicareSpacing } from '@/constants/medicare-theme';

/**
 * Manual, two-step consent. Never start sharing when a schedule is merely
 * loaded or displayed, and never interpret a native Share result as delivery.
 */
export function ShareTodayScheduleButton({ message }: Readonly<{ message: string }>) {
  const [reviewing, setReviewing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState(false);

  // Require a fresh review when the daily schedule changes while this screen
  // remains mounted; consent to share an earlier version is not transferable.
  useEffect(() => {
    setReviewing(false);
    setError(false);
  }, [message]);

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
        onPress={() => { setReviewing((current) => !current); setError(false); }}
      />
      {reviewing ? (
        <>
          <SafetyNotice
            title="Chỉ chia sẻ khi bạn đồng ý"
            message="Bản sao chứa tên thuốc và giờ dự kiến hôm nay từ hồ sơ của bạn. Thông tin sức khỏe có thể được người nhận lưu hoặc chuyển tiếp. Chỉ chọn người nhận đáng tin cậy. Không gửi hàm lượng, hướng dẫn uống hay phản hồi đã uống."
            tone="warning"
          />
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
