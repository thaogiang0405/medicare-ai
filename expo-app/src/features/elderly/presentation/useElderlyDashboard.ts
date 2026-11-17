import { useEffect, useMemo, useState } from 'react';

import { mockMedicationRepository } from '@/features/medications';
import { useDoseEventStore, useSessionStore } from '@/store';
import type { DoseEvent, Medication } from '@/types/domain';

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
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationLoading, setMedicationLoading] = useState(true);
  const [medicationErrorMessage, setMedicationErrorMessage] = useState<string | null>(null);

  const userId = user?.id ?? 'demo-elderly-minh';

  useEffect(() => {
    let isActive = true;

    void loadToday(userId);
    void mockMedicationRepository
      .getActiveMedications(userId)
      .then((result) => {
        if (isActive) {
          setMedications(result);
        }
      })
      .catch(() => {
        if (isActive) {
          setMedicationErrorMessage('Không thể tải danh sách thuốc demo.');
        }
      })
      .finally(() => {
        if (isActive) {
          setMedicationLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [loadToday, userId]);

  const doses = useMemo<ElderlyDashboardDose[]>(
    () =>
      events.map((event) => ({
        event,
        medication: medications.find((medication) => medication.id === event.medicationId) ?? null,
      })),
    [events, medications],
  );

  return {
    user,
    doses,
    isLoading: doseLoading || medicationLoading,
    errorMessage: doseErrorMessage ?? medicationErrorMessage,
    recordResponse,
  };
}
