import { useEffect } from 'react';

import { isFirestoreMedicationsFeatureEnabled } from '@/services/firebase/firestore-medication-feature';
import { isFirestoreSchedulesFeatureEnabled } from '@/services/firebase/firestore-schedule-feature';
import { getLocalReminderService, isLocalRemindersFeatureEnabled } from '@/services/notifications';
import { useMedicationScheduleStore, useMedicationStore, useSessionStore } from '@/store';

/**
 * A passive, no-prompt synchronizer stays mounted while navigating away from
 * Home. It reacts to medication/schedule edits and uses only prior consent.
 */
export function LocalReminderSynchronizationGate() {
  const user = useSessionStore((state) => state.user);
  const activeMedicationUserId = useMedicationStore((state) => state.activeUserId);
  const medications = useMedicationStore((state) => state.medications);
  const medicationStatus = useMedicationStore((state) => state.listStatus);
  const activeScheduleUserId = useMedicationScheduleStore((state) => state.activeUserId);
  const schedules = useMedicationScheduleStore((state) => state.schedules);
  const scheduleStatus = useMedicationScheduleStore((state) => state.listStatus);
  const enabled = isLocalRemindersFeatureEnabled()
    && isFirestoreMedicationsFeatureEnabled()
    && isFirestoreSchedulesFeatureEnabled();
  const userId = user?.role === 'elderly' ? user.id : null;
  const dataReady = Boolean(
    userId
    && activeMedicationUserId === userId
    && activeScheduleUserId === userId
    && medicationStatus === 'ready'
    && scheduleStatus === 'ready',
  );

  useEffect(() => {
    if (!enabled || !userId || !dataReady) {
      return;
    }

    // Deliberately ignore a best-effort local notification failure here: it
    // must never block a medication/schedule mutation or authentication flow.
    void getLocalReminderService().syncIfConsented({ userId, medications, schedules }).catch(() => undefined);
  }, [dataReady, enabled, medications, schedules, userId]);

  return null;
}
