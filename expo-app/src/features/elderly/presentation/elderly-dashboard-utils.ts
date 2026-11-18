import type { DoseEvent, Medication } from '@/types/domain';

/** A missing medication must never crash the demonstration schedule. */
export function resolveMedicationForDose(
  event: DoseEvent,
  medications: readonly Medication[],
): Medication | null {
  return medications.find((medication) => medication.id === event.medicationId) ?? null;
}
