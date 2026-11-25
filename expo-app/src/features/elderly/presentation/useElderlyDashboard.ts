import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isFirestoreMedicationsFeatureEnabled } from '@/services/firebase/firestore-medication-feature';
import { isFirestoreSchedulesFeatureEnabled } from '@/services/firebase/firestore-schedule-feature';
import { isFirestoreDoseEventsFeatureEnabled } from '@/services/firebase/firestore-dose-event-feature';
import { createDoseEventResponseInput } from '@/features/schedules/domain/dose-tracking-repository';
import {
  getLocalReminderService,
  isLocalRemindersFeatureEnabled,
  type LocalReminderSyncResult,
} from '@/services/notifications';
import {
  useDoseEventStore,
  useDoseTrackingStore,
  useMedicationScheduleStore,
  useMedicationStore,
  useSessionStore,
} from '@/store';
import type { DoseEvent, Medication, PersistedDoseResponseStatus } from '@/types/domain';

import {
  getTodayMedicationSchedules,
  getTodayDoseTrackingSchedules,
  getMedicationScheduleCalendarDay,
  hasDashboardDataForCurrentUser,
  millisecondsUntilNextMedicationScheduleDay,
  resolveMedicationForDose,
  shouldShowFirestoreMedicationSchedules,
  type ElderlyDashboardDoseTrackingSchedule,
  type ElderlyDashboardMedicationSchedule,
} from './elderly-dashboard-utils';

export type ElderlyDashboardDose = {
  event: DoseEvent;
  medication: Medication | null;
};

export type ElderlyDashboardMode = 'demo' | 'firestore-schedules';

export type LocalReminderDashboardStatus = 'disabled' | 'idle' | 'syncing' | LocalReminderSyncResult['status'] | 'error';

/**
 * Presentation adapter for the elderly home. It deliberately chooses one
 * schedule source at a time: demo DoseEvents or planned Firestore schedules.
 * Repositories remain behind their Zustand stores, never in the route.
 */
export function useElderlyDashboard() {
  const user = useSessionStore((state) => state.user);
  const activeDoseUserId = useDoseEventStore((state) => state.activeUserId);
  const events = useDoseEventStore((state) => state.events);
  const doseLoading = useDoseEventStore((state) => state.isLoading);
  const doseErrorMessage = useDoseEventStore((state) => state.errorMessage);
  const loadToday = useDoseEventStore((state) => state.loadToday);
  const recordResponse = useDoseEventStore((state) => state.recordResponse);
  const activeDoseTrackingUserId = useDoseTrackingStore((state) => state.activeUserId);
  const doseTrackingLocalDate = useDoseTrackingStore((state) => state.localDate);
  const trackedDoseEvents = useDoseTrackingStore((state) => state.events);
  const doseTrackingListStatus = useDoseTrackingStore((state) => state.listStatus);
  const doseTrackingOperationStatus = useDoseTrackingStore((state) => state.operationStatus);
  const doseTrackingErrorMessage = useDoseTrackingStore((state) => state.errorMessage);
  const loadTrackedDoseEvents = useDoseTrackingStore((state) => state.loadForAuthenticatedUser);
  const recordTrackedDoseResponse = useDoseTrackingStore((state) => state.recordResponse);
  const activeMedicationUserId = useMedicationStore((state) => state.activeUserId);
  const medications = useMedicationStore((state) => state.medications);
  const medicationListStatus = useMedicationStore((state) => state.listStatus);
  const medicationErrorMessage = useMedicationStore((state) => state.errorMessage);
  const loadMedications = useMedicationStore((state) => state.loadForAuthenticatedUser);
  const activeScheduleUserId = useMedicationScheduleStore((state) => state.activeUserId);
  const schedules = useMedicationScheduleStore((state) => state.schedules);
  const scheduleListStatus = useMedicationScheduleStore((state) => state.listStatus);
  const scheduleErrorMessage = useMedicationScheduleStore((state) => state.errorMessage);
  const loadSchedules = useMedicationScheduleStore((state) => state.loadForAuthenticatedUser);

  const userId = user?.id;
  const medicationsFeatureEnabled = isFirestoreMedicationsFeatureEnabled();
  const schedulesFeatureEnabled = isFirestoreSchedulesFeatureEnabled();
  const doseEventsFeatureEnabled = isFirestoreDoseEventsFeatureEnabled();
  const localRemindersFeatureEnabled = isLocalRemindersFeatureEnabled();
  const usesFirestoreSchedules = shouldShowFirestoreMedicationSchedules(
    medicationsFeatureEnabled,
    schedulesFeatureEnabled,
  );
  const usesFirestoreDoseTracking = usesFirestoreSchedules && doseEventsFeatureEnabled;
  const dashboardMode: ElderlyDashboardMode = usesFirestoreSchedules ? 'firestore-schedules' : 'demo';
  const [dashboardNow, setDashboardNow] = useState(() => new Date());
  const [localReminderStatus, setLocalReminderStatus] = useState<LocalReminderDashboardStatus>(
    localRemindersFeatureEnabled ? 'idle' : 'disabled',
  );
  const appStateRef = useRef(AppState.currentState);

  const reloadDashboard = useCallback(() => {
    const now = new Date();
    setDashboardNow(now);

    if (!userId) {
      return;
    }

    void loadMedications(userId);

    if (usesFirestoreSchedules) {
      void loadSchedules(userId);

      if (usesFirestoreDoseTracking) {
        void loadTrackedDoseEvents(userId, getMedicationScheduleCalendarDay(now).isoDate);
      }
      return;
    }

    void loadToday(userId);
  }, [
    loadMedications,
    loadSchedules,
    loadToday,
    loadTrackedDoseEvents,
    userId,
    usesFirestoreDoseTracking,
    usesFirestoreSchedules,
  ]);

  // Runs on first render and every return to the home route.
  useFocusEffect(useCallback(() => {
    reloadDashboard();
  }, [reloadDashboard]));

  // A suspended app might miss its midnight timer, so foreground refreshes too.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (nextAppState === 'active' && previousAppState !== 'active') {
        reloadDashboard();
      }
    });

    return () => subscription.remove();
  }, [reloadDashboard]);

  // Recalculate the local day and refresh source data when Vietnam reaches midnight.
  useEffect(() => {
    const timeout = setTimeout(reloadDashboard, millisecondsUntilNextMedicationScheduleDay(dashboardNow));

    return () => clearTimeout(timeout);
  }, [dashboardNow, reloadDashboard]);

  const hasCurrentMedicationState = hasDashboardDataForCurrentUser(userId, activeMedicationUserId);
  const hasCurrentScheduleState = hasDashboardDataForCurrentUser(userId, activeScheduleUserId);
  const hasCurrentDoseState = hasDashboardDataForCurrentUser(userId, activeDoseUserId);
  const hasCurrentDoseTrackingState = hasDashboardDataForCurrentUser(userId, activeDoseTrackingUserId)
    && doseTrackingLocalDate === getMedicationScheduleCalendarDay(dashboardNow).isoDate;
  const currentMedicationErrorMessage = hasCurrentMedicationState ? medicationErrorMessage : null;
  const currentScheduleErrorMessage = hasCurrentScheduleState ? scheduleErrorMessage : null;
  const currentDoseErrorMessage = hasCurrentDoseState ? doseErrorMessage : null;
  const currentDoseTrackingErrorMessage = hasCurrentDoseTrackingState ? doseTrackingErrorMessage : null;
  const firestoreScheduleDataReady = usesFirestoreSchedules
    && hasCurrentMedicationState
    && hasCurrentScheduleState
    && medicationListStatus === 'ready'
    && scheduleListStatus === 'ready';
  const firestoreDoseTrackingDataReady = firestoreScheduleDataReady
    && usesFirestoreDoseTracking
    && hasCurrentDoseTrackingState
    && doseTrackingListStatus === 'ready';
  const firestoreScheduleLoading = Boolean(userId) && usesFirestoreSchedules && (
    !hasCurrentMedicationState
    || !hasCurrentScheduleState
    || medicationListStatus === 'loading'
    || scheduleListStatus === 'loading'
    || (usesFirestoreDoseTracking && (
      !hasCurrentDoseTrackingState || doseTrackingListStatus === 'loading'
    ))
  );
  const demoLoading = Boolean(userId) && !usesFirestoreSchedules && (
    !hasCurrentMedicationState
    || !hasCurrentDoseState
    || medicationListStatus === 'loading'
    || doseLoading
  );

  const doses = useMemo<ElderlyDashboardDose[]>(() => {
    if (usesFirestoreSchedules || !hasCurrentDoseState) {
      return [];
    }

    const currentMedications = hasCurrentMedicationState ? medications : [];

    return events.map((event) => ({
      event,
      medication: resolveMedicationForDose(event, currentMedications),
    }));
  }, [events, hasCurrentDoseState, hasCurrentMedicationState, medications, usesFirestoreSchedules]);

  const medicationSchedules = useMemo<ElderlyDashboardMedicationSchedule[]>(() => {
    if (!firestoreScheduleDataReady) {
      return [];
    }

    return getTodayMedicationSchedules(schedules, medications, dashboardNow);
  }, [dashboardNow, firestoreScheduleDataReady, medications, schedules]);

  // This passive resync never opens the OS permission prompt. It only runs for
  // an account that has already chosen to enable local reminders.
  useEffect(() => {
    if (!localRemindersFeatureEnabled || !userId || !firestoreScheduleDataReady) {
      return;
    }

    let isCurrent = true;
    void getLocalReminderService().syncIfConsented({
      userId,
      schedules,
      medications,
      now: dashboardNow,
    }).then((result) => {
      if (isCurrent) {
        setLocalReminderStatus(result.status);
      }
    }).catch(() => {
      if (isCurrent) {
        setLocalReminderStatus('error');
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [
    dashboardNow,
    firestoreScheduleDataReady,
    localRemindersFeatureEnabled,
    medications,
    schedules,
    userId,
  ]);

  const visibleLocalReminderStatus: LocalReminderDashboardStatus = !localRemindersFeatureEnabled
    ? 'disabled'
    : !userId || !firestoreScheduleDataReady
      ? 'idle'
      : localReminderStatus;

  const enableLocalReminders = useCallback(async () => {
    if (!localRemindersFeatureEnabled || !userId || !firestoreScheduleDataReady) {
      return;
    }

    setLocalReminderStatus('syncing');

    try {
      const result = await getLocalReminderService().requestPermissionAndSync({
        userId,
        schedules,
        medications,
        now: new Date(),
      });
      setLocalReminderStatus(result.status);
    } catch {
      setLocalReminderStatus('error');
    }
  }, [firestoreScheduleDataReady, localRemindersFeatureEnabled, medications, schedules, userId]);

  const doseTrackingSchedules = useMemo<ElderlyDashboardDoseTrackingSchedule[]>(() => {
    if (!firestoreDoseTrackingDataReady) {
      return [];
    }

    return getTodayDoseTrackingSchedules(schedules, medications, trackedDoseEvents, dashboardNow);
  }, [dashboardNow, firestoreDoseTrackingDataReady, medications, schedules, trackedDoseEvents]);

  const recordDoseResponse = useCallback(async (
    item: ElderlyDashboardDoseTrackingSchedule,
    status: PersistedDoseResponseStatus,
  ) => {
    await recordTrackedDoseResponse(createDoseEventResponseInput(
      item.schedule,
      item.medication,
      item.scheduledLocalDate,
      status,
    ));
  }, [recordTrackedDoseResponse]);

  return {
    user,
    dashboardMode,
    medicationsFeatureEnabled,
    schedulesFeatureEnabled,
    doseEventsFeatureEnabled,
    localRemindersFeatureEnabled,
    localReminderStatus: visibleLocalReminderStatus,
    usesFirestoreDoseTracking,
    doses,
    medicationSchedules,
    doseTrackingSchedules,
    isLoading: usesFirestoreSchedules ? firestoreScheduleLoading : demoLoading,
    errorMessage: usesFirestoreSchedules
      ? currentMedicationErrorMessage ?? currentScheduleErrorMessage ?? currentDoseTrackingErrorMessage
      : currentDoseErrorMessage ?? currentMedicationErrorMessage,
    retryDashboard: reloadDashboard,
    recordResponse: usesFirestoreSchedules ? undefined : recordResponse,
    recordDoseResponse: usesFirestoreDoseTracking ? recordDoseResponse : undefined,
    isRecordingDoseResponse: doseTrackingOperationStatus === 'loading',
    enableLocalReminders,
  };
}
