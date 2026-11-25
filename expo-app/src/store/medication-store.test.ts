import type { Medication } from '@/types/domain';
import type { MedicationRepository } from '@/features/medications';
import type { MedicationInput } from '@/features/medications/domain/medication-repository';

import {
  createMedicationStore,
  MedicationOperationInProgressError,
} from './medication-store';

const medicationInput: MedicationInput = {
  name: 'Vitamin D3',
  strengthText: '1.000 IU',
  directionsText: 'Nội dung do người dùng cung cấp',
};

function createMedication(id: string, name = 'Vitamin D3'): Medication {
  return {
    id,
    name,
    strengthText: '',
    directionsText: '',
    status: 'active',
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
  };
}

function createRepository(overrides: Partial<MedicationRepository> = {}): MedicationRepository {
  return {
    listMedications: jest.fn(async () => []),
    getActiveMedications: jest.fn(async () => []),
    getMedicationById: jest.fn(async () => null),
    createMedication: jest.fn(async () => createMedication('med-created')),
    updateMedication: jest.fn(async (_userId, id) => createMedication(id)),
    markMedicationInactive: jest.fn(async (_userId, id): Promise<Medication> => ({
      ...createMedication(id),
      status: 'inactive',
    })),
    ...overrides,
  };
}

describe('medication store', () => {
  it('prevents duplicate save operations while a create request is pending', async () => {
    let resolveCreate: ((medication: Medication) => void) | undefined;
    const pendingCreate = new Promise<Medication>((resolve) => {
      resolveCreate = resolve;
    });
    const repository = createRepository({ createMedication: jest.fn(() => pendingCreate) });
    const store = createMedicationStore(repository);

    await store.getState().loadForAuthenticatedUser('elderly-a');
    const firstSave = store.getState().createMedication(medicationInput);

    await expect(store.getState().createMedication(medicationInput)).rejects.toBeInstanceOf(
      MedicationOperationInProgressError,
    );
    expect(repository.createMedication).toHaveBeenCalledTimes(1);

    resolveCreate?.(createMedication('med-created'));
    await expect(firstSave).resolves.toMatchObject({ id: 'med-created' });
    expect(store.getState().medications).toHaveLength(1);
  });

  it('drops a stale medication list after switching authenticated accounts', async () => {
    let resolveA: ((medications: Medication[]) => void) | undefined;
    const listForA = new Promise<Medication[]>((resolve) => {
      resolveA = resolve;
    });
    const repository = createRepository({
      listMedications: jest.fn((userId: string) =>
        userId === 'elderly-a' ? listForA : Promise.resolve([createMedication('med-b', 'Thuốc của B')]),
      ),
    });
    const store = createMedicationStore(repository);

    const loadingA = store.getState().loadForAuthenticatedUser('elderly-a');
    await store.getState().loadForAuthenticatedUser('elderly-b');
    resolveA?.([createMedication('med-a', 'Thuốc của A')]);
    await loadingA;

    expect(store.getState()).toMatchObject({
      activeUserId: 'elderly-b',
      medications: [createMedication('med-b', 'Thuốc của B')],
      listStatus: 'ready',
    });
  });

  it('does not return an individual medication from a previous account after a switch', async () => {
    let resolveMedicationForA: ((medication: Medication | null) => void) | undefined;
    const medicationForA = new Promise<Medication | null>((resolve) => {
      resolveMedicationForA = resolve;
    });
    const repository = createRepository({
      getMedicationById: jest.fn((userId: string) =>
        userId === 'elderly-a' ? medicationForA : Promise.resolve(null),
      ),
    });
    const store = createMedicationStore(repository);

    await store.getState().loadForAuthenticatedUser('elderly-a');
    const lookupForA = store.getState().getMedicationById('med-a');
    await store.getState().loadForAuthenticatedUser('elderly-b');
    resolveMedicationForA?.(createMedication('med-a', 'Thuốc của A'));

    await expect(lookupForA).resolves.toBeNull();
    expect(store.getState()).toMatchObject({
      activeUserId: 'elderly-b',
      medications: [],
    });
  });

  it('clears rendered medication state on reset without asking the repository for another user', async () => {
    const repository = createRepository({
      listMedications: jest.fn(async () => [createMedication('med-a', 'Thuốc của A')]),
    });
    const store = createMedicationStore(repository);

    await store.getState().loadForAuthenticatedUser('elderly-a');
    store.getState().reset();

    expect(store.getState()).toMatchObject({
      activeUserId: null,
      medications: [],
      listStatus: 'idle',
    });
  });
});
