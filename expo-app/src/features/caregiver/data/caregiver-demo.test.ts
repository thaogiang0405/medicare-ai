import { getReminderMessage, linkConversationMessage } from './caregiver-demo';

describe('caregiver generic conversation templates', () => {
  it('does not include medicine names, dose or schedule data', () => {
    for (const choice of ['schedule', 'checkIn'] as const) {
      const message = getReminderMessage(choice);
      expect(message.length).toBeGreaterThan(30);
      expect(message).not.toMatch(/thuốc mẫu|500\s*mg|\b\d{1,2}:\d{2}\b/i);
    }
    expect(linkConversationMessage).toContain('không tự tạo liên kết');
    expect(linkConversationMessage).toContain('đồng ý');
  });
});
