import { isFirestoreDoseEventsFeatureEnabled } from '@/services/firebase/firestore-dose-event-feature';

import type { DoseTrackingRepository } from '../domain/dose-tracking-repository';
import { getFirestoreDoseEventRepository } from './firestore-dose-event-repository';

/** There is no mock fallback here: the dashboard keeps M3.3.1 behaviour unless this flag is explicitly enabled. */
export function getDoseTrackingRepository(): DoseTrackingRepository {
  if (!isFirestoreDoseEventsFeatureEnabled()) {
    throw new Error('Ghi nhận uống thuốc trên Firebase chưa được bật trên ứng dụng này.');
  }

  return getFirestoreDoseEventRepository();
}
