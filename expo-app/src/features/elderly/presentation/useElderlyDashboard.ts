import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isFirestoreMedicationsFeatureEnabled } from '@/services/firebase/firestore-medication-feature';
import { isFirestoreSchedulesFeatureEnabled } from '@/services/firebase/firestore-schedule-feature';
import {
  useDoseEventStore,
  useMedicationScheduleStore,
  useMedicationStore,
  useSessionStore,
} from '@/store';
import type { DoseEvent, Medication } from '@/types/domain';

import {
  getTodayMedicationSchedules,
  hasDashboardDataForCurrentUser,
  millisecondsUntilNextMedicationScheduleDay,
  resolveMedicationForDose,
  shouldShowFirestoreMedicationSchedules,
  type ElderlyDashboardMedicationSchedule,
} from './elderly-dashboard-utils';

export type ElderlyDashboardDose = {
  event: DoseEvent;
  medication: Medication | null;
};

export type ElderlyDashboardMode = 'demo' | 'firestore-schedules';

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
  const usesFirestoreSchedules = shouldShowFirestoreMedicationSchedules(
    medicationsFeatureEnabled,
    schedulesFeatureEnabled,
  );
  const dashboardMode: ElderlyDashboardMode = usesFirestoreSchedules ? 'firestore-schedules' : 'demo';
  const [dashboardNow, setDashboardNow] = useState(() => new Date());
  const appStateRef = useRef(AppState.currentState);

  const reloadDashboard = useCallback(() => {
    setDashboardNow(new Date());

    if (!userId) {
      return;
    }

    void loadMedications(userId);

    if (usesFirestoreSchedules) {
      void loadSchedules(userId);
      return;
    }

    void loadToday(userId);
  }, [loadMedications, loadSchedules, loadToday, userId, usesFirestoreSchedules]);

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
  const currentMedicationErrorMessage = hasCurrentMedicationState ? medicationErrorMessage : null;
  const currentScheduleErrorMessage = hasCurrentScheduleState ? scheduleErrorMessage : null;
  const currentDoseErrorMessage = hasCurrentDoseState ? doseErrorMessage : null;
  const firestoreScheduleDataReady = usesFirestoreSchedules
    && hasCurrentMedicationState
    && hasCurrentScheduleState
    && medicationListStatus === 'ready'
    && scheduleListStatus === 'ready';
  const firestoreScheduleLoading = Boolean(userId) && usesFirestoreSchedules && (
    !hasCurrentMedicationState
    || !hasCurrentScheduleState
    || medicationListStatus === 'loading'
    || scheduleListStatus === 'loading'
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

  return {
    user,
    dashboardMode,
    medicationsFeatureEnabled,
    schedulesFeatureEnabled,
    doses,
    medicationSchedules,
    isLoading: usesFirestoreSchedules ? firestoreScheduleLoading : demoLoading,
    errorMessage: usesFirestoreSchedules
      ? currentMedicationErrorMessage ?? currentScheduleErrorMessage
      : currentDoseErrorMessage ?? currentMedicationErrorMessage,
    retryDashboard: reloadDashboard,
    recordResponse: usesFirestoreSchedules ? undefined : recordResponse,
  };
}
