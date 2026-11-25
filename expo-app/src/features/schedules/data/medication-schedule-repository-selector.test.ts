import type { MedicationScheduleRepository } from '../domain/medication-schedule-repository';

import { mockMedicationScheduleRepository } from './mock-medication-schedule-repository';
import { selectMedicationScheduleRepository } from './medication-schedule-repository-selector';

describe('selectMedicationScheduleRepository', () => {
  it('keeps mock schedules as the default without constructing Firebase code', () => {
    const getFirestoreRepository = jest.fn<MedicationScheduleRepository, []>();

    expect(selectMedicationScheduleRepository(false, getFirestoreRepository)).toBe(mockMedicationScheduleRepository);
    expect(getFirestoreRepository).not.toHaveBeenCalled();
  });

  it('selects the supplied Firestore repository only after explicit opt-in', () => {
    const firestoreRepository = {} as MedicationScheduleRepository;
    const getFirestoreRepository = jest.fn(() => firestoreRepository);

    expect(selectMedicationScheduleRepository(true, getFirestoreRepository)).toBe(firestoreRepository);
    expect(getFirestoreRepository).toHaveBeenCalledTimes(1);
  });
});
