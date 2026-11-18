import { useEffect, useMemo } from 'react';

import { useDoseEventStore, useMedicationStore, useSessionStore } from '@/store';
import type { DoseEvent, Medication } from '@/types/domain';

import { resolveMedicationForDose } from './elderly-dashboard-utils';

export type ElderlyDashboardDose = {
  event: DoseEvent;
  medication: Medication | null;
};

/**
 * Presentation adapter for the elderly home. The route never reaches into a
 * repository directly, so Firebase can later replace these mock boundaries.
 */
export function useElderlyDashboard() {
  const user = useSessionStore((state) => state.user);
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

  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      return;
    }

    void loadToday(userId);
    void loadMedications(userId);
  }, [loadMedications, loadToday, userId]);

  const hasCurrentMedicationState = activeMedicationUserId === userId;
  const medicationLoading = Boolean(userId) && (!hasCurrentMedicationState || medicationListStatus === 'loading');
  const currentMedicationErrorMessage = hasCurrentMedicationState ? medicationErrorMessage : null;

  const doses = useMemo<ElderlyDashboardDose[]>(
    () => {
      const currentMedications = hasCurrentMedicationState ? medications : [];

      return events.map((event) => ({
        event,
        medication: resolveMedicationForDose(event, currentMedications),
      }));
    },
    [events, hasCurrentMedicationState, medications],
  );

  return {
    user,
    doses,
    isLoading: doseLoading || medicationLoading,
    errorMessage: doseErrorMessage ?? currentMedicationErrorMessage,
    recordResponse,
  };
}
