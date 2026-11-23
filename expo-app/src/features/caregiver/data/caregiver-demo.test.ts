import { demoSchedule, getReminderMessage, linkConversationMessage } from './caregiver-demo';

describe('caregiver demo data must not masquerade as real records', () => {
  it('uses a fixed sample schedule and keeps unanswered distinct from skipped', () => {
    expect(demoSchedule).toHaveLength(3);
    expect(demoSchedule.filter((entry) => entry.unanswered).map((entry) => entry.response)).toEqual(['Chưa phản hồi']);
    expect(demoSchedule.filter((entry) => entry.response === 'Tự báo bỏ qua')).toHaveLength(1);
  });

  it('prepares general messages without disclosing any medicine sample or dosage', () => {
    for (const choice of ['schedule', 'checkIn'] as const) {
      const message = getReminderMessage(choice);
      expect(message.length).toBeGreaterThan(30);
      expect(message).not.toMatch(/thuốc mẫu|500\s*mg|\b\d{1,2}:\d{2}\b/i);
    }
    expect(linkConversationMessage).toContain('không tự tạo liên kết');
    expect(linkConversationMessage).toContain('đồng ý');
  });
});
