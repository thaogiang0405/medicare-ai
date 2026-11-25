import type { MedicationSchedule, MedicationScheduleWeekday } from '@/types/domain';

const weekdayLabels: Record<MedicationScheduleWeekday, string> = {
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
  7: 'Chủ Nhật',
};

const weekdayShortLabels: Record<MedicationScheduleWeekday, string> = {
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
  7: 'CN',
};

export function medicationScheduleWeekdayLabel(weekday: MedicationScheduleWeekday): string {
  return weekdayLabels[weekday];
}

export function medicationScheduleWeekdayShortLabel(weekday: MedicationScheduleWeekday): string {
  return weekdayShortLabels[weekday];
}

export function medicationScheduleRecurrenceLabel(schedule: Pick<MedicationSchedule, 'recurrence' | 'weekdays'>): string {
  if (schedule.recurrence === 'daily') {
    return 'Mỗi ngày';
  }

  return schedule.weekdays.map(medicationScheduleWeekdayShortLabel).join(', ');
}

export function medicationScheduleDateRangeLabel(schedule: Pick<MedicationSchedule, 'startDate' | 'endDate'>): string {
  return schedule.endDate
    ? `Từ ${schedule.startDate} đến ${schedule.endDate}`
    : `Từ ${schedule.startDate}`;
}
