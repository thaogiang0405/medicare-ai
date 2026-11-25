import type { DoseHistoryRepository } from '@/features/schedules/domain/dose-history-repository';
import type { DoseEvent } from '@/types/domain';

import { createDoseHistoryStore } from './dose-history-store';

function event(id: string, ownerUid: string, date: string, time: string): DoseEvent {
  return {
    id,
    ownerUid,
    scheduleId: 'schedule-a',
    medicationId: 'medication-a',
    occurrenceKey: `${date}T${time}@Asia/Ho_Chi_Minh`,
    scheduledAt: `${date}T${time}:00.000Z`,
    scheduledLocalDate: date,
    scheduledLocalTime: time,
    timeZone: 'Asia/Ho_Chi_Minh',
    medicationSnapshot: { name: 'Paracetamol', strengthText: '500 mg', directionsText: 'Theo hướng dẫn' },
    status: 'reportedTaken',
    responseSource: 'selfReported',
    respondedAt: `${date}T${time}:30.000Z`,
    respondedBy: ownerUid,
    responseHistory: {
      initial: {
        status: 'reportedTaken',
        responseSource: 'selfReported',
        respondedAt: `${date}T${time}:30.000Z`,
        respondedBy: ownerUid,
      },
    },
    revision: 1,
  };
}

describe('dose history store', () => {
  it('uses a bounded calendar window and merges a later page without duplicate events', async () => {
    const first = event('event-2', 'elderly-a', '2026-11-22', '20:00');
    const second = event('event-1', 'elderly-a', '2026-11-21', '08:00');
    const repository: DoseHistoryRepository = {
      listDoseHistory: jest.fn(async (_userId, input) => input.cursor
        ? { events: [second], nextCursor: null }
        : {
          events: [first],
          nextCursor: { scheduledLocalDate: first.scheduledLocalDate!, scheduledLocalTime: first.scheduledLocalTime!, id: first.id },
        }),
    };
    const store = createDoseHistoryStore(repository);

    await store.getState().loadForAuthenticatedUser('elderly-a', 'sevenDays', new Date('2026-11-21T17:10:00.000Z'));
    await store.getState().loadMore();

    expect(repository.listDoseHistory).toHaveBeenNthCalledWith(1, 'elderly-a', expect.objectContaining({
      startLocalDate: '2026-11-16', endLocalDate: '2026-11-22', pageSize: 20,
    }));
    expect(repository.listDoseHistory).toHaveBeenNthCalledWith(2, 'elderly-a', expect.objectContaining({
      startLocalDate: '2026-11-16', endLocalDate: '2026-11-22',
      cursor: { scheduledLocalDate: '2026-11-22', scheduledLocalTime: '20:00', id: 'event-2' },
    }));
    expect(store.getState()).toMatchObject({
      activeUserId: 'elderly-a',
      listStatus: 'ready',
      nextCursor: null,
      events: [expect.objectContaining({ id: 'event-2' }), expect.objectContaining({ id: 'event-1' })],
    });
  });

  it('drops a stale history response after logout or an account switch', async () => {
    let resolveA: ((events: { events: readonly DoseEvent[]; nextCursor: null }) => void) | undefined;
    const delayedA = new Promise<{ events: readonly DoseEvent[]; nextCursor: null }>((resolve) => {
      resolveA = resolve;
    });
    const repository: DoseHistoryRepository = {
      listDoseHistory: jest.fn((userId) => userId === 'elderly-a'
        ? delayedA
        : Promise.resolve({ events: [event('event-b', userId, '2026-11-22', '08:00')], nextCursor: null })),
    };
    const store = createDoseHistoryStore(repository);

    const loadA = store.getState().loadForAuthenticatedUser('elderly-a', 'day', new Date('2026-11-21T17:10:00.000Z'));
    await store.getState().loadForAuthenticatedUser('elderly-b', 'day', new Date('2026-11-21T17:10:00.000Z'));
    resolveA?.({ events: [event('event-a', 'elderly-a', '2026-11-22', '08:00')], nextCursor: null });
    await loadA;

    expect(store.getState()).toMatchObject({
      activeUserId: 'elderly-b',
      events: [expect.objectContaining({ id: 'event-b', ownerUid: 'elderly-b' })],
      listStatus: 'ready',
    });
    store.getState().reset();
    expect(store.getState()).toMatchObject({ activeUserId: null, events: [], listStatus: 'idle' });
  });

  it('keeps already loaded records when a later page fails and exposes a retryable error', async () => {
    const first = event('event-1', 'elderly-a', '2026-11-22', '08:00');
    const repository: DoseHistoryRepository = {
      listDoseHistory: jest.fn(async (_userId, input) => input.cursor
        ? Promise.reject(new Error('Mạng yếu'))
        : {
          events: [first],
          nextCursor: { scheduledLocalDate: first.scheduledLocalDate!, scheduledLocalTime: first.scheduledLocalTime!, id: first.id },
        }),
    };
    const store = createDoseHistoryStore(repository);

    await store.getState().loadForAuthenticatedUser('elderly-a', 'day', new Date('2026-11-21T17:10:00.000Z'));
    await store.getState().loadMore();

    expect(store.getState()).toMatchObject({
      events: [expect.objectContaining({ id: 'event-1' })],
      listStatus: 'ready',
      isLoadingMore: false,
      errorMessage: 'Mạng yếu',
    });
  });
});
