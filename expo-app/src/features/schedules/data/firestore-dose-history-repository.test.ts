/* eslint-disable import/first */

jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@/services/firebase', () => ({
  getFirebaseAuth: jest.fn(),
  getFirebaseFirestore: jest.fn(),
}));

import type { DoseHistoryQuery } from '../domain/dose-history-repository';
import type { FirestoreDoseEventDocument } from './firestore-dose-event-repository';
import {
  FirestoreDoseHistoryRepository,
  type FirestoreDoseHistoryPort,
} from './firestore-dose-history-repository';

const elderlyUid = 'elderly-a';
const caregiverUid = 'caregiver-a';

function document(
  id: string,
  scheduledLocalDate: string,
  scheduledLocalTime: string,
): FirestoreDoseEventDocument {
  const [year, month, day] = scheduledLocalDate.split('-').map(Number);
  const [hours, minutes] = scheduledLocalTime.split(':').map(Number);
  const scheduledAt = new Date(Date.UTC(year, month - 1, day, hours, minutes) - (7 * 60 * 60 * 1000));
  const respondedAt = new Date(scheduledAt.getTime() + (60 * 1000));

  return {
    id,
    data: {
      ownerUid: elderlyUid,
      scheduleId: 'schedule-a',
      medicationId: 'medication-a',
      occurrenceKey: `${scheduledLocalDate}T${scheduledLocalTime}@Asia/Ho_Chi_Minh`,
      scheduledAt,
      scheduledLocalDate,
      scheduledLocalTime,
      timeZone: 'Asia/Ho_Chi_Minh',
      medicationSnapshot: { name: 'Paracetamol', strengthText: '500 mg', directionsText: 'Theo hướng dẫn' },
      status: 'reportedTaken',
      responseSource: 'selfReported',
      respondedAt,
      respondedBy: elderlyUid,
      responseHistory: {
        initial: { status: 'reportedTaken', responseSource: 'selfReported', respondedAt, respondedBy: elderlyUid },
      },
      revision: 1,
      createdAt: respondedAt,
      updatedAt: respondedAt,
    },
  };
}

function port(overrides: Partial<FirestoreDoseHistoryPort> = {}): FirestoreDoseHistoryPort {
  return {
    getCurrentAuthUser: () => ({ uid: elderlyUid }),
    listDoseHistoryDocuments: async () => [],
    ...overrides,
  };
}

const query: DoseHistoryQuery = {
  startLocalDate: '2026-11-16',
  endLocalDate: '2026-11-22',
  pageSize: 2,
};

describe('FirestoreDoseHistoryRepository', () => {
  it('reads only a bounded, owner-scoped page and returns a cursor for the last record', async () => {
    const listDoseHistoryDocuments = jest.fn(async () => [
      document('schedule-a__2026-11-22__20:00', '2026-11-22', '20:00'),
      document('schedule-a__2026-11-21__08:00', '2026-11-21', '08:00'),
    ]);
    const repository = new FirestoreDoseHistoryRepository(port({ listDoseHistoryDocuments }));

    await expect(repository.listDoseHistory(elderlyUid, query)).resolves.toEqual({
      events: [
        expect.objectContaining({ id: 'schedule-a__2026-11-22__20:00', ownerUid: elderlyUid }),
        expect.objectContaining({ id: 'schedule-a__2026-11-21__08:00', ownerUid: elderlyUid }),
      ],
      nextCursor: {
        scheduledLocalDate: '2026-11-21',
        scheduledLocalTime: '08:00',
        id: 'schedule-a__2026-11-21__08:00',
      },
    });
    expect(listDoseHistoryDocuments).toHaveBeenCalledWith(elderlyUid, query);
  });

  it('rejects a UI UID mismatch and a late Auth account switch before history is exposed', async () => {
    await expect(new FirestoreDoseHistoryRepository(port()).listDoseHistory(caregiverUid, query)).rejects.toThrow(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    );

    let authReads = 0;
    const repository = new FirestoreDoseHistoryRepository(port({
      getCurrentAuthUser: () => ({ uid: authReads++ === 0 ? elderlyUid : caregiverUid }),
      listDoseHistoryDocuments: async () => [document('schedule-a__2026-11-22__08:00', '2026-11-22', '08:00')],
    }));
    await expect(repository.listDoseHistory(elderlyUid, query)).rejects.toThrow(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    );
  });

  it('converts permission and offline failures into safe Vietnamese messages', async () => {
    const denied = new FirestoreDoseHistoryRepository(port({
      listDoseHistoryDocuments: async () => { throw { code: 'permission-denied' }; },
    }));
    const offline = new FirestoreDoseHistoryRepository(port({
      listDoseHistoryDocuments: async () => { throw { code: 'unavailable' }; },
    }));

    await expect(denied.listDoseHistory(elderlyUid, query)).rejects.toThrow('Bạn không có quyền xem lịch sử uống thuốc này.');
    await expect(offline.listDoseHistory(elderlyUid, query)).rejects.toThrow('Không thể kết nối Firebase. Vui lòng kiểm tra mạng rồi thử lại.');
  });
});
