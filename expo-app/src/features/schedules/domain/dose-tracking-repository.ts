import type {
  DoseEvent,
  DoseEventMedicationSnapshot,
  Medication,
  MedicationSchedule,
  PersistedDoseResponseStatus,
} from '@/types/domain';

export type DoseEventResponseInput = Readonly<{
  scheduleId: string;
  medicationId: string;
  scheduledLocalDate: string;
  scheduledLocalTime: string;
  scheduledAt: string;
  occurrenceKey: string;
  medicationSnapshot: DoseEventMedicationSnapshot;
  status: PersistedDoseResponseStatus;
}>;

export interface DoseTrackingRepository {
  listDoseEventsForLocalDate(userId: string, scheduledLocalDate: string): Promise<DoseEvent[]>;
  recordDoseResponse(userId: string, input: DoseEventResponseInput): Promise<DoseEvent>;
}

export const doseEventLocalTimeZone = 'Asia/Ho_Chi_Minh' as const;

const localDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const localTimePattern = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
const hoChiMinhUtcOffsetMilliseconds = 7 * 60 * 60 * 1000;

function assertNonPathId(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized || normalized.length > 150 || normalized.includes('/')) {
    throw new Error(`${label} không hợp lệ.`);
  }

  return normalized;
}

/** Validates a calendar date without accidentally converting it to a UTC day. */
export function isValidDoseEventLocalDate(value: string): boolean {
  const match = localDatePattern.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function assertValidDoseEventLocalDate(value: string): string {
  const normalized = value.trim();

  if (!isValidDoseEventLocalDate(normalized)) {
    throw new Error('Ngày dự kiến của lịch thuốc không hợp lệ.');
  }

  return normalized;
}

export function assertValidDoseEventLocalTime(value: string): string {
  const normalized = value.trim();

  if (!localTimePattern.test(normalized)) {
    throw new Error('Giờ dự kiến của lịch thuốc không hợp lệ.');
  }

  return normalized;
}

/**
 * Asia/Ho_Chi_Minh has a fixed UTC+7 offset. Building from numeric local date
 * parts avoids Date('YYYY-MM-DD') and device-timezone shifts.
 */
export function getDoseEventScheduledAt(localDate: string, localTime: string): string {
  const safeDate = assertValidDoseEventLocalDate(localDate);
  const safeTime = assertValidDoseEventLocalTime(localTime);
  const [year, month, day] = safeDate.split('-').map(Number);
  const [hour, minute] = safeTime.split(':').map(Number);

  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) - hoChiMinhUtcOffsetMilliseconds,
  ).toISOString();
}

export function getDoseEventOccurrenceKey(localDate: string, localTime: string): string {
  return `${assertValidDoseEventLocalDate(localDate)}T${assertValidDoseEventLocalTime(localTime)}@${doseEventLocalTimeZone}`;
}

/** Deterministic per schedule and HCM planned occurrence; no random client IDs. */
export function getDoseEventId(scheduleId: string, localDate: string, localTime: string): string {
  const safeScheduleId = assertNonPathId(scheduleId, 'Mã lịch thuốc');
  return `${safeScheduleId}__${assertValidDoseEventLocalDate(localDate)}__${assertValidDoseEventLocalTime(localTime)}`;
}

export function createDoseEventResponseInput(
  schedule: MedicationSchedule,
  medication: Medication,
  scheduledLocalDate: string,
  status: PersistedDoseResponseStatus,
): DoseEventResponseInput {
  if (schedule.medicationId !== medication.id) {
    throw new Error('Lịch thuốc không khớp với thuốc đang hiển thị.');
  }

  if (!schedule.active || medication.status !== 'active') {
    throw new Error('Chỉ có thể tự báo phản hồi cho lịch và thuốc đang sử dụng.');
  }

  if (status !== 'reportedTaken' && status !== 'reportedSkipped') {
    throw new Error('Trạng thái phản hồi thuốc không hợp lệ.');
  }

  const localDate = assertValidDoseEventLocalDate(scheduledLocalDate);
  const localTime = assertValidDoseEventLocalTime(schedule.localTime);

  return {
    scheduleId: assertNonPathId(schedule.id, 'Mã lịch thuốc'),
    medicationId: assertNonPathId(medication.id, 'Mã thuốc'),
    scheduledLocalDate: localDate,
    scheduledLocalTime: localTime,
    scheduledAt: getDoseEventScheduledAt(localDate, localTime),
    occurrenceKey: getDoseEventOccurrenceKey(localDate, localTime),
    medicationSnapshot: {
      name: medication.name,
      strengthText: medication.strengthText,
      directionsText: medication.directionsText,
    },
    status,
  };
}

export function isDoseEventDue(input: Pick<DoseEventResponseInput, 'scheduledAt'>, now = new Date()): boolean {
  const scheduledAt = new Date(input.scheduledAt);
  return !Number.isNaN(scheduledAt.valueOf()) && scheduledAt.valueOf() <= now.valueOf();
}
