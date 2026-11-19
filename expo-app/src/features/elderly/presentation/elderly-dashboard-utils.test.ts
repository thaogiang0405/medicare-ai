import type { DoseEvent, Medication, MedicationSchedule } from '@/types/domain';

import {
  getMedicationScheduleCalendarDay,
  getTodayMedicationSchedules,
  hasDashboardDataForCurrentUser,
  millisecondsUntilNextMedicationScheduleDay,
  resolveMedicationForDose,
  shouldShowFirestoreMedicationSchedules,
} from './elderly-dashboard-utils';

const doseEvent: DoseEvent = {
  id: 'dose-metformin-morning',
  medicationId: 'med-metformin-500',
  scheduledAt: '2026-11-18T01:00:00.000Z',
  status: 'pending',
};

const medication: Medication = {
  id: 'med-metformin-500',
  name: 'Metformin',
  strengthText: '500 mg',
  directionsText: 'Uống sau bữa sáng',
  status: 'inactive',
  createdAt: '2026-11-18T00:00:00.000Z',
  updatedAt: '2026-11-18T00:00:00.000Z',
};

describe('resolveMedicationForDose', () => {
  it('keeps the demo schedule display safe when a medication is inactive or missing', () => {
    expect(resolveMedicationForDose(doseEvent, [medication])).toEqual(medication);
    expect(resolveMedicationForDose(doseEvent, [])).toBeNull();
  });
});

const activeMedication: Medication = {
  ...medication,
  id: 'med-active',
  name: 'Metformin',
  status: 'active',
};

function schedule(overrides: Partial<MedicationSchedule> = {}): MedicationSchedule {
  return {
    id: 'schedule-morning',
    medicationId: 'med-active',
    recurrence: 'daily',
    localTime: '08:00',
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startDate: '2026-11-01',
    endDate: null,
    timeZone: 'Asia/Ho_Chi_Minh',
    active: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getTodayMedicationSchedules', () => {
  const hcmMonday = new Date('2026-11-22T17:30:00.000Z');
  const hcmSunday = new Date('2026-11-22T16:30:00.000Z');

  it('uses Asia/Ho_Chi_Minh around the Sunday-to-Monday boundary', () => {
    expect(getMedicationScheduleCalendarDay(hcmSunday)).toEqual({ isoDate: '2026-11-22', weekday: 7 });
    expect(getMedicationScheduleCalendarDay(hcmMonday)).toEqual({ isoDate: '2026-11-23', weekday: 1 });
    expect(getTodayMedicationSchedules([
      schedule({ recurrence: 'weekly', weekdays: [1] }),
    ], [activeMedication], hcmMonday)).toHaveLength(1);
    expect(getTodayMedicationSchedules([
      schedule({ recurrence: 'weekly', weekdays: [1] }),
    ], [activeMedication], hcmSunday)).toEqual([]);
    expect(getTodayMedicationSchedules([
      schedule({ recurrence: 'weekly', weekdays: [7] }),
    ], [activeMedication], hcmSunday)).toHaveLength(1);
  });

  it('includes date boundaries and excludes paused, inactive, missing, or out-of-range plans', () => {
    const today = new Date('2026-11-23T01:00:00.000Z');
    const visible = getTodayMedicationSchedules([
      schedule({ id: 'start-boundary', startDate: '2026-11-23', endDate: '2026-11-23' }),
      schedule({ id: 'paused', active: false }),
      schedule({ id: 'ended', endDate: '2026-11-22' }),
      schedule({ id: 'missing-medication', medicationId: 'missing' }),
      schedule({ id: 'inactive-medication', medicationId: 'med-inactive' }),
    ], [activeMedication, medication], today);

    expect(visible.map((item) => item.schedule.id)).toEqual(['start-boundary']);
  });

  it('keeps multiple schedules for one medication, removes duplicate ids, and sorts by local HH:mm', () => {
    const visible = getTodayMedicationSchedules([
      schedule({ id: 'evening', localTime: '20:00' }),
      schedule({ id: 'morning', localTime: '07:30' }),
      schedule({ id: 'morning', localTime: '06:00' }),
    ], [activeMedication], new Date('2026-11-23T01:00:00.000Z'));

    expect(visible.map((item) => `${item.schedule.id}:${item.schedule.localTime}`)).toEqual([
      'morning:07:30',
      'evening:20:00',
    ]);
  });
});

describe('dashboard schedule mode and day refresh', () => {
  it('requires both Firestore flags, isolates stale account data, and calculates a positive HCM day refresh delay', () => {
    expect(shouldShowFirestoreMedicationSchedules(true, true)).toBe(true);
    expect(shouldShowFirestoreMedicationSchedules(true, false)).toBe(false);
    expect(shouldShowFirestoreMedicationSchedules(false, true)).toBe(false);
    expect(hasDashboardDataForCurrentUser('elderly-a', 'elderly-a')).toBe(true);
    expect(hasDashboardDataForCurrentUser('elderly-a', 'elderly-b')).toBe(false);
    expect(hasDashboardDataForCurrentUser(undefined, 'elderly-a')).toBe(false);
    expect(millisecondsUntilNextMedicationScheduleDay(new Date('2026-11-23T16:59:59.000Z'))).toBe(1_000);
  });
});
