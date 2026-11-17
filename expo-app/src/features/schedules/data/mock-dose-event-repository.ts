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

/**
 * An in-memory data source for UI demonstration. A fresh app session resets
 * the dose responses; this is intentionally not a medication record.
 */
export class MockDoseEventRepository implements DoseEventRepository {
  private events: DoseEvent[] = createInitialEvents().map(cloneEvent);

  async getTodayEvents(_userId: string): Promise<DoseEvent[]> {
    return this.events.map(cloneEvent);
  }

  async recordResponse(eventId: string, status: DoseResponseStatus): Promise<DoseEvent> {
    const eventIndex = this.events.findIndex((event) => event.id === eventId);

    if (eventIndex < 0) {
      throw new Error('Không tìm thấy lịch uống thuốc demo.');
    }

    const updatedEvent: DoseEvent = {
      ...this.events[eventIndex],
      status,
      respondedAt: new Date().toISOString(),
      respondedBy: 'self-reported-demo',
    };

    this.events[eventIndex] = updatedEvent;
    return cloneEvent(updatedEvent);
  }
}

export const mockDoseEventRepository = new MockDoseEventRepository();
