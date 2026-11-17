import { useEffect, useMemo, useState } from 'react';

import { mockMedicationRepository } from '@/features/medications';
import { useDoseEventStore, useSessionStore } from '@/store';
import type { DoseEvent, Medication } from '@/types/domain';

export type ElderlyDashboardDose = {
  event: DoseEvent;
  medication: Medication | null;
};

type MedicationLoadState = {
  errorMessage: string | null;
  isLoading: boolean;
  medications: Medication[];
  userId: string | null;
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
  const [medicationState, setMedicationState] = useState<MedicationLoadState>({
    errorMessage: null,
    isLoading: false,
    medications: [],
    userId: null,
  });

  const userId = user?.id;

  useEffect(() => {
    let isActive = true;

    if (!userId) {
      return () => {
        isActive = false;
      };
    }

    void loadToday(userId);
    void mockMedicationRepository
      .getActiveMedications(userId)
      .then((result) => {
        if (isActive) {
          setMedicationState({
            errorMessage: null,
            isLoading: false,
            medications: result,
            userId,
          });
        }
      })
      .catch(() => {
        if (isActive) {
          setMedicationState({
            errorMessage: 'Không thể tải danh sách thuốc demo.',
            isLoading: false,
            medications: [],
            userId,
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [loadToday, userId]);

  const hasCurrentMedicationState = medicationState.userId === userId;
  const medicationLoading = Boolean(userId) && (!hasCurrentMedicationState || medicationState.isLoading);
  const medicationErrorMessage = hasCurrentMedicationState ? medicationState.errorMessage : null;

  const doses = useMemo<ElderlyDashboardDose[]>(
    () => {
      const medications = hasCurrentMedicationState ? medicationState.medications : [];

      return events.map((event) => ({
        event,
        medication: medications.find((medication) => medication.id === event.medicationId) ?? null,
      }));
    },
    [events, hasCurrentMedicationState, medicationState.medications],
  );

  return {
    user,
    doses,
    isLoading: doseLoading || medicationLoading,
    errorMessage: doseErrorMessage ?? medicationErrorMessage,
    recordResponse,
  };
}
