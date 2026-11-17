import type { Medication } from '@/types/domain';

export interface MedicationRepository {
  getActiveMedications(userId: string): Promise<Medication[]>;
  getMedicationById(medicationId: string): Promise<Medication | null>;
}
