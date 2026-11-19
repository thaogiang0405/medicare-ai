import {
  medicationScheduleTimeZone,
  type DoseEvent,
  type DoseStatus,
  type Medication,
  type MedicationSchedule,
  type MedicationScheduleWeekday,
} from '@/types/domain';
import {
  getDoseEventId,
  getDoseEventScheduledAt,
  isDoseEventDue,
} from '@/features/schedules/domain/dose-tracking-repository';

const asiaHoChiMinhUtcOffsetMilliseconds = 7 * 60 * 60 * 1000;

export type ElderlyDashboardMedicationSchedule = Readonly<{
  schedule: MedicationSchedule;
  medication: Medication;
}>;

export type ElderlyDashboardDoseTrackingSchedule = ElderlyDashboardMedicationSchedule & Readonly<{
  event: DoseEvent | null;
  eventId: string;
  scheduledLocalDate: string;
  scheduledAt: string;
  status: DoseStatus;
  canRespond: boolean;
}>;

export type MedicationScheduleCalendarDay = Readonly<{
  isoDate: string;
  weekday: MedicationScheduleWeekday;
}>;

/** A missing medication must never crash the demonstration schedule. */
export function resolveMedicationForDose(
  event: DoseEvent,
  medications: readonly Medication[],
): Medication | null {
  return medications.find((medication) => medication.id === event.medicationId) ?? null;
}

/**
 * Resolves the calendar day from the schedule timezone rather than the device
 * timezone or UTC. The Date.UTC call is only a calendar weekday lookup after
 * the Asia/Ho_Chi_Minh date parts have already been selected.
 */
export function getMedicationScheduleCalendarDay(now: Date = new Date()): MedicationScheduleCalendarDay {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: medicationScheduleTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const findPart = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((part) => part.type === type)?.value;
  const year = findPart('year');
  const month = findPart('month');
  const day = findPart('day');

  if (!year || !month || !day) {
    throw new Error('Không thể xác định ngày lịch thuốc theo múi giờ Việt Nam.');
  }

  const isoDate = `${year}-${month}-${day}`;
  const utcWeekday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();
  const weekday = (utcWeekday === 0 ? 7 : utcWeekday) as MedicationScheduleWeekday;

  return { isoDate, weekday };
}

/** Returns the delay to the next Asia/Ho_Chi_Minh midnight for a safe day refresh. */
export function millisecondsUntilNextMedicationScheduleDay(now: Date = new Date()): number {
  const { isoDate } = getMedicationScheduleCalendarDay(now);
  const [year, month, day] = isoDate.split('-').map(Number);
  const nextHcmMidnight = Date.UTC(year, month - 1, day + 1) - asiaHoChiMinhUtcOffsetMilliseconds;

  return Math.max(1_000, nextHcmMidnight - now.getTime());
}

/**
 * Joins active medication plans to active medications for the current
 * Asia/Ho_Chi_Minh day. A duplicate document id is ignored, while distinct
 * plans at the same time remain visible because a medicine can have more than
 * one schedule.
 */
export function getTodayMedicationSchedules(
  schedules: readonly MedicationSchedule[],
  medications: readonly Medication[],
  now: Date = new Date(),
): ElderlyDashboardMedicationSchedule[] {
  const { isoDate, weekday } = getMedicationScheduleCalendarDay(now);
  const activeMedications = new Map(
    medications
      .filter((medication) => medication.status === 'active')
      .map((medication) => [medication.id, medication] as const),
  );
  const seenScheduleIds = new Set<string>();
  const todaySchedules: ElderlyDashboardMedicationSchedule[] = [];

  for (const schedule of schedules) {
    if (seenScheduleIds.has(schedule.id)) {
      continue;
    }
    seenScheduleIds.add(schedule.id);

    const medication = activeMedications.get(schedule.medicationId);
    const isWithinDateRange = schedule.startDate <= isoDate
      && (schedule.endDate === null || isoDate <= schedule.endDate);
    const repeatsToday = schedule.recurrence === 'daily'
      || (schedule.recurrence === 'weekly' && schedule.weekdays.includes(weekday));

    if (schedule.active && medication && isWithinDateRange && repeatsToday) {
      todaySchedules.push({ schedule, medication });
    }
  }

  return todaySchedules.sort((left, right) =>
    left.schedule.localTime.localeCompare(right.schedule.localTime)
    || left.medication.name.localeCompare(right.medication.name, 'vi')
    || left.schedule.id.localeCompare(right.schedule.id));
}

/**
 * Adds persisted self-reports to real plans without inventing an event for an
 * unanswered occurrence. Schedule documents remain the source of planned time.
 */
export function getTodayDoseTrackingSchedules(
  schedules: readonly MedicationSchedule[],
  medications: readonly Medication[],
  events: readonly DoseEvent[],
  now: Date = new Date(),
): ElderlyDashboardDoseTrackingSchedule[] {
  const { isoDate } = getMedicationScheduleCalendarDay(now);
  const eventsById = new Map(events.map((event) => [event.id, event] as const));

  return getTodayMedicationSchedules(schedules, medications, now).map(({ schedule, medication }) => {
    const eventId = getDoseEventId(schedule.id, isoDate, schedule.localTime);
    const scheduledAt = getDoseEventScheduledAt(isoDate, schedule.localTime);
    const event = eventsById.get(eventId) ?? null;

    return {
      schedule,
      medication,
      event,
      eventId,
      scheduledLocalDate: isoDate,
      scheduledAt,
      status: event?.status ?? 'pending',
      canRespond: event === null && isDoseEventDue({ scheduledAt }, now),
    };
  });
}

/** Real plans are enabled only when both dependent Firestore surfaces are on. */
export function shouldShowFirestoreMedicationSchedules(
  medicationsFeatureEnabled: boolean,
  schedulesFeatureEnabled: boolean,
): boolean {
  return medicationsFeatureEnabled && schedulesFeatureEnabled;
}

/** Rejects stale store data after logout or an account switch. */
export function hasDashboardDataForCurrentUser(
  sessionUserId: string | undefined,
  storeUserId: string | null,
): boolean {
  return Boolean(sessionUserId) && storeUserId === sessionUserId;
}
