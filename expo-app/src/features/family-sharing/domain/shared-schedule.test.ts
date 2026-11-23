import { buildSharedScheduleText, parseSharedScheduleText } from './shared-schedule';

const plans = [
  { schedule: { localTime: '20:15' }, medication: { name: 'Thuốc người dùng tự nhập' } },
  { schedule: { localTime: '08:00' }, medication: { name: 'Acetaminophen' } },
];

describe('readable schedule forwarded through messaging apps', () => {
  it('sends easy-to-read Vietnamese rows that also import without exposing private account fields', () => {
    const text = buildSharedScheduleText('2026-11-23', plans);
    expect(text).toContain('LỊCH THUỐC DỰ KIẾN - MediCare AI');
    expect(text).toContain('Ngày: 23/11/2026');
    expect(text).toContain('08:00 — Acetaminophen');
    expect(text).toContain('20:15 — Thuốc người dùng tự nhập');
    expect(text).toContain('chưa xác nhận đã uống');
    expect(text).not.toContain('ownerUid');
    expect(text).not.toContain('medicationId');
    expect(text).not.toContain('strengthText');
    expect(text).not.toContain('directionsText');
    expect(text).not.toContain('reportedTaken');
    expect(text).not.toContain('"items"');
    expect(parseSharedScheduleText(text ?? '')).toEqual({
      kind: 'medicare-ai-planned-schedule',
      version: 1,
      date: '2026-11-23',
      items: [
        { time: '08:00', name: 'Acetaminophen' },
        { time: '20:15', name: 'Thuốc người dùng tự nhập' },
      ],
    });
  });

  it('does not export empty demo, invalid, or excessively long schedules', () => {
    expect(buildSharedScheduleText('2026-11-23', [])).toBeNull();
    expect(buildSharedScheduleText('2026-02-29', plans)).toBeNull();
    expect(buildSharedScheduleText('2026-11-23', [
      { schedule: { localTime: '25:00' }, medication: { name: 'Thuốc mẫu' } },
    ])).toBeNull();
    expect(buildSharedScheduleText('2026-11-23', Array(21).fill(plans[0]))).toBeNull();
    expect(buildSharedScheduleText('2026-11-23', [
      { schedule: { localTime: '08:00' }, medication: { name: ' '.repeat(8) } },
    ])).toBeNull();
  });

  it('rejects partial, edited and malformed messages instead of guessing missing fields', () => {
    const valid = buildSharedScheduleText('2026-11-23', plans) ?? '';
    expect(valid.length).toBeGreaterThan(0);
    for (const bad of [
      '',
      valid.slice(0, 25),
      valid.replace('08:00', '99:00'),
      valid.replace('23/11/2026', '30/02/2026'),
      valid.replace('LỊCH THUỐC DỰ KIẾN', 'LỊCH KHÁC'),
      valid.replace('20:15 — ', '20:15: '),
      valid.replace('08:00 — Acetaminophen', '08:00 — '),
      valid.replace('Acetaminophen', 'Acetaminophen\nĐã uống'),
      valid.replace('Acetaminophen', 'Acetaminophen '),
      valid.replace('Chỉ là lịch dự kiến, chưa xác nhận đã uống.', 'Đã uống.'),
      valid + '\nDòng ngoài định dạng',
      'x'.repeat(8193),
    ]) {
      expect(parseSharedScheduleText(bad)).toBeNull();
    }
  });

  it('still accepts older V1 JSON shares for family members on previous app builds', () => {
    const legacy = 'MEDICARE-AI-LICH-THUOC-V1\n' + JSON.stringify({
      kind: 'medicare-ai-planned-schedule',
      version: 1,
      date: '2026-11-23',
      items: [{ time: '08:00', name: 'Acetaminophen' }],
    });
    expect(parseSharedScheduleText(legacy)?.items).toEqual([{ time: '08:00', name: 'Acetaminophen' }]);
    expect(parseSharedScheduleText(legacy.replace('"version":1', '"version":2'))).toBeNull();
    expect(parseSharedScheduleText(legacy.replace('"name":"Acetaminophen"', '"name":"Acetaminophen","status":"taken"'))).toBeNull();
    expect(parseSharedScheduleText(legacy.replace('"kind":', '"ownerUid":"secret","kind":'))).toBeNull();
  });
});
