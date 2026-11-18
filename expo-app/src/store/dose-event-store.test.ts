import type { DoseEventRepository } from '@/features/schedules';
import type { DoseEvent, DoseResponseStatus } from '@/types/domain';

import { createDoseEventStore } from './dose-event-store';

function createEvent(id: string, medicationId: string): DoseEvent {
  return {
    id,
    medicationId,
    scheduledAt: '2026-11-18T01:00:00.000Z',
    status: 'pending',
  };
}

function createRepository(overrides: Partial<DoseEventRepository> = {}): DoseEventRepository {
  return {
    getTodayEvents: jest.fn(async () => []),
    recordResponse: jest.fn(async (_userId: string, eventId: string, status: DoseResponseStatus) => ({
      ...createEvent(eventId, 'med-metformin-500'),
      status,
    })),
    ...overrides,
  };
}

describe('dose event store', () => {
  it('does not surface a failed response from a previous account after switching users', async () => {
    let rejectResponseForA: ((reason?: unknown) => void) | undefined;
    const pendingResponseForA = new Promise<DoseEvent>((_resolve, reject) => {
      rejectResponseForA = reject;
    });
    const repository = createRepository({
      getTodayEvents: jest.fn((userId: string) =>
        Promise.resolve(userId === 'elderly-a' ? [createEvent('dose-a', 'med-metformin-500')] : [createEvent('dose-b', 'med-amlodipine-5')]),
      ),
      recordResponse: jest.fn(() => pendingResponseForA),
    });
    const store = createDoseEventStore(repository);

    await store.getState().loadToday('elderly-a');
    const responseForA = store.getState().recordResponse('dose-a', 'reportedTaken');
    await store.getState().loadToday('elderly-b');
    rejectResponseForA?.(new Error('Không thể cập nhật phản hồi demo.'));
    await responseForA;

    expect(store.getState()).toMatchObject({
      activeUserId: 'elderly-b',
      events: [createEvent('dose-b', 'med-amlodipine-5')],
      errorMessage: null,
    });
  });
});
