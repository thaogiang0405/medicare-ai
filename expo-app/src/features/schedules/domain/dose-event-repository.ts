import type { DoseEvent, DoseResponseStatus } from '@/types/domain';

export interface DoseEventRepository {
  getTodayEvents(userId: string): Promise<DoseEvent[]>;
  recordResponse(eventId: string, status: DoseResponseStatus): Promise<DoseEvent>;
}
