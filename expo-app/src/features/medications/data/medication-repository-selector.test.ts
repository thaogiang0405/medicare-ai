import type { MedicationRepository } from '../domain/medication-repository';

import { mockMedicationRepository } from './mock-medication-repository';
import { selectMedicationRepository } from './medication-repository-selector';

describe('selectMedicationRepository', () => {
  it('keeps M3.1 mock mode without constructing a Firestore repository when the flag is false', () => {
    const getFirestoreRepository = jest.fn<MedicationRepository, []>();

    expect(selectMedicationRepository(false, getFirestoreRepository)).toBe(mockMedicationRepository);
    expect(getFirestoreRepository).not.toHaveBeenCalled();
  });

  it('selects the supplied Firestore repository only after explicit opt-in', () => {
    const firestoreRepository = {} as MedicationRepository;
    const getFirestoreRepository = jest.fn(() => firestoreRepository);

    expect(selectMedicationRepository(true, getFirestoreRepository)).toBe(firestoreRepository);
    expect(getFirestoreRepository).toHaveBeenCalledTimes(1);
  });
});
