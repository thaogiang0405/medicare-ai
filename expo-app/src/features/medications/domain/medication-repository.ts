import type { Medication } from '@/types/domain';

export const medicationFieldLimits = {
  name: 120,
  strengthText: 80,
  directionsText: 500,
} as const;

/**
 * User-entered text only. Medication management never derives dosage,
 * frequency, or schedule data from these fields.
 */
export type MedicationInput = Readonly<{
  name: string;
  strengthText: string;
  directionsText: string;
}>;

export type MedicationListStatus = Medication['status'] | 'all';

export type MedicationListOptions = Readonly<{
  status?: MedicationListStatus;
}>;

export interface MedicationRepository {
  listMedications(userId: string, options?: MedicationListOptions): Promise<Medication[]>;
  getActiveMedications(userId: string): Promise<Medication[]>;
  getMedicationById(userId: string, medicationId: string): Promise<Medication | null>;
  createMedication(userId: string, input: MedicationInput): Promise<Medication>;
  updateMedication(userId: string, medicationId: string, input: MedicationInput): Promise<Medication>;
  markMedicationInactive(userId: string, medicationId: string): Promise<Medication>;
}
