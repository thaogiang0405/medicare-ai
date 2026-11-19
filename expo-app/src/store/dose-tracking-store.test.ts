import type {
  DoseEventResponseInput,
  DoseTrackingRepository,
} from '@/features/schedules/domain/dose-tracking-repository';
import type { DoseEvent } from '@/types/domain';

import { createDoseTrackingStore } from './dose-tracking-store';

const input: DoseEventResponseInput = {
  scheduleId: 'schedule-a',
  medicationId: 'medication-a',
  scheduledLocalDate: '2020-01-01',
  scheduledLocalTime: '08:00',
  scheduledAt: '2020-01-01T01:00:00.000Z',
  occurrenceKey: '2020-01-01T08:00@Asia/Ho_Chi_Minh',
  medicationSnapshot: { name: 'Paracetamol', strengthText: '500 mg', directionsText: 'Theo hướng dẫn' },
  status: 'reportedTaken',
};

function event(id: string, ownerUid: string, status: DoseEvent['status'] = 'reportedTaken'): DoseEvent {
  return {
    id,
    ownerUid,
    scheduleId: 'schedule-a',
    medicationId: 'medication-a',
    occurrenceKey: input.occurrenceKey,
    scheduledAt: input.scheduledAt,
    scheduledLocalDate: input.scheduledLocalDate,
    scheduledLocalTime: input.scheduledLocalTime,
    timeZone: 'Asia/Ho_Chi_Minh',
    medicationSnapshot: input.medicationSnapshot,
    status,
    responseSource: 'selfReported',
    respondedAt: '2020-01-01T02:00:00.000Z',
    respondedBy: ownerUid,
    responseHistory: {
      initial: {
        status: status as 'reportedTaken' | 'reportedSkipped',
        responseSource: 'selfReported',
        respondedAt: '2020-01-01T02:00:00.000Z',
        respondedBy: ownerUid,
      },
    },
    revision: 1,
  };
}

function repository(overrides: Partial<DoseTrackingRepository> = {}): DoseTrackingRepository {
  return {
    listDoseEventsForLocalDate: jest.fn(async () => []),
    recordDoseResponse: jest.fn(async (userId: string) => event('schedule-a__2020-01-01__08:00', userId)),
    ...overrides,
  };
}

describe('dose tracking store', () => {
  it('loads and records a self-report for only the active authenticated UID', async () => {
    const recordDoseResponse = jest.fn(async (userId: string) => event('schedule-a__2020-01-01__08:00', userId));
    const store = createDoseTrackingStore(repository({
      listDoseEventsForLocalDate: async (userId) => userId === 'elderly-a' ? [] : [event('other', userId)],
      recordDoseResponse,
    }));

    await store.getState().loadForAuthenticatedUser('elderly-a', '2020-01-01');
    await store.getState().recordResponse(input);

    expect(recordDoseResponse).toHaveBeenCalledWith('elderly-a', input);
    expect(store.getState()).toMatchObject({
      activeUserId: 'elderly-a',
      listStatus: 'ready',
      events: [expect.objectContaining({ ownerUid: 'elderly-a', status: 'reportedTaken' })],
    });
  });

  it('drops a late list failure and a late mutation after account switching', async () => {
    let rejectListForA: ((reason?: unknown) => void) | undefined;
    let resolveResponseForA: ((value: DoseEvent) => void) | undefined;
    const pendingListForA = new Promise<DoseEvent[]>((_resolve, reject) => {
      rejectListForA = reject;
    });
    const pendingResponseForA = new Promise<DoseEvent>((resolve) => {
      resolveResponseForA = resolve;
    });
    const store = createDoseTrackingStore(repository({
      listDoseEventsForLocalDate: jest.fn((userId: string) =>
        userId === 'elderly-a' ? pendingListForA : Promise.resolve([event('event-b', userId)]),
      ),
      recordDoseResponse: jest.fn(() => pendingResponseForA),
    }));

    const loadingA = store.getState().loadForAuthenticatedUser('elderly-a', '2020-01-01');
    await store.getState().loadForAuthenticatedUser('elderly-b', '2020-01-01');
    rejectListForA?.(new Error('Lỗi cũ'));
    await loadingA;

    const responseForB = store.getState().recordResponse(input);
    store.getState().reset();
    resolveResponseForA?.(event('event-a', 'elderly-a'));
    await responseForB;

    expect(store.getState()).toMatchObject({
      activeUserId: null,
      events: [],
      errorMessage: null,
    });
  });
});
