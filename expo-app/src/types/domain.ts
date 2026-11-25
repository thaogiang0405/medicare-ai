/**
 * Shared domain models for the Expo migration.
 *
 * These models deliberately contain no Firebase types so presentation and
 * business logic stay portable while Migration 1 uses mock data.
 */
export type UserRole = 'elderly' | 'caregiver';

export const userProfileLocale = 'vi' as const;
export const userProfileTimeZone = 'Asia/Ho_Chi_Minh' as const;

export type UserProfileRoles = Readonly<{
  elderly: boolean;
  caregiver: boolean;
}>;

/**
 * Portable representation of the Firestore `/users/{uid}` document.
 * Firebase Timestamp values are mapped to Date here so UI code never depends
 * on a Firebase SDK type.
 */
export interface UserProfile {
  uid: string;
  displayName: string;
  primaryRole: UserRole;
  roles: UserProfileRoles;
  locale: typeof userProfileLocale;
  timeZone: typeof userProfileTimeZone;
  onboardingCompleted: true;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppUser {
  id: string;
  displayName: string;
  role: UserRole | null;
  isAuthenticated: boolean;
}

export type MedicationStatus = 'active' | 'inactive';

export interface Medication {
  id: string;
  name: string;
  strengthText: string;
  directionsText: string;
  status: MedicationStatus;
  /**
   * In-memory ISO timestamps keep the portable model ready for a future
   * Firestore mapping. They are not clinical timestamps or dose history.
   */
  createdAt: string;
  updatedAt: string;
}

/** Week starts on Monday (1) and ends on Sunday (7) for Vietnamese UI copy. */
export type MedicationScheduleWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type MedicationScheduleRecurrence = 'daily' | 'weekly';

export const medicationScheduleTimeZone = 'Asia/Ho_Chi_Minh' as const;

/**
 * A local administration plan entered by the profile owner. It is not a dose
 * event, notification, prescription, or clinical dosage recommendation.
 */
export interface MedicationSchedule {
  id: string;
  medicationId: string;
  recurrence: MedicationScheduleRecurrence;
  /** Local wall-clock time in the schedule's IANA timezone, formatted HH:mm. */
  localTime: string;
  /** Canonical sorted weekday selection. Daily schedules contain all seven days. */
  weekdays: MedicationScheduleWeekday[];
  /** Calendar dates remain ISO date-only values to avoid an accidental UTC shift. */
  startDate: string;
  endDate: string | null;
  timeZone: typeof medicationScheduleTimeZone;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DoseStatus =
  | 'pending'
  | 'reportedTaken'
  | 'reportedSkipped'
  | 'snoozed'
  | 'unanswered';

export type DoseResponseStatus = Extract<
  DoseStatus,
  'reportedTaken' | 'reportedSkipped' | 'snoozed'
>;

/** Only these final states can be persisted as a real self-reported response. */
export type PersistedDoseResponseStatus = Extract<
  DoseResponseStatus,
  'reportedTaken' | 'reportedSkipped'
>;

export type DoseEventResponseSource = 'selfReported';

/**
 * A point-in-time copy keeps the response understandable if its medication is
 * renamed or later inactivated. It is not a prescription or a recommendation.
 */
export interface DoseEventMedicationSnapshot {
  name: string;
  strengthText: string;
  directionsText: string;
}

/**
 * M3.4 records one immutable self-report per planned occurrence. Future
 * milestones may add server-trusted audit history without changing this model.
 */
export interface DoseEventResponseHistoryEntry {
  status: PersistedDoseResponseStatus;
  responseSource: DoseEventResponseSource;
  respondedAt: string;
  respondedBy: string;
}

export interface DoseEventResponseHistory {
  initial: DoseEventResponseHistoryEntry;
}

export interface DoseEvent {
  id: string;
  medicationId: string;
  scheduledAt: string;
  status: DoseStatus;
  respondedAt?: string;
  respondedBy?: string;
  /** Present only for an M3.4 Firestore self-report; demo events remain lean. */
  scheduleId?: string;
  ownerUid?: string;
  occurrenceKey?: string;
  scheduledLocalDate?: string;
  scheduledLocalTime?: string;
  timeZone?: typeof medicationScheduleTimeZone;
  medicationSnapshot?: DoseEventMedicationSnapshot;
  responseSource?: DoseEventResponseSource;
  responseHistory?: DoseEventResponseHistory;
  revision?: number;
}

export interface DoseEventWithMedication extends DoseEvent {
  medication: Medication;
}
