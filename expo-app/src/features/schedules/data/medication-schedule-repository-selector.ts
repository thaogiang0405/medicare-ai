import { isFirestoreSchedulesFeatureEnabled } from '@/services/firebase/firestore-schedule-feature';

import type { MedicationScheduleRepository } from '../domain/medication-schedule-repository';
import { getFirestoreMedicationScheduleRepository } from './firestore-medication-schedule-repository';
import { mockMedicationScheduleRepository } from './mock-medication-schedule-repository';

/** Keeps the local M3.3 mock path as the safe default until explicit opt-in. */
export function selectMedicationScheduleRepository(
  firestoreEnabled: boolean,
  getFirestoreRepository: () => MedicationScheduleRepository = getFirestoreMedicationScheduleRepository,
): MedicationScheduleRepository {
  return firestoreEnabled ? getFirestoreRepository() : mockMedicationScheduleRepository;
}

export function getMedicationScheduleRepository(): MedicationScheduleRepository {
  return selectMedicationScheduleRepository(isFirestoreSchedulesFeatureEnabled());
}
