import type { MedicationListStatus } from '@/features/medications/domain/medication-repository';
import type { Medication } from '@/types/domain';

function hasQueryMatch(medication: Medication, query: string): boolean {
  return medication.name.toLocaleLowerCase('vi-VN').includes(query.toLocaleLowerCase('vi-VN'));
}

/**
 * Client-side display filtering only. Repository ownership remains enforced by
 * the currently authenticated session before records reach this function.
 */
export function filterVisibleMedications(
  medications: readonly Medication[],
  status: MedicationListStatus,
  rawQuery: string,
): Medication[] {
  const normalizedQuery = rawQuery.trim();

  return medications.filter(
    (medication) =>
      (status === 'all' || medication.status === status)
      && (!normalizedQuery || hasQueryMatch(medication, normalizedQuery)),
  );
}
