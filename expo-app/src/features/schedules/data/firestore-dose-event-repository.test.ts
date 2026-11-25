/* eslint-disable import/first */

jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@/services/firebase', () => ({
  getFirebaseAuth: jest.fn(),
  getFirebaseFirestore: jest.fn(),
}));

import type { DoseEventResponseInput } from '../domain/dose-tracking-repository';

import {
  FirestoreDoseEventRepository,
  mapFirestoreDoseEventDocument,
  type FirestoreDoseEventDocument,
  type FirestoreDoseEventPort,
} from './firestore-dose-event-repository';

const elderlyUid = 'elderly-a';
const caregiverUid = 'caregiver-a';

const validInput: DoseEventResponseInput = {
  scheduleId: 'schedule-a',
  medicationId: 'medication-a',
  scheduledLocalDate: '2020-01-01',
  scheduledLocalTime: '08:00',
  scheduledAt: '2020-01-01T01:00:00.000Z',
  occurrenceKey: '2020-01-01T08:00@Asia/Ho_Chi_Minh',
  medicationSnapshot: {
    name: 'Paracetamol',
    strengthText: '500 mg',
    directionsText: 'Theo hướng dẫn đã nhập',
  },
  status: 'reportedTaken',
};

function doseEventDocument(
  id = 'schedule-a__2020-01-01__08:00',
  overrides: Record<string, unknown> = {},
): FirestoreDoseEventDocument {
  const status = (overrides.status as string | undefined) ?? validInput.status;
  const respondedAt = overrides.respondedAt ?? new Date('2020-01-01T02:00:00.000Z');
  const respondedBy = overrides.respondedBy ?? elderlyUid;

  return {
    id,
    data: {
      ownerUid: elderlyUid,
      ...validInput,
      scheduledAt: new Date(validInput.scheduledAt),
      timeZone: 'Asia/Ho_Chi_Minh',
      status,
      responseSource: 'selfReported',
      respondedAt,
      respondedBy,
      responseHistory: {
        initial: {
          status,
          responseSource: 'selfReported',
          respondedAt,
          respondedBy,
        },
      },
      revision: 1,
      createdAt: new Date('2020-01-01T02:00:00.000Z'),
      updatedAt: new Date('2020-01-01T02:00:00.000Z'),
      ...overrides,
    },
  };
}

function createPort(overrides: Partial<FirestoreDoseEventPort> = {}): FirestoreDoseEventPort {
  return {
    getCurrentAuthUser: () => ({ uid: elderlyUid }),
    listDoseEventDocuments: async () => [],
    recordDoseEventDocument: async () => doseEventDocument(),
    ...overrides,
  };
}

describe('FirestoreDoseEventRepository', () => {
  it('derives a deterministic event ID and maps a final self-report response', async () => {
    const recordDoseEventDocument = jest.fn(async () => doseEventDocument());
    const repository = new FirestoreDoseEventRepository(createPort({ recordDoseEventDocument }));

    await expect(repository.recordDoseResponse(elderlyUid, validInput)).resolves.toMatchObject({
      id: 'schedule-a__2020-01-01__08:00',
      scheduleId: 'schedule-a',
      status: 'reportedTaken',
      responseHistory: { initial: { responseSource: 'selfReported', respondedBy: elderlyUid } },
    });
    expect(recordDoseEventDocument).toHaveBeenCalledWith(
      elderlyUid,
      'schedule-a__2020-01-01__08:00',
      validInput,
    );
  });

  it('loads only the requested HCM local day, preserving owner isolation and sorted records', async () => {
    const listDoseEventDocuments = jest.fn(async () => [
      doseEventDocument('schedule-b__2020-01-01__20:00', {
        scheduleId: 'schedule-b',
        scheduledLocalTime: '20:00',
        occurrenceKey: '2020-01-01T20:00@Asia/Ho_Chi_Minh',
        scheduledAt: new Date('2020-01-01T13:00:00.000Z'),
      }),
      doseEventDocument(),
    ]);
    const repository = new FirestoreDoseEventRepository(createPort({ listDoseEventDocuments }));

    await expect(repository.listDoseEventsForLocalDate(elderlyUid, '2020-01-01')).resolves.toEqual([
      expect.objectContaining({ id: 'schedule-a__2020-01-01__08:00' }),
      expect.objectContaining({ id: 'schedule-b__2020-01-01__20:00' }),
    ]);
    expect(listDoseEventDocuments).toHaveBeenCalledWith(elderlyUid, '2020-01-01');
  });

  it('rejects a UI UID mismatch and a stale Auth identity before data can surface', async () => {
    await expect(
      new FirestoreDoseEventRepository(createPort()).listDoseEventsForLocalDate(caregiverUid, '2020-01-01'),
    ).rejects.toThrow('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');

    let authReads = 0;
    const repository = new FirestoreDoseEventRepository(createPort({
      getCurrentAuthUser: () => ({ uid: authReads++ === 0 ? elderlyUid : caregiverUid }),
      listDoseEventDocuments: async () => [doseEventDocument()],
    }));
    await expect(repository.listDoseEventsForLocalDate(elderlyUid, '2020-01-01')).rejects.toThrow(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    );
  });

  it('rejects malformed stored data, future client reports, and conflicting final statuses', async () => {
    expect(() => mapFirestoreDoseEventDocument(
      doseEventDocument('bad', { occurrenceKey: 'forged' }),
      elderlyUid,
    )).toThrow('Dữ liệu phản hồi uống thuốc không hợp lệ.');

    await expect(new FirestoreDoseEventRepository(createPort()).recordDoseResponse(elderlyUid, {
      ...validInput,
      scheduledLocalDate: '2099-01-01',
      scheduledLocalTime: '08:00',
      scheduledAt: '2099-01-01T01:00:00.000Z',
      occurrenceKey: '2099-01-01T08:00@Asia/Ho_Chi_Minh',
    })).rejects.toThrow('Chỉ có thể tự báo sau giờ uống thuốc dự kiến.');

    const existingSkipped = doseEventDocument(undefined, {
      status: 'reportedSkipped',
      responseHistory: {
        initial: {
          status: 'reportedSkipped',
          responseSource: 'selfReported',
          respondedAt: new Date('2020-01-01T02:00:00.000Z'),
          respondedBy: elderlyUid,
        },
      },
    });
    await expect(new FirestoreDoseEventRepository(createPort({
      recordDoseEventDocument: async () => existingSkipped,
    })).recordDoseResponse(elderlyUid, validInput)).rejects.toThrow(
      'Phản hồi cho lần uống này đã được xác nhận và không thể thay đổi.',
    );
  });
});
