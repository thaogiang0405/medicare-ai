import type { DoseEvent, DoseResponseStatus } from '@/types/domain';

import type { DoseEventRepository } from '../domain/dose-event-repository';

function todayAt(hour: number): string {
  const timestamp = new Date();
  timestamp.setHours(hour, 0, 0, 0);
  return timestamp.toISOString();
}

function createInitialEvents(): DoseEvent[] {
  return [
    {
      id: 'dose-metformin-morning',
      medicationId: 'med-metformin-500',
      scheduledAt: todayAt(8),
      status: 'pending',
    },
    {
      id: 'dose-amlodipine-evening',
      medicationId: 'med-amlodipine-5',
      scheduledAt: todayAt(20),
      status: 'unanswered',
    },
  ];
}

function cloneEvent(event: DoseEvent): DoseEvent {
  return { ...event };
}

function assertUserId(userId: string): string {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new Error('Không thể xác định tài khoản hiện tại. Vui lòng đăng nhập lại.');
  }

  return normalizedUserId;
}

/**
 * An in-memory data source for UI demonstration. Events are partitioned by
 * signed-in UID so one test account never receives another account's response.
 * This remains demo data, not a medication record or production authorization.
 */
export class MockDoseEventRepository implements DoseEventRepository {
  private readonly eventsByUserId = new Map<string, DoseEvent[]>();

  private getUserEvents(userId: string): DoseEvent[] {
    const safeUserId = assertUserId(userId);
    const existing = this.eventsByUserId.get(safeUserId);

    if (existing) {
      return existing;
    }

    const initialEvents = createInitialEvents().map(cloneEvent);
    this.eventsByUserId.set(safeUserId, initialEvents);
    return initialEvents;
  }

  async getTodayEvents(userId: string): Promise<DoseEvent[]> {
    return this.getUserEvents(userId).map(cloneEvent);
  }

  async recordResponse(userId: string, eventId: string, status: DoseResponseStatus): Promise<DoseEvent> {
    const safeUserId = assertUserId(userId);
    const events = this.getUserEvents(safeUserId);
    const eventIndex = events.findIndex((event) => event.id === eventId);

    if (eventIndex < 0) {
      throw new Error('Không tìm thấy lịch uống thuốc demo.');
    }

    const updatedEvent: DoseEvent = {
      ...events[eventIndex],
      status,
      respondedAt: new Date().toISOString(),
      respondedBy: safeUserId,
    };

    events[eventIndex] = updatedEvent;
    return cloneEvent(updatedEvent);
  }
}

export const mockDoseEventRepository = new MockDoseEventRepository();
