import { isFirestoreDoseEventsFeatureEnabled } from '@/services/firebase/firestore-dose-event-feature';

import type { DoseHistoryRepository } from '../domain/dose-history-repository';
import { getFirestoreDoseHistoryRepository } from './firestore-dose-history-repository';

/** Dose history is intentionally unavailable until the reviewed DoseEvent surface is enabled. */
export function getDoseHistoryRepository(): DoseHistoryRepository {
  if (!isFirestoreDoseEventsFeatureEnabled()) {
    throw new Error('Lịch sử uống thuốc trên Firebase chưa được bật trên ứng dụng này.');
  }

  return getFirestoreDoseHistoryRepository();
}
