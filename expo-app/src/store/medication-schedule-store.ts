import { create } from 'zustand';

import { getMedicationScheduleRepository } from '@/features/schedules/data/medication-schedule-repository-selector';
import type {
  MedicationScheduleCreateInput,
  MedicationScheduleRepository,
  MedicationScheduleUpdateInput,
} from '@/features/schedules/domain/medication-schedule-repository';
import type { MedicationSchedule } from '@/types/domain';

export type MedicationScheduleListStatus = 'idle' | 'loading' | 'ready' | 'error';
export type MedicationScheduleOperationStatus = 'idle' | 'loading' | 'error';

export class MedicationScheduleOperationInProgressError extends Error {
  constructor() {
    super('Đang lưu thay đổi trước đó. Vui lòng chờ hoàn tất.');
    this.name = 'MedicationScheduleOperationInProgressError';
  }
}

export interface MedicationScheduleState {
  /** Internal session key only; a route never supplies another owner's UID. */
  activeUserId: string | null;
  schedules: MedicationSchedule[];
  listStatus: MedicationScheduleListStatus;
  operationStatus: MedicationScheduleOperationStatus;
  errorMessage: string | null;
  loadForAuthenticatedUser(userId: string): Promise<void>;
  reload(): Promise<void>;
  getScheduleById(scheduleId: string): Promise<MedicationSchedule | null>;
  createSchedule(input: MedicationScheduleCreateInput): Promise<MedicationSchedule>;
  updateSchedule(scheduleId: string, input: MedicationScheduleUpdateInput): Promise<MedicationSchedule>;
  pauseSchedule(scheduleId: string): Promise<MedicationSchedule>;
  clearError(): void;
  reset(): void;
}

function toSafeErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function requireActiveUserId(state: MedicationScheduleState): string {
  if (!state.activeUserId) {
    throw new Error('Không thể xác định tài khoản hiện tại. Vui lòng đăng nhập lại.');
  }

  return state.activeUserId;
}

/**
 * Session-scoped schedule state. A late response is discarded after logout or
 * account switching, preventing one account's plans from appearing for another.
 */
export function createMedicationScheduleStore(
  repository: MedicationScheduleRepository = getMedicationScheduleRepository(),
) {
  let listRequestVersion = 0;

  return create<MedicationScheduleState>((set, get) => {
    const invalidateListRequest = () => {
      listRequestVersion += 1;
      return listRequestVersion;
    };

    const isCurrentUserRequest = (requestVersion: number, userId: string) =>
      requestVersion === listRequestVersion && get().activeUserId === userId;

    const updateCachedSchedule = (schedule: MedicationSchedule) => {
      set((state) => ({
        schedules: state.schedules.some((item) => item.id === schedule.id)
          ? state.schedules.map((item) => (item.id === schedule.id ? schedule : item))
          : [schedule, ...state.schedules],
      }));
    };

    const loadForAuthenticatedUser = async (userId: string): Promise<void> => {
      const normalizedUserId = userId.trim();

      if (!normalizedUserId) {
        invalidateListRequest();
        set({
          activeUserId: null,
          schedules: [],
          listStatus: 'error',
          operationStatus: 'idle',
          errorMessage: 'Không thể xác định tài khoản hiện tại. Vui lòng đăng nhập lại.',
        });
        return;
      }

      const requestVersion = invalidateListRequest();
      set({
        activeUserId: normalizedUserId,
        schedules: [],
        listStatus: 'loading',
        operationStatus: 'idle',
        errorMessage: null,
      });

      try {
        const schedules = await repository.listMedicationSchedules(normalizedUserId);

        if (isCurrentUserRequest(requestVersion, normalizedUserId)) {
          set({ schedules, listStatus: 'ready', errorMessage: null });
        }
      } catch (error) {
        if (isCurrentUserRequest(requestVersion, normalizedUserId)) {
          set({
            schedules: [],
            listStatus: 'error',
            errorMessage: toSafeErrorMessage(error, 'Không thể tải danh sách lịch uống thuốc.'),
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
        throw new MedicationScheduleOperationInProgressError();
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
      schedules: [],
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
      getScheduleById: async (scheduleId) => {
        const userId = requireActiveUserId(get());
        const schedule = await repository.getMedicationScheduleById(userId, scheduleId);

        if (get().activeUserId !== userId) {
          return null;
        }

        if (schedule) {
          updateCachedSchedule(schedule);
        }

        return schedule;
      },
      createSchedule: async (input) =>
        runMutation(
          'Không thể lưu lịch uống thuốc mới.',
          (userId) => repository.createMedicationSchedule(userId, input),
          updateCachedSchedule,
        ),
      updateSchedule: async (scheduleId, input) =>
        runMutation(
          'Không thể cập nhật lịch uống thuốc.',
          (userId) => repository.updateMedicationSchedule(userId, scheduleId, input),
          updateCachedSchedule,
        ),
      pauseSchedule: async (scheduleId) =>
        runMutation(
          'Không thể tạm dừng lịch uống thuốc.',
          (userId) => repository.pauseMedicationSchedule(userId, scheduleId),
          updateCachedSchedule,
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
          schedules: [],
          listStatus: 'idle',
          operationStatus: 'idle',
          errorMessage: null,
        });
      },
    };
  });
}

export const useMedicationScheduleStore = createMedicationScheduleStore();
