import type { MedicationSchedule } from '@/types/domain';
import type {
  MedicationScheduleCreateInput,
  MedicationScheduleRepository,
} from '@/features/schedules';

import {
  createMedicationScheduleStore,
  MedicationScheduleOperationInProgressError,
} from './medication-schedule-store';

const scheduleInput: MedicationScheduleCreateInput = {
  medicationId: 'medication-a',
  recurrence: 'daily',
  localTime: '08:00',
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  startDate: '2026-11-19',
  endDate: null,
};

function createSchedule(id: string, medicationId = 'medication-a'): MedicationSchedule {
  return {
    id,
    medicationId,
    recurrence: 'daily',
    localTime: '08:00',
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startDate: '2026-11-19',
    endDate: null,
    timeZone: 'Asia/Ho_Chi_Minh',
    active: true,
    createdAt: '2026-11-19T00:00:00.000Z',
    updatedAt: '2026-11-19T00:00:00.000Z',
  };
}

function createRepository(overrides: Partial<MedicationScheduleRepository> = {}): MedicationScheduleRepository {
  return {
    listMedicationSchedules: jest.fn(async () => []),
    getMedicationScheduleById: jest.fn(async () => null),
    createMedicationSchedule: jest.fn(async () => createSchedule('schedule-created')),
    updateMedicationSchedule: jest.fn(async (_userId, id) => createSchedule(id)),
    pauseMedicationSchedule: jest.fn(async (_userId, id) => ({ ...createSchedule(id), active: false })),
    ...overrides,
  };
}

describe('medication schedule store', () => {
  it('prevents duplicate schedule saves while a mutation is pending', async () => {
    let resolveCreate: ((schedule: MedicationSchedule) => void) | undefined;
    const pendingCreate = new Promise<MedicationSchedule>((resolve) => {
      resolveCreate = resolve;
    });
    const repository = createRepository({ createMedicationSchedule: jest.fn(() => pendingCreate) });
    const store = createMedicationScheduleStore(repository);

    await store.getState().loadForAuthenticatedUser('elderly-a');
    const firstSave = store.getState().createSchedule(scheduleInput);

    await expect(store.getState().createSchedule(scheduleInput)).rejects.toBeInstanceOf(
      MedicationScheduleOperationInProgressError,
    );
    resolveCreate?.(createSchedule('schedule-created'));
    await expect(firstSave).resolves.toMatchObject({ id: 'schedule-created' });
  });

  it('drops a stale list response after an account switch', async () => {
    let resolveA: ((schedules: MedicationSchedule[]) => void) | undefined;
    const listForA = new Promise<MedicationSchedule[]>((resolve) => {
      resolveA = resolve;
    });
    const repository = createRepository({
      listMedicationSchedules: jest.fn((userId: string) =>
        userId === 'elderly-a' ? listForA : Promise.resolve([createSchedule('schedule-b', 'medication-b')]),
      ),
    });
    const store = createMedicationScheduleStore(repository);

    const loadingA = store.getState().loadForAuthenticatedUser('elderly-a');
    await store.getState().loadForAuthenticatedUser('elderly-b');
    resolveA?.([createSchedule('schedule-a')]);
    await loadingA;

    expect(store.getState()).toMatchObject({
      activeUserId: 'elderly-b',
      schedules: [createSchedule('schedule-b', 'medication-b')],
      listStatus: 'ready',
    });
  });

  it('does not return an individual schedule from a previous account after a switch', async () => {
    let resolveScheduleForA: ((schedule: MedicationSchedule | null) => void) | undefined;
    const scheduleForA = new Promise<MedicationSchedule | null>((resolve) => {
      resolveScheduleForA = resolve;
    });
    const repository = createRepository({
      getMedicationScheduleById: jest.fn((userId: string) =>
        userId === 'elderly-a' ? scheduleForA : Promise.resolve(null),
      ),
    });
    const store = createMedicationScheduleStore(repository);

    await store.getState().loadForAuthenticatedUser('elderly-a');
    const lookupForA = store.getState().getScheduleById('schedule-a');
    await store.getState().loadForAuthenticatedUser('elderly-b');
    resolveScheduleForA?.(createSchedule('schedule-a'));

    await expect(lookupForA).resolves.toBeNull();
    expect(store.getState()).toMatchObject({ activeUserId: 'elderly-b', schedules: [] });
  });

  it('resets account-bound schedule state without another repository request', async () => {
    const repository = createRepository({
      listMedicationSchedules: jest.fn(async () => [createSchedule('schedule-a')]),
    });
    const store = createMedicationScheduleStore(repository);

    await store.getState().loadForAuthenticatedUser('elderly-a');
    store.getState().reset();

    expect(store.getState()).toMatchObject({ activeUserId: null, schedules: [], listStatus: 'idle' });
  });
});
