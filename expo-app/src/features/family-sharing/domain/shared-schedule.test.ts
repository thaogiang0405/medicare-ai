import { buildSharedScheduleText, parseSharedScheduleText } from './shared-schedule';

const plans = [
  { schedule: { localTime: '20:15' }, medication: { name: 'Thuốc người dùng tự nhập' } },
  { schedule: { localTime: '08:00' }, medication: { name: 'Acetaminophen' } },
];

describe('manual shared schedule snapshots', () => {
  it('exports only actual supplied names, times and local date, with no identifiers or doses', () => {
    const text = buildSharedScheduleText('2026-11-23', plans);
    expect(text).toContain('MEDICARE-AI-LICH-THUOC-V1');
    expect(text).not.toContain('ownerUid');
    expect(text).not.toContain('medicationId');
    expect(text).not.toContain('strengthText');
    expect(text).not.toContain('directionsText');
    expect(text).not.toContain('reportedTaken');
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

  it('will not export empty demo or malformed schedules', () => {
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

  it('rejects edited, malformed and oversized pasted data without partial import', () => {
    const valid = buildSharedScheduleText('2026-11-23', plans) ?? '';
    expect(valid.length).toBeGreaterThan(0);
    for (const bad of [
      '',
      valid.slice(0, 25),
      valid.replace('08:00', '99:00'),
      valid.replace('2026-11-23', '2026-02-30'),
      valid.replace('"version":1', '"version":2'),
      valid.replace('"name":"Acetaminophen"', '"name":"Acetaminophen","status":"taken"'),
      valid.replace('"kind":', '"ownerUid":"secret","kind":'),
      valid + 'not json',
      'x'.repeat(8193),
      'MEDICARE-AI-LICH-THUOC-V1\n{"kind":"medicare-ai-planned-schedule","version":1,"date":"2026-11-23","items":[]}',
    ]) {
      expect(parseSharedScheduleText(bad)).toBeNull();
    }
  });

  it('does not trust malicious names or extra document fields', () => {
    const valid = buildSharedScheduleText('2026-11-23', plans) ?? '';
    expect(parseSharedScheduleText(valid.replace('Acetaminophen', 'Acetaminophen\\nInjected'))).toBeNull();
    expect(parseSharedScheduleText(valid.replace('Acetaminophen', 'Acetaminophen '))).toBeNull();
  });
});
