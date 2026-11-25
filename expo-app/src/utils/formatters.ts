import type { DoseStatus } from '@/types/domain';

const vietnameseTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatVietnameseTime(isoTimestamp: string): string {
  return vietnameseTimeFormatter.format(new Date(isoTimestamp));
}

export function doseStatusLabel(status: DoseStatus): string {
  const labels: Record<DoseStatus, string> = {
    pending: 'Đến giờ uống',
    reportedTaken: 'Đã báo đã uống',
    reportedSkipped: 'Đã báo bỏ qua',
    snoozed: 'Đã nhắc lại sau',
    unanswered: 'Chưa phản hồi',
  };

  return labels[status];
}
