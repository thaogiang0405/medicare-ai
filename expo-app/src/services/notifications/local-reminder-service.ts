import type { Medication, MedicationSchedule, MedicationScheduleWeekday } from '@/types/domain';

export const localReminderRollingHorizonDays = 14;
export const localReminderTimeZone = 'Asia/Ho_Chi_Minh' as const;

const asiaHoChiMinhUtcOffsetMilliseconds = 7 * 60 * 60 * 1000;
const localReminderStorageKey = '@medicare-ai/local-reminders/v1';

export type LocalReminderPermission = 'granted' | 'denied' | 'undetermined';

export type LocalReminderNotificationContent = Readonly<{
  title: string;
  body: string;
  sound: 'default';
  data: Readonly<{
    type: 'medication-reminder';
    scheduleId: string;
    occurrenceKey: string;
  }>;
}>;

export type LocalReminderNotificationRequest = Readonly<{
  content: LocalReminderNotificationContent;
  triggerAt: Date;
}>;

/** Narrow native boundary so scheduler logic remains deterministic in Jest. */
export interface LocalReminderNotificationPort {
  getPermission(): Promise<LocalReminderPermission>;
  requestPermission(): Promise<LocalReminderPermission>;
  getScheduledNotificationIds(): Promise<readonly string[]>;
  scheduleNotification(request: LocalReminderNotificationRequest): Promise<string>;
  cancelScheduledNotification(notificationId: string): Promise<void>;
}

/** Only opaque MediCare-owned reminder metadata is persisted locally. */
export interface LocalReminderStoragePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export type LocalReminderOccurrence = Readonly<{
  ownerUid: string;
  scheduleId: string;
  occurrenceKey: string;
  scheduledLocalDate: string;
  scheduledLocalTime: string;
  scheduledAt: Date;
}>;

type StoredReminder = Readonly<{
  ownerUid: string;
  scheduleId: string;
  occurrenceKey: string;
  notificationId: string;
}>;

type StoredReminderState = Readonly<{
  version: 1;
  consentedUserIds: readonly string[];
  reminders: readonly StoredReminder[];
}>;

export type LocalReminderSyncInput = Readonly<{
  userId: string;
  schedules: readonly MedicationSchedule[];
  medications: readonly Medication[];
  now?: Date;
}>;

export type LocalReminderSyncResult = Readonly<{
  status: 'synced' | 'needs-consent' | 'permission-denied' | 'stale';
  scheduledCount: number;
  cancelledCount: number;
}>;

function createEmptyState(): StoredReminderState {
  return { version: 1, consentedUserIds: [], reminders: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredReminder(value: unknown): value is StoredReminder {
  return isRecord(value)
    && typeof value.ownerUid === 'string'
    && typeof value.scheduleId === 'string'
    && typeof value.occurrenceKey === 'string'
    && typeof value.notificationId === 'string';
}

function parseStoredState(value: string | null): StoredReminderState {
  if (!value) {
    return createEmptyState();
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!isRecord(parsed)
      || parsed.version !== 1
      || !Array.isArray(parsed.consentedUserIds)
      || parsed.consentedUserIds.some((uid) => typeof uid !== 'string')
      || !Array.isArray(parsed.reminders)
      || !parsed.reminders.every(isStoredReminder)) {
      return createEmptyState();
    }

    return {
      version: 1,
      consentedUserIds: [...new Set(parsed.consentedUserIds)],
      reminders: parsed.reminders,
    };
  } catch {
    return createEmptyState();
  }
}

function assertUserId(userId: string): string {
  const normalized = userId.trim();

  if (!normalized) {
    throw new Error('Không thể xác định tài khoản hiện tại để đồng bộ lời nhắc.');
  }

  return normalized;
}

function hcmCalendarParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: localReminderTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = Number(valueFor('year'));
  const month = Number(valueFor('month'));
  const day = Number(valueFor('day'));

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error('Không thể xác định ngày lời nhắc theo múi giờ Việt Nam.');
  }

  return { year, month, day };
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function calendarDayAtOffset(now: Date, offset: number): { isoDate: string; weekday: MedicationScheduleWeekday } {
  const { year, month, day } = hcmCalendarParts(now);
  // Date.UTC is used solely for calendar arithmetic after HCM date parts were selected.
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  const weekday = (date.getUTCDay() === 0 ? 7 : date.getUTCDay()) as MedicationScheduleWeekday;

  return {
    isoDate: formatIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()),
    weekday,
  };
}

function parseLocalTime(localTime: string): { hours: number; minutes: number } | null {
  const match = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.exec(localTime);

  return match ? { hours: Number(match[0].slice(0, 2)), minutes: Number(match[0].slice(3, 5)) } : null;
}

/** Builds an instant from a wall-clock date/time in the fixed HCM timezone. */
export function getHcmScheduledAt(localDate: string, localTime: string): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  const time = parseLocalTime(localTime);

  if (!dateMatch || !time) {
    throw new Error('Ngày hoặc giờ lịch thuốc không hợp lệ để tạo lời nhắc.');
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));

  if (calendarCheck.getUTCFullYear() !== year
    || calendarCheck.getUTCMonth() !== month - 1
    || calendarCheck.getUTCDate() !== day) {
    throw new Error('Ngày lịch thuốc không tồn tại để tạo lời nhắc.');
  }

  return new Date(Date.UTC(year, month - 1, day, time.hours, time.minutes) - asiaHoChiMinhUtcOffsetMilliseconds);
}

function isScheduleDueOnDay(
  schedule: MedicationSchedule,
  isoDate: string,
  weekday: MedicationScheduleWeekday,
): boolean {
  const inDateRange = schedule.startDate <= isoDate
    && (schedule.endDate === null || isoDate <= schedule.endDate);
  const recurrenceMatches = schedule.recurrence === 'daily'
    || (schedule.recurrence === 'weekly' && schedule.weekdays.includes(weekday));

  return schedule.active && inDateRange && recurrenceMatches;
}

export function getLocalReminderOccurrenceKey(
  ownerUid: string,
  scheduleId: string,
  scheduledLocalDate: string,
  scheduledLocalTime: string,
): string {
  return `mcare-reminder:${ownerUid}:${scheduleId}:${scheduledLocalDate}:${scheduledLocalTime}`;
}

/**
 * Computes only future, active HCM occurrences in a bounded window. It never
 * uses the device timezone and never includes medicine names in reminder data.
 */
export function getUpcomingLocalReminderOccurrences(
  input: LocalReminderSyncInput,
): LocalReminderOccurrence[] {
  const userId = assertUserId(input.userId);
  const now = input.now ?? new Date();
  const activeMedicationIds = new Set(
    input.medications.filter((medication) => medication.status === 'active').map((medication) => medication.id),
  );
  const seen = new Set<string>();
  const occurrences: LocalReminderOccurrence[] = [];

  for (let offset = 0; offset < localReminderRollingHorizonDays; offset += 1) {
    const { isoDate, weekday } = calendarDayAtOffset(now, offset);

    for (const schedule of input.schedules) {
      if (!activeMedicationIds.has(schedule.medicationId)
        || schedule.timeZone !== localReminderTimeZone
        || !isScheduleDueOnDay(schedule, isoDate, weekday)) {
        continue;
      }

      const scheduledAt = getHcmScheduledAt(isoDate, schedule.localTime);

      if (scheduledAt.getTime() <= now.getTime()) {
        continue;
      }

      const occurrenceKey = getLocalReminderOccurrenceKey(userId, schedule.id, isoDate, schedule.localTime);

      if (seen.has(occurrenceKey)) {
        continue;
      }
      seen.add(occurrenceKey);
      occurrences.push({
        ownerUid: userId,
        scheduleId: schedule.id,
        occurrenceKey,
        scheduledLocalDate: isoDate,
        scheduledLocalTime: schedule.localTime,
        scheduledAt,
      });
    }
  }

  return occurrences.sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime());
}

function notificationRequestFor(occurrence: LocalReminderOccurrence): LocalReminderNotificationRequest {
  return {
    content: {
      title: 'MediCare AI',
      body: 'Bạn có một lời nhắc cần xem.',
      sound: 'default',
      data: {
        type: 'medication-reminder',
        scheduleId: occurrence.scheduleId,
        occurrenceKey: occurrence.occurrenceKey,
      },
    },
    triggerAt: occurrence.scheduledAt,
  };
}

function mapReminderByKey(reminders: readonly StoredReminder[]): Map<string, StoredReminder> {
  return new Map(reminders.map((reminder) => [reminder.occurrenceKey, reminder]));
}

/**
 * Local-only notification synchronizer. It never calls cancelAll and has no
 * Firebase dependency; Rules do not grant clients any notification documents.
 */
export class LocalReminderService {
  private operationVersion = 0;

  constructor(
    private readonly notifications: LocalReminderNotificationPort,
    private readonly storage: LocalReminderStoragePort,
  ) {}

  private beginOperation(): number {
    this.operationVersion += 1;
    return this.operationVersion;
  }

  private isCurrentOperation(operationVersion: number): boolean {
    return operationVersion === this.operationVersion;
  }

  private async readState(): Promise<StoredReminderState> {
    return parseStoredState(await this.storage.getItem(localReminderStorageKey));
  }

  private async writeState(state: StoredReminderState): Promise<void> {
    await this.storage.setItem(localReminderStorageKey, JSON.stringify(state));
  }

  async syncIfConsented(input: LocalReminderSyncInput): Promise<LocalReminderSyncResult> {
    const operationVersion = this.beginOperation();
    const userId = assertUserId(input.userId);
    const state = await this.readState();

    if (!this.isCurrentOperation(operationVersion)) {
      return { status: 'stale', scheduledCount: 0, cancelledCount: 0 };
    }

    if (!state.consentedUserIds.includes(userId)) {
      return { status: 'needs-consent', scheduledCount: 0, cancelledCount: 0 };
    }

    const permission = await this.notifications.getPermission();

    if (!this.isCurrentOperation(operationVersion)) {
      return { status: 'stale', scheduledCount: 0, cancelledCount: 0 };
    }

    if (permission !== 'granted') {
      return { status: 'permission-denied', scheduledCount: 0, cancelledCount: 0 };
    }

    return this.synchronize(input, state, operationVersion);
  }

  /** Call only from a clearly labelled user interaction; it may show iOS permission UI. */
  async requestPermissionAndSync(input: LocalReminderSyncInput): Promise<LocalReminderSyncResult> {
    const operationVersion = this.beginOperation();
    const userId = assertUserId(input.userId);
    let permission = await this.notifications.getPermission();

    if (!this.isCurrentOperation(operationVersion)) {
      return { status: 'stale', scheduledCount: 0, cancelledCount: 0 };
    }

    if (permission !== 'granted') {
      permission = await this.notifications.requestPermission();
    }

    if (!this.isCurrentOperation(operationVersion)) {
      return { status: 'stale', scheduledCount: 0, cancelledCount: 0 };
    }

    if (permission !== 'granted') {
      return { status: 'permission-denied', scheduledCount: 0, cancelledCount: 0 };
    }

    const state = await this.readState();

    if (!this.isCurrentOperation(operationVersion)) {
      return { status: 'stale', scheduledCount: 0, cancelledCount: 0 };
    }

    const consentedUserIds = state.consentedUserIds.includes(userId)
      ? state.consentedUserIds
      : [...state.consentedUserIds, userId];
    const consentedState: StoredReminderState = { ...state, consentedUserIds };

    return this.synchronize(input, consentedState, operationVersion);
  }

  private async synchronize(
    input: LocalReminderSyncInput,
    state: StoredReminderState,
    operationVersion: number,
  ): Promise<LocalReminderSyncResult> {
    const userId = assertUserId(input.userId);
    const desired = getUpcomingLocalReminderOccurrences({ ...input, userId });
    const desiredKeys = new Set(desired.map((occurrence) => occurrence.occurrenceKey));
    const userReminders = state.reminders.filter((reminder) => reminder.ownerUid === userId);
    const otherReminders = state.reminders.filter((reminder) => reminder.ownerUid !== userId);
    const existingByKey = mapReminderByKey(userReminders);
    const scheduledIds = new Set(await this.notifications.getScheduledNotificationIds());

    if (!this.isCurrentOperation(operationVersion)) {
      return { status: 'stale', scheduledCount: 0, cancelledCount: 0 };
    }

    const retained: StoredReminder[] = [];
    let cancelledCount = 0;

    for (const reminder of userReminders) {
      if (desiredKeys.has(reminder.occurrenceKey) && scheduledIds.has(reminder.notificationId)) {
        retained.push(reminder);
        continue;
      }

      if (desiredKeys.has(reminder.occurrenceKey)) {
        // The OS no longer has this owned id (for example after a device
        // cleanup), so omit its stale mapping and create a fresh reminder.
        continue;
      }

      await this.notifications.cancelScheduledNotification(reminder.notificationId);

      if (!this.isCurrentOperation(operationVersion)) {
        return { status: 'stale', scheduledCount: 0, cancelledCount };
      }
      cancelledCount += 1;
    }

    let scheduledCount = 0;

    for (const occurrence of desired) {
      const existing = existingByKey.get(occurrence.occurrenceKey);

      if (existing && scheduledIds.has(existing.notificationId)) {
        continue;
      }

      const notificationId = await this.notifications.scheduleNotification(notificationRequestFor(occurrence));

      if (!this.isCurrentOperation(operationVersion)) {
        // This operation lost ownership (logout/account switch); do not leave a stale reminder behind.
        await this.notifications.cancelScheduledNotification(notificationId);
        return { status: 'stale', scheduledCount: 0, cancelledCount };
      }

      retained.push({
        ownerUid: userId,
        scheduleId: occurrence.scheduleId,
        occurrenceKey: occurrence.occurrenceKey,
        notificationId,
      });
      scheduledCount += 1;
    }

    if (!this.isCurrentOperation(operationVersion)) {
      return { status: 'stale', scheduledCount: 0, cancelledCount };
    }

    await this.writeState({
      version: 1,
      consentedUserIds: state.consentedUserIds,
      reminders: [...otherReminders, ...retained],
    });

    return { status: 'synced', scheduledCount, cancelledCount };
  }

  /** Removes only persisted MediCare reminder identifiers for one signed-out account. */
  async cancelUserReminders(userId: string): Promise<number> {
    const operationVersion = this.beginOperation();
    const normalizedUserId = assertUserId(userId);
    const state = await this.readState();

    if (!this.isCurrentOperation(operationVersion)) {
      return 0;
    }

    const userReminders = state.reminders.filter((reminder) => reminder.ownerUid === normalizedUserId);
    let cancelledCount = 0;

    for (const reminder of userReminders) {
      await this.notifications.cancelScheduledNotification(reminder.notificationId);

      if (!this.isCurrentOperation(operationVersion)) {
        return cancelledCount;
      }
      cancelledCount += 1;
    }

    await this.writeState({
      ...state,
      reminders: state.reminders.filter((reminder) => reminder.ownerUid !== normalizedUserId),
    });

    return cancelledCount;
  }
}

export const localReminderStorageMetadataKey = localReminderStorageKey;
