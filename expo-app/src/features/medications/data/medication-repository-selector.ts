import { isFirestoreMedicationsFeatureEnabled } from '@/services/firebase/firestore-medication-feature';

import type { MedicationRepository } from '../domain/medication-repository';
import { getFirestoreMedicationRepository } from './firestore-medication-repository';
import { mockMedicationRepository } from './mock-medication-repository';

/** Keeps the existing M3.1 demo path as the safe default until local opt-in. */
export function selectMedicationRepository(
  firestoreEnabled: boolean,
  getFirestoreRepository: () => MedicationRepository = getFirestoreMedicationRepository,
): MedicationRepository {
  return firestoreEnabled
    ? getFirestoreRepository()
    : mockMedicationRepository;
}

export function getMedicationRepository(): MedicationRepository {
  return selectMedicationRepository(isFirestoreMedicationsFeatureEnabled());
}
