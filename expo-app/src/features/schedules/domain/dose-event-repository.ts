import type { DoseEvent, DoseResponseStatus } from '@/types/domain';

export interface DoseEventRepository {
  getTodayEvents(userId: string): Promise<DoseEvent[]>;
  recordResponse(userId: string, eventId: string, status: DoseResponseStatus): Promise<DoseEvent>;
}
