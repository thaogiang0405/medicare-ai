import {
  assertValidMedicationScheduleCreateInput,
  getMedicationScheduleToday,
  isValidMedicationScheduleDate,
  MedicationScheduleValidationError,
  validateMedicationScheduleDraft,
} from './medication-schedule-validation';

const validDailyDraft = {
  recurrence: 'daily' as const,
  localTime: '08:30',
  weekdays: [1, 2, 3, 4, 5, 6, 7] as const,
  startDate: '2026-11-19',
  endDate: null,
};

describe('medication schedule validation', () => {
  it('accepts a canonical daily schedule and preserves local date-only data', () => {
    expect(assertValidMedicationScheduleCreateInput({ medicationId: 'medication-a', ...validDailyDraft })).toEqual({
      medicationId: 'medication-a',
      ...validDailyDraft,
    });
  });

  it('accepts selected weekdays and sorts them canonically', () => {
    expect(assertValidMedicationScheduleCreateInput({
      medicationId: 'medication-a',
      recurrence: 'weekly',
      localTime: '20:00',
      weekdays: [5, 1, 3],
      startDate: '2026-11-19',
      endDate: '2026-12-31',
    }).weekdays).toEqual([1, 3, 5]);
  });

  it('rejects invalid actual dates, local times, date order, and weekday selection', () => {
    expect(isValidMedicationScheduleDate('2026-02-30')).toBe(false);
    expect(isValidMedicationScheduleDate('2024-02-29')).toBe(true);
    expect(isValidMedicationScheduleDate('2025-02-29')).toBe(false);

    expect(validateMedicationScheduleDraft({
      ...validDailyDraft,
      localTime: '24:00',
      startDate: '2026-02-30',
      endDate: '2026-02-28',
    })).toMatchObject({
      localTime: expect.any(String),
      startDate: expect.any(String),
    });
    expect(validateMedicationScheduleDraft({
      ...validDailyDraft,
      recurrence: 'weekly',
      weekdays: [1, 1],
    })).toMatchObject({ weekdays: expect.any(String) });
    expect(validateMedicationScheduleDraft({
      ...validDailyDraft,
      endDate: '2026-11-18',
    })).toMatchObject({ endDate: expect.any(String) });
  });

  it('does not silently accept an invalid medication ID', () => {
    expect(() => assertValidMedicationScheduleCreateInput({
      medicationId: 'other/medication',
      ...validDailyDraft,
    })).toThrow(MedicationScheduleValidationError);
  });

  it('formats the current calendar day in Asia/Ho_Chi_Minh rather than UTC day boundaries', () => {
    expect(getMedicationScheduleToday(new Date('2026-11-18T18:00:00.000Z'))).toBe('2026-11-19');
  });
});
