export type ReminderChoice = 'schedule' | 'checkIn';

/** Only general messages, without name, strength, dosage, or health records. */
export function getReminderMessage(choice: ReminderChoice): string {
  if (choice === 'schedule') {
    return 'Mình nhắn hỏi thăm. Nếu tiện, bạn xem lại lịch thuốc của mình nhé. Khi cần hỗ trợ, cứ nhắn lại cho mình.';
  }
  return 'Mình muốn hỏi thăm hôm nay bạn cảm thấy thế nào. Nếu cần giúp đỡ, hãy nhắn lại nhé.';
}

/** A human-to-human conversation starter, NOT an invite token or auth grant. */
export const linkConversationMessage =
  'Mình muốn trao đổi về việc hỗ trợ bạn xem lịch thuốc trên MediCare AI. Chỉ khi bạn đồng ý và ứng dụng hỗ trợ cấp quyền thì mới có thể liên kết hồ sơ. Tin nhắn này không tự tạo liên kết hay chia sẻ dữ liệu.';
