/* eslint-disable import/first */

jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@/services/firebase', () => ({
  getFirebaseAuth: jest.fn(),
  getFirebaseFirestore: jest.fn(),
}));

import type {
  MedicationScheduleCreateInput,
  MedicationScheduleUpdateInput,
} from '../domain/medication-schedule-repository';

import {
  FirestoreMedicationScheduleRepository,
  type FirestoreMedicationScheduleDocument,
  type FirestoreMedicationSchedulePort,
  mapFirestoreMedicationScheduleDocument,
} from './firestore-medication-schedule-repository';

const elderlyUid = 'elderly-a';
const caregiverUid = 'caregiver-a';

const validCreateInput: MedicationScheduleCreateInput = {
  medicationId: 'medication-a',
  recurrence: 'daily',
  localTime: '08:00',
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  startDate: '2026-11-19',
  endDate: null,
};

const validUpdateInput: MedicationScheduleUpdateInput = {
  recurrence: 'weekly',
  localTime: '20:00',
  weekdays: [1, 3, 5],
  startDate: '2026-11-19',
  endDate: '2026-12-31',
};

function scheduleDocument(
  id = 'schedule-a',
  overrides: Record<string, unknown> = {},
): FirestoreMedicationScheduleDocument {
  return {
    id,
    data: {
      ownerUid: elderlyUid,
      ...validCreateInput,
      timeZone: 'Asia/Ho_Chi_Minh',
      active: true,
      revision: 1,
      createdAt: new Date('2026-11-19T00:00:00.000Z'),
      updatedAt: new Date('2026-11-19T00:00:01.000Z'),
      ...overrides,
    },
  };
}

function createSchedulePort(
  overrides: Partial<FirestoreMedicationSchedulePort> = {},
): FirestoreMedicationSchedulePort {
  return {
    getCurrentAuthUser: () => ({ uid: elderlyUid }),
    listMedicationScheduleDocuments: async () => [],
    getMedicationScheduleDocument: async () => null,
    createMedicationScheduleDocument: async (ownerUid, input) => scheduleDocument('schedule-created', { ownerUid, ...input }),
    updateMedicationScheduleDocument: async (ownerUid, scheduleId, input) =>
      scheduleDocument(scheduleId, { ownerUid, ...input, revision: 2 }),
    pauseMedicationScheduleDocument: async (ownerUid, scheduleId) =>
      scheduleDocument(scheduleId, { ownerUid, active: false, revision: 2 }),
    ...overrides,
  };
}

describe('FirestoreMedicationScheduleRepository', () => {
  it('maps owner collection documents and filters only within the portable repository', async () => {
    const listMedicationScheduleDocuments = jest.fn(async () => [
      scheduleDocument('schedule-active'),
      scheduleDocument('schedule-paused', { active: false, medicationId: 'medication-b' }),
    ]);
    const repository = new FirestoreMedicationScheduleRepository(
      createSchedulePort({ listMedicationScheduleDocuments }),
    );

    await expect(repository.listMedicationSchedules(elderlyUid, { active: true })).resolves.toEqual([
      expect.objectContaining({ id: 'schedule-active', active: true }),
    ]);
    await expect(repository.listMedicationSchedules(elderlyUid, { medicationId: 'medication-b' })).resolves.toEqual([
      expect.objectContaining({ id: 'schedule-paused', medicationId: 'medication-b' }),
    ]);
    expect(listMedicationScheduleDocuments).toHaveBeenCalledWith(elderlyUid);
  });

  it('derives every path from Firebase Auth and rejects a UI UID mismatch', async () => {
    await expect(
      new FirestoreMedicationScheduleRepository(createSchedulePort()).listMedicationSchedules(caregiverUid),
    ).rejects.toThrow('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    await expect(
      new FirestoreMedicationScheduleRepository(
        createSchedulePort({ getCurrentAuthUser: () => null }),
      ).listMedicationSchedules(elderlyUid),
    ).rejects.toThrow('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  });

  it('drops reads and writes if Firebase Auth changes while a request is pending', async () => {
    let reads = 0;
    const repository = new FirestoreMedicationScheduleRepository(
      createSchedulePort({
        getCurrentAuthUser: () => ({ uid: reads++ === 0 ? elderlyUid : caregiverUid }),
        listMedicationScheduleDocuments: async () => [scheduleDocument()],
      }),
    );

    await expect(repository.listMedicationSchedules(elderlyUid)).rejects.toThrow(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    );
  });

  it('normalizes create input and delegates get, transaction-backed update, and pause through the port', async () => {
    const createMedicationScheduleDocument = jest.fn(async (ownerUid: string, input: MedicationScheduleCreateInput) =>
      scheduleDocument('schedule-created', { ownerUid, ...input }),
    );
    const getMedicationScheduleDocument = jest.fn(async () => scheduleDocument());
    const updateMedicationScheduleDocument = jest.fn(async (
      ownerUid: string,
      scheduleId: string,
      input: MedicationScheduleUpdateInput,
    ) => scheduleDocument(scheduleId, { ownerUid, ...input, revision: 2 }));
    const pauseMedicationScheduleDocument = jest.fn(async (ownerUid: string, scheduleId: string) =>
      scheduleDocument(scheduleId, { ownerUid, active: false, revision: 2 }));
    const repository = new FirestoreMedicationScheduleRepository(
      createSchedulePort({
        createMedicationScheduleDocument,
        getMedicationScheduleDocument,
        updateMedicationScheduleDocument,
        pauseMedicationScheduleDocument,
      }),
    );

    await expect(repository.createMedicationSchedule(elderlyUid, {
      ...validCreateInput,
      localTime: ' 08:00 ',
    })).resolves.toMatchObject({ id: 'schedule-created', localTime: '08:00' });
    await expect(repository.getMedicationScheduleById(elderlyUid, 'schedule-a')).resolves.toMatchObject({ id: 'schedule-a' });
    await expect(repository.updateMedicationSchedule(elderlyUid, 'schedule-a', validUpdateInput)).resolves.toMatchObject({
      id: 'schedule-a',
      recurrence: 'weekly',
    });
    await expect(repository.pauseMedicationSchedule(elderlyUid, 'schedule-a')).resolves.toMatchObject({ active: false });
    expect(createMedicationScheduleDocument).toHaveBeenCalledWith(elderlyUid, {
      ...validCreateInput,
      localTime: '08:00',
    });
    expect(getMedicationScheduleDocument).toHaveBeenCalledWith(elderlyUid, 'schedule-a');
    expect(updateMedicationScheduleDocument).toHaveBeenCalledWith(elderlyUid, 'schedule-a', validUpdateInput);
    expect(pauseMedicationScheduleDocument).toHaveBeenCalledWith(elderlyUid, 'schedule-a');
  });

  it('rejects mismatched owners, malformed DTOs, and raw Firestore errors without exposing source data', async () => {
    const repository = new FirestoreMedicationScheduleRepository(
      createSchedulePort({
        getMedicationScheduleDocument: async () => scheduleDocument('schedule-a', { ownerUid: caregiverUid }),
      }),
    );

    await expect(repository.getMedicationScheduleById(elderlyUid, 'schedule-a')).rejects.toThrow(
      'Dữ liệu lịch uống thuốc không khớp với tài khoản hiện tại.',
    );
    expect(() => mapFirestoreMedicationScheduleDocument(
      scheduleDocument('bad', { nextOccurrenceAt: new Date() }),
      elderlyUid,
    )).toThrow('Dữ liệu lịch uống thuốc lưu trữ không hợp lệ.');
    await expect(
      new FirestoreMedicationScheduleRepository(
        createSchedulePort({
          listMedicationScheduleDocuments: async () => Promise.reject({ code: 'permission-denied', message: 'sensitive detail' }),
        }),
      ).listMedicationSchedules(elderlyUid),
    ).rejects.toThrow('Bạn không có quyền truy cập lịch uống thuốc của tài khoản này.');
  });
});
