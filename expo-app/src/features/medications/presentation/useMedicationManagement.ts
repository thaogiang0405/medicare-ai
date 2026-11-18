import { useEffect } from 'react';

import { useMedicationStore, useSessionStore } from '@/store';

/**
 * Connects medication presentation state only to the authenticated session.
 * Screens receive no user-id route parameter and cannot choose another owner.
 */
export function useMedicationManagement({ load = true }: Readonly<{ load?: boolean }> = {}) {
  const user = useSessionStore((state) => state.user);
  const activeUserId = useMedicationStore((state) => state.activeUserId);
  const medications = useMedicationStore((state) => state.medications);
  const listStatus = useMedicationStore((state) => state.listStatus);
  const operationStatus = useMedicationStore((state) => state.operationStatus);
  const errorMessage = useMedicationStore((state) => state.errorMessage);
  const loadForAuthenticatedUser = useMedicationStore((state) => state.loadForAuthenticatedUser);
  const reload = useMedicationStore((state) => state.reload);
  const createMedication = useMedicationStore((state) => state.createMedication);
  const updateMedication = useMedicationStore((state) => state.updateMedication);
  const markMedicationInactive = useMedicationStore((state) => state.markMedicationInactive);
  const clearError = useMedicationStore((state) => state.clearError);

  useEffect(() => {
    if (load && user?.id) {
      void loadForAuthenticatedUser(user.id);
    }
  }, [load, loadForAuthenticatedUser, user?.id]);

  return {
    user,
    activeUserId,
    medications,
    listStatus,
    operationStatus,
    errorMessage,
    reload,
    createMedication,
    updateMedication,
    markMedicationInactive,
    clearError,
  };
}
