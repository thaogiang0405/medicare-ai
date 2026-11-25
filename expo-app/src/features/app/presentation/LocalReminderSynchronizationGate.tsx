import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { isFirestoreMedicationsFeatureEnabled } from '@/services/firebase/firestore-medication-feature';
import { isFirestoreSchedulesFeatureEnabled } from '@/services/firebase/firestore-schedule-feature';
import { getLocalReminderService, isLocalRemindersFeatureEnabled } from '@/services/notifications';
import { useMedicationScheduleStore, useMedicationStore, useSessionStore } from '@/store';

const hcmUtcOffsetMilliseconds = 7 * 60 * 60 * 1000;

function millisecondsUntilNextHcmDay(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((value) => value.type === type)?.value);
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const nextMidnight = Date.UTC(year, month - 1, day + 1) - hcmUtcOffsetMilliseconds;

  return Math.max(1_000, nextMidnight - now.getTime());
}

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
  const [refreshVersion, setRefreshVersion] = useState(0);
  const appStateRef = useRef(AppState.currentState);
  const requestRefresh = useCallback(() => setRefreshVersion((version) => version + 1), []);

  // A foreground return can happen without a store mutation, particularly
  // after iOS has been suspended overnight. This remains no-prompt because
  // syncIfConsented exits before native scheduling for non-consenting users.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (nextAppState === 'active' && previousState !== 'active') {
        requestRefresh();
      }
    });

    return () => subscription.remove();
  }, [requestRefresh]);

  // Refill the rolling horizon after the HCM calendar moves forward even if
  // medication and schedule documents themselves were not edited.
  useEffect(() => {
    if (!enabled || !userId || !dataReady) {
      return undefined;
    }

    const timeout = setTimeout(requestRefresh, millisecondsUntilNextHcmDay());
    return () => clearTimeout(timeout);
  }, [dataReady, enabled, refreshVersion, requestRefresh, userId]);

  useEffect(() => {
    if (!enabled || !userId || !dataReady) {
      return;
    }

    // Deliberately ignore a best-effort local notification failure here: it
    // must never block a medication/schedule mutation or authentication flow.
    void getLocalReminderService().syncIfConsented({ userId, medications, schedules }).catch(() => undefined);
  }, [dataReady, enabled, medications, refreshVersion, schedules, userId]);

  return null;
}
