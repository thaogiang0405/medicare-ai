import { useEffect } from 'react';

import { useMedicationScheduleStore, useSessionStore } from '@/store';

/** Connects schedule UI only to the authenticated session, never a route UID. */
export function useMedicationSchedules({ load = true }: Readonly<{ load?: boolean }> = {}) {
  const user = useSessionStore((state) => state.user);
  const activeUserId = useMedicationScheduleStore((state) => state.activeUserId);
  const schedules = useMedicationScheduleStore((state) => state.schedules);
  const listStatus = useMedicationScheduleStore((state) => state.listStatus);
  const operationStatus = useMedicationScheduleStore((state) => state.operationStatus);
  const errorMessage = useMedicationScheduleStore((state) => state.errorMessage);
  const loadForAuthenticatedUser = useMedicationScheduleStore((state) => state.loadForAuthenticatedUser);
  const reload = useMedicationScheduleStore((state) => state.reload);
  const createSchedule = useMedicationScheduleStore((state) => state.createSchedule);
  const updateSchedule = useMedicationScheduleStore((state) => state.updateSchedule);
  const pauseSchedule = useMedicationScheduleStore((state) => state.pauseSchedule);
  const clearError = useMedicationScheduleStore((state) => state.clearError);

  useEffect(() => {
    if (load && user?.id) {
      void loadForAuthenticatedUser(user.id);
    }
  }, [load, loadForAuthenticatedUser, user?.id]);

  return {
    user,
    activeUserId,
    schedules,
    listStatus,
    operationStatus,
    errorMessage,
    reload,
    createSchedule,
    updateSchedule,
    pauseSchedule,
    clearError,
  };
}
