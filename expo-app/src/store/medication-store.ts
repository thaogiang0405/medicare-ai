import { create } from 'zustand';

import { getMedicationRepository } from '@/features/medications/data/medication-repository-selector';
import type { MedicationInput, MedicationRepository } from '@/features/medications/domain/medication-repository';
import type { Medication } from '@/types/domain';

export type MedicationListStatus = 'idle' | 'loading' | 'ready' | 'error';
export type MedicationOperationStatus = 'idle' | 'loading' | 'error';

export class MedicationOperationInProgressError extends Error {
  constructor() {
    super('Đang lưu thay đổi trước đó. Vui lòng chờ hoàn tất.');
    this.name = 'MedicationOperationInProgressError';
  }
}

export interface MedicationState {
  /** Internal session key only; UI never chooses another user's UID. */
  activeUserId: string | null;
  medications: Medication[];
  listStatus: MedicationListStatus;
  operationStatus: MedicationOperationStatus;
  errorMessage: string | null;
  loadForAuthenticatedUser(userId: string): Promise<void>;
  reload(): Promise<void>;
  getMedicationById(medicationId: string): Promise<Medication | null>;
  createMedication(input: MedicationInput): Promise<Medication>;
  updateMedication(medicationId: string, input: MedicationInput): Promise<Medication>;
  markMedicationInactive(medicationId: string): Promise<Medication>;
  clearError(): void;
  reset(): void;
}

function toSafeErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function requireActiveUserId(state: MedicationState): string {
  if (!state.activeUserId) {
    throw new Error('Không thể xác định tài khoản hiện tại. Vui lòng đăng nhập lại.');
  }

  return state.activeUserId;
}

/**
 * Presentation state selects the M3.1 mock repository unless the explicit
 * Firestore medication flag is enabled. Repository calls remain scoped to the
 * authenticated user and delayed results are discarded after logout/switching.
 */
export function createMedicationStore(repository: MedicationRepository = getMedicationRepository()) {
  let listRequestVersion = 0;

  return create<MedicationState>((set, get) => {
    const invalidateListRequest = () => {
      listRequestVersion += 1;
      return listRequestVersion;
    };

    const isCurrentUserRequest = (requestVersion: number, userId: string) =>
      requestVersion === listRequestVersion && get().activeUserId === userId;

    const updateCachedMedication = (medication: Medication) => {
      set((state) => ({
        medications: state.medications.some((item) => item.id === medication.id)
          ? state.medications.map((item) => (item.id === medication.id ? medication : item))
          : [medication, ...state.medications],
      }));
    };

    const loadForAuthenticatedUser = async (userId: string): Promise<void> => {
      const normalizedUserId = userId.trim();

      if (!normalizedUserId) {
        invalidateListRequest();
        set({
          activeUserId: null,
          medications: [],
          listStatus: 'error',
          operationStatus: 'idle',
          errorMessage: 'Không thể xác định tài khoản hiện tại. Vui lòng đăng nhập lại.',
        });
        return;
      }

      const requestVersion = invalidateListRequest();
      set({
        activeUserId: normalizedUserId,
        medications: [],
        listStatus: 'loading',
        operationStatus: 'idle',
        errorMessage: null,
      });

      try {
        const medications = await repository.listMedications(normalizedUserId);

        if (isCurrentUserRequest(requestVersion, normalizedUserId)) {
          set({ medications, listStatus: 'ready', errorMessage: null });
        }
      } catch (error) {
        if (isCurrentUserRequest(requestVersion, normalizedUserId)) {
          set({
            medications: [],
            listStatus: 'error',
            errorMessage: toSafeErrorMessage(error, 'Không thể tải danh sách thuốc demo.'),
          });
        }
      }
    };

    const runMutation = async <T>(
      fallbackMessage: string,
      mutation: (userId: string) => Promise<T>,
      updateCache: (result: T) => void,
    ): Promise<T> => {
      const state = get();

      if (state.operationStatus === 'loading') {
        throw new MedicationOperationInProgressError();
      }

      const userId = requireActiveUserId(state);
      set({ operationStatus: 'loading', errorMessage: null });

      try {
        const result = await mutation(userId);

        if (get().activeUserId === userId) {
          updateCache(result);
          set({ operationStatus: 'idle', errorMessage: null });
        }

        return result;
      } catch (error) {
        if (get().activeUserId === userId) {
          set({
            operationStatus: 'error',
            errorMessage: toSafeErrorMessage(error, fallbackMessage),
          });
        }
        throw error;
      }
    };

    return {
      activeUserId: null,
      medications: [],
      listStatus: 'idle',
      operationStatus: 'idle',
      errorMessage: null,
      loadForAuthenticatedUser,
      reload: async () => {
        const activeUserId = get().activeUserId;

        if (activeUserId) {
          await loadForAuthenticatedUser(activeUserId);
        }
      },
      getMedicationById: async (medicationId) => {
        const userId = requireActiveUserId(get());
        const medication = await repository.getMedicationById(userId, medicationId);

        if (get().activeUserId !== userId) {
          return null;
        }

        if (medication) {
          updateCachedMedication(medication);
        }

        return medication;
      },
      createMedication: async (input) =>
        runMutation(
          'Không thể lưu thuốc mới.',
          (userId) => repository.createMedication(userId, input),
          updateCachedMedication,
        ),
      updateMedication: async (medicationId, input) =>
        runMutation(
          'Không thể cập nhật thông tin thuốc.',
          (userId) => repository.updateMedication(userId, medicationId, input),
          updateCachedMedication,
        ),
      markMedicationInactive: async (medicationId) =>
        runMutation(
          'Không thể cập nhật trạng thái thuốc.',
          (userId) => repository.markMedicationInactive(userId, medicationId),
          updateCachedMedication,
        ),
      clearError: () =>
        set((state) => ({
          errorMessage: null,
          operationStatus: state.operationStatus === 'error' ? 'idle' : state.operationStatus,
        })),
      reset: () => {
        invalidateListRequest();
        set({
          activeUserId: null,
          medications: [],
          listStatus: 'idle',
          operationStatus: 'idle',
          errorMessage: null,
        });
      },
    };
  });
}

export const useMedicationStore = createMedicationStore();
