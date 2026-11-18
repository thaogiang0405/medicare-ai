/* eslint-disable import/first */

jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@/services/firebase', () => ({
  getFirebaseAuth: jest.fn(),
  getFirebaseFirestore: jest.fn(),
}));

import type { MedicationInput } from '../domain/medication-repository';

import {
  FirestoreMedicationRepository,
  type FirestoreMedicationDocument,
  type FirestoreMedicationPort,
  mapFirestoreMedicationDocument,
} from './firestore-medication-repository';

const elderlyUid = 'elderly-a';
const caregiverUid = 'caregiver-a';

const validInput: MedicationInput = {
  name: 'Paracetamol',
  strengthText: '500 mg',
  directionsText: 'Nội dung do người dùng cung cấp',
};

function medicationDocument(
  id = 'medication-a',
  overrides: Record<string, unknown> = {},
): FirestoreMedicationDocument {
  return {
    id,
    data: {
      ownerUid: elderlyUid,
      ...validInput,
      status: 'active',
      revision: 1,
      createdAt: new Date('2026-11-18T00:00:00.000Z'),
      updatedAt: new Date('2026-11-18T00:00:01.000Z'),
      ...overrides,
    },
  };
}

function createMedicationPort(overrides: Partial<FirestoreMedicationPort> = {}): FirestoreMedicationPort {
  return {
    getCurrentAuthUser: () => ({ uid: elderlyUid }),
    listMedicationDocuments: async () => [],
    getMedicationDocument: async () => null,
    createMedicationDocument: async (ownerUid, input) => medicationDocument('medication-created', { ownerUid, ...input }),
    updateMedicationDocument: async (ownerUid, medicationId, input) => medicationDocument(medicationId, { ownerUid, ...input }),
    markMedicationInactiveDocument: async (ownerUid, medicationId) =>
      medicationDocument(medicationId, { ownerUid, status: 'inactive', revision: 2 }),
    ...overrides,
  };
}

describe('FirestoreMedicationRepository', () => {
  it('maps only the owner collection and filters status in the portable repository', async () => {
    const listMedicationDocuments = jest.fn(async () => [
      medicationDocument('active-medication'),
      medicationDocument('inactive-medication', { status: 'inactive' }),
    ]);
    const repository = new FirestoreMedicationRepository(createMedicationPort({ listMedicationDocuments }));

    await expect(repository.listMedications(elderlyUid, { status: 'active' })).resolves.toEqual([
      expect.objectContaining({ id: 'active-medication', status: 'active' }),
    ]);
    expect(listMedicationDocuments).toHaveBeenCalledWith(elderlyUid);
    await expect(repository.getActiveMedications(elderlyUid)).resolves.toHaveLength(1);
  });

  it('derives access from Firebase Auth and rejects a UI UID that differs from it', async () => {
    const port = createMedicationPort();
    const repository = new FirestoreMedicationRepository(port);

    await expect(repository.listMedications(caregiverUid)).rejects.toThrow(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    );
    await expect(
      new FirestoreMedicationRepository(createMedicationPort({ getCurrentAuthUser: () => null }))
        .listMedications(elderlyUid),
    ).rejects.toThrow('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  });

  it('drops a result if Firebase Auth changes while a request is in flight', async () => {
    let reads = 0;
    const repository = new FirestoreMedicationRepository(
      createMedicationPort({
        getCurrentAuthUser: () => ({ uid: reads++ === 0 ? elderlyUid : caregiverUid }),
        listMedicationDocuments: async () => [medicationDocument()],
      }),
    );

    await expect(repository.listMedications(elderlyUid)).rejects.toThrow(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    );
  });

  it('returns a safe session error after a write if Firebase Auth changes during the request', async () => {
    let reads = 0;
    const createMedicationDocument = jest.fn(async (ownerUid: string, input: MedicationInput) =>
      medicationDocument('medication-created', { ownerUid, ...input }),
    );
    const repository = new FirestoreMedicationRepository(
      createMedicationPort({
        getCurrentAuthUser: () => ({ uid: reads++ === 0 ? elderlyUid : caregiverUid }),
        createMedicationDocument,
      }),
    );

    await expect(repository.createMedication(elderlyUid, validInput)).rejects.toThrow(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    );
    expect(createMedicationDocument).toHaveBeenCalledWith(elderlyUid, validInput);
  });

  it('normalizes user input before writing and maps a created owner document', async () => {
    const createMedicationDocument = jest.fn(async (ownerUid: string, input: MedicationInput) =>
      medicationDocument('medication-created', { ownerUid, ...input }),
    );
    const repository = new FirestoreMedicationRepository(createMedicationPort({ createMedicationDocument }));

    await expect(
      repository.createMedication(elderlyUid, {
        ...validInput,
        name: '  Paracetamol  ',
      }),
    ).resolves.toMatchObject({ id: 'medication-created', name: 'Paracetamol' });
    expect(createMedicationDocument).toHaveBeenCalledWith(elderlyUid, {
      ...validInput,
      name: 'Paracetamol',
    });
  });

  it('uses the repository port for get, transaction-backed update, and inactivation', async () => {
    const getMedicationDocument = jest.fn(async () => medicationDocument());
    const updateMedicationDocument = jest.fn(async (ownerUid: string, medicationId: string, input: MedicationInput) =>
      medicationDocument(medicationId, { ownerUid, ...input, revision: 2 }),
    );
    const markMedicationInactiveDocument = jest.fn(async (ownerUid: string, medicationId: string) =>
      medicationDocument(medicationId, { ownerUid, status: 'inactive', revision: 2 }),
    );
    const repository = new FirestoreMedicationRepository(
      createMedicationPort({
        getMedicationDocument,
        updateMedicationDocument,
        markMedicationInactiveDocument,
      }),
    );

    await expect(repository.getMedicationById(elderlyUid, 'medication-a')).resolves.toMatchObject({ id: 'medication-a' });
    await expect(repository.updateMedication(elderlyUid, 'medication-a', validInput)).resolves.toMatchObject({
      id: 'medication-a',
      name: validInput.name,
    });
    await expect(repository.markMedicationInactive(elderlyUid, 'medication-a')).resolves.toMatchObject({ status: 'inactive' });
    expect(getMedicationDocument).toHaveBeenCalledWith(elderlyUid, 'medication-a');
    expect(updateMedicationDocument).toHaveBeenCalledWith(elderlyUid, 'medication-a', validInput);
    expect(markMedicationInactiveDocument).toHaveBeenCalledWith(elderlyUid, 'medication-a');
  });

  it('rejects a mismatched owner, malformed DTO, and raw Firestore permission error without exposing data', async () => {
    const repository = new FirestoreMedicationRepository(
      createMedicationPort({
        getMedicationDocument: async () => medicationDocument('medication-a', { ownerUid: caregiverUid }),
      }),
    );

    await expect(repository.getMedicationById(elderlyUid, 'medication-a')).rejects.toThrow(
      'Dữ liệu thuốc không khớp với tài khoản hiện tại.',
    );
    expect(() => mapFirestoreMedicationDocument(medicationDocument('bad', { extraField: true }), elderlyUid)).toThrow(
      'Dữ liệu thuốc lưu trữ không hợp lệ.',
    );
    await expect(
      new FirestoreMedicationRepository(
        createMedicationPort({
          listMedicationDocuments: async () => Promise.reject({ code: 'permission-denied', message: 'sensitive detail' }),
        }),
      ).listMedications(elderlyUid),
    ).rejects.toThrow('Bạn không có quyền truy cập dữ liệu thuốc của tài khoản này.');
  });
});
