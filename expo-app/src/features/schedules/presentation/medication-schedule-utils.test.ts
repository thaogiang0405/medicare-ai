import {
  medicationScheduleDateRangeLabel,
  medicationScheduleRecurrenceLabel,
} from './medication-schedule-utils';

describe('medication schedule presentation helpers', () => {
  it('labels daily and selected-weekday recurrence without interpreting dosage', () => {
    expect(medicationScheduleRecurrenceLabel({ recurrence: 'daily', weekdays: [1, 2, 3, 4, 5, 6, 7] })).toBe('Mỗi ngày');
    expect(medicationScheduleRecurrenceLabel({ recurrence: 'weekly', weekdays: [1, 3, 7] })).toBe('T2, T4, CN');
  });

  it('keeps date-only ranges in the local schedule wording', () => {
    expect(medicationScheduleDateRangeLabel({ startDate: '2026-11-19', endDate: null })).toBe('Từ 2026-11-19');
    expect(medicationScheduleDateRangeLabel({ startDate: '2026-11-19', endDate: '2026-12-31' })).toBe(
      'Từ 2026-11-19 đến 2026-12-31',
    );
  });
});
