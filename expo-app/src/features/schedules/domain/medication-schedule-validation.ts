import type { MedicationScheduleRecurrence, MedicationScheduleWeekday } from '@/types/domain';

import {
  allMedicationScheduleWeekdays,
  type MedicationScheduleCreateInput,
  type MedicationScheduleDraft,
  type MedicationScheduleUpdateInput,
} from './medication-schedule-repository';

export type MedicationScheduleInputErrors = Partial<Record<
  'medicationId' | 'recurrence' | 'localTime' | 'weekdays' | 'startDate' | 'endDate',
  string
>>;

export class MedicationScheduleValidationError extends Error {
  constructor(readonly fieldErrors: MedicationScheduleInputErrors) {
    super('Thông tin lịch uống thuốc chưa hợp lệ.');
    this.name = 'MedicationScheduleValidationError';
  }
}

const localTimePattern = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
const localDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function normalizeDate(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function isWeekday(value: unknown): value is MedicationScheduleWeekday {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 1
    && value <= 7;
}

/** Validates a real calendar date without converting it to a UTC moment. */
export function isValidMedicationScheduleDate(value: string): boolean {
  const match = localDatePattern.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // This shared range keeps the client validation aligned with the reviewed
  // Rules regex and avoids silently accepting malformed historical metadata.
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function getMedicationScheduleToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

export function normalizeMedicationScheduleDraft<T extends MedicationScheduleDraft>(input: T): T {
  return {
    ...input,
    localTime: input.localTime.trim(),
    weekdays: [...input.weekdays],
    startDate: input.startDate.trim(),
    endDate: normalizeDate(input.endDate),
  };
}

function validateWeekdays(
  recurrence: MedicationScheduleRecurrence,
  weekdays: readonly MedicationScheduleWeekday[],
): string | undefined {
  if (!Array.isArray(weekdays) || weekdays.some((weekday) => !isWeekday(weekday))) {
    return 'Vui lòng chọn các thứ hợp lệ trong tuần.';
  }

  const uniqueWeekdays = new Set(weekdays);

  if (uniqueWeekdays.size !== weekdays.length) {
    return 'Mỗi thứ chỉ được chọn một lần.';
  }

  if (recurrence === 'daily') {
    const isEveryDay = weekdays.length === allMedicationScheduleWeekdays.length
      && allMedicationScheduleWeekdays.every((weekday) => uniqueWeekdays.has(weekday));

    return isEveryDay ? undefined : 'Lịch hằng ngày phải bao gồm đủ bảy ngày.';
  }

  if (recurrence === 'weekly') {
    return weekdays.length > 0 ? undefined : 'Vui lòng chọn ít nhất một thứ trong tuần.';
  }

  return 'Kiểu lặp lại chưa hợp lệ.';
}

export function validateMedicationScheduleDraft(input: MedicationScheduleDraft): MedicationScheduleInputErrors {
  const normalized = normalizeMedicationScheduleDraft(input);
  const errors: MedicationScheduleInputErrors = {};

  if (normalized.recurrence !== 'daily' && normalized.recurrence !== 'weekly') {
    errors.recurrence = 'Vui lòng chọn lịch hằng ngày hoặc theo thứ.';
  }

  if (!localTimePattern.test(normalized.localTime)) {
    errors.localTime = 'Giờ uống phải theo dạng HH:mm, từ 00:00 đến 23:59.';
  }

  const weekdayError = validateWeekdays(normalized.recurrence, normalized.weekdays);
  if (weekdayError) {
    errors.weekdays = weekdayError;
  }

  if (!isValidMedicationScheduleDate(normalized.startDate)) {
    errors.startDate = 'Ngày bắt đầu phải là ngày thực tế theo dạng YYYY-MM-DD.';
  }

  if (normalized.endDate !== null) {
    if (!isValidMedicationScheduleDate(normalized.endDate)) {
      errors.endDate = 'Ngày kết thúc phải là ngày thực tế theo dạng YYYY-MM-DD.';
    } else if (isValidMedicationScheduleDate(normalized.startDate) && normalized.endDate < normalized.startDate) {
      errors.endDate = 'Ngày kết thúc không được trước ngày bắt đầu.';
    }
  }

  return errors;
}

function assertValidDraft<T extends MedicationScheduleDraft>(input: T): T {
  const normalized = normalizeMedicationScheduleDraft(input);
  const errors = validateMedicationScheduleDraft(normalized);

  if (Object.keys(errors).length > 0) {
    throw new MedicationScheduleValidationError(errors);
  }

  return {
    ...normalized,
    weekdays: [...normalized.weekdays].sort((left, right) => left - right),
  } as T;
}

export function assertValidMedicationScheduleCreateInput(
  input: MedicationScheduleCreateInput,
): MedicationScheduleCreateInput {
  const medicationId = input.medicationId.trim();
  const normalized = assertValidDraft(input);

  if (!medicationId || medicationId.includes('/')) {
    throw new MedicationScheduleValidationError({ medicationId: 'Thuốc được chọn không hợp lệ.' });
  }

  return { ...normalized, medicationId };
}

export function assertValidMedicationScheduleUpdateInput(
  input: MedicationScheduleUpdateInput,
): MedicationScheduleUpdateInput {
  return assertValidDraft(input);
}
