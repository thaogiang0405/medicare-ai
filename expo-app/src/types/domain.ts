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

export interface DoseEvent {
  id: string;
  medicationId: string;
  scheduledAt: string;
  status: DoseStatus;
  respondedAt?: string;
  respondedBy?: string;
}

export interface DoseEventWithMedication extends DoseEvent {
  medication: Medication;
}
