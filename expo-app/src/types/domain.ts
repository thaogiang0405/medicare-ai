/**
 * Shared domain models for the Expo migration.
 *
 * These models deliberately contain no Firebase types so presentation and
 * business logic stay portable while Migration 1 uses mock data.
 */
export type UserRole = 'elderly' | 'caregiver';

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
