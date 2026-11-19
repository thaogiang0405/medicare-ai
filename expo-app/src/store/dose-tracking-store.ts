import { create } from 'zustand';

import { getDoseTrackingRepository } from '@/features/schedules/data/dose-tracking-repository-selector';
import type {
  DoseEventResponseInput,
  DoseTrackingRepository,
} from '@/features/schedules/domain/dose-tracking-repository';
import type { DoseEvent } from '@/types/domain';

export type DoseTrackingListStatus = 'idle' | 'loading' | 'ready' | 'error';
export type DoseTrackingOperationStatus = 'idle' | 'loading' | 'error';

export class DoseTrackingOperationInProgressError extends Error {
  constructor() {
    super('Đang lưu phản hồi trước đó. Vui lòng chờ hoàn tất.');
    this.name = 'DoseTrackingOperationInProgressError';
  }
}

export interface DoseTrackingState {
  activeUserId: string | null;
  localDate: string | null;
  events: DoseEvent[];
  listStatus: DoseTrackingListStatus;
  operationStatus: DoseTrackingOperationStatus;
  errorMessage: string | null;
  loadForAuthenticatedUser(userId: string, localDate: string): Promise<void>;
  reload(): Promise<void>;
  recordResponse(input: DoseEventResponseInput): Promise<DoseEvent>;
  clearError(): void;
  reset(): void;
}

/** Do not evaluate the opt-in selector while the default mock dashboard is loading. */
const lazyDoseTrackingRepository: DoseTrackingRepository = {
  listDoseEventsForLocalDate: (userId, localDate) =>
    getDoseTrackingRepository().listDoseEventsForLocalDate(userId, localDate),
  recordDoseResponse: (userId, input) =>
    getDoseTrackingRepository().recordDoseResponse(userId, input),
};

function toSafeErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Session-scoped M3.4 state. Request versions and the active UID prevent a
 * stale network result from appearing after logout or an account switch.
 */
export function createDoseTrackingStore(repository: DoseTrackingRepository = lazyDoseTrackingRepository) {
  let listRequestVersion = 0;

  return create<DoseTrackingState>((set, get) => {
    const invalidateListRequest = () => {
      listRequestVersion += 1;
      return listRequestVersion;
    };

    const isCurrentRequest = (requestVersion: number, userId: string, localDate: string) =>
      requestVersion === listRequestVersion
      && get().activeUserId === userId
      && get().localDate === localDate;

    const loadForAuthenticatedUser = async (userId: string, localDate: string): Promise<void> => {
      const normalizedUserId = userId.trim();
      const normalizedLocalDate = localDate.trim();

      if (!normalizedUserId || !normalizedLocalDate) {
        invalidateListRequest();
        set({
          activeUserId: null,
          localDate: null,
          events: [],
          listStatus: 'error',
          operationStatus: 'idle',
          errorMessage: 'Không thể xác định tài khoản hoặc ngày lịch thuốc hiện tại.',
        });
        return;
      }

      const requestVersion = invalidateListRequest();
      set({
        activeUserId: normalizedUserId,
        localDate: normalizedLocalDate,
        events: [],
        listStatus: 'loading',
        operationStatus: 'idle',
        errorMessage: null,
      });

      try {
        const events = await repository.listDoseEventsForLocalDate(normalizedUserId, normalizedLocalDate);

        if (isCurrentRequest(requestVersion, normalizedUserId, normalizedLocalDate)) {
          set({ events, listStatus: 'ready', errorMessage: null });
        }
      } catch (error) {
        if (isCurrentRequest(requestVersion, normalizedUserId, normalizedLocalDate)) {
          set({
            events: [],
            listStatus: 'error',
            errorMessage: toSafeErrorMessage(error, 'Không thể tải phản hồi uống thuốc.'),
          });
        }
      }
    };

    return {
      activeUserId: null,
      localDate: null,
      events: [],
      listStatus: 'idle',
      operationStatus: 'idle',
      errorMessage: null,
      loadForAuthenticatedUser,
      reload: async () => {
        const { activeUserId, localDate } = get();
        if (activeUserId && localDate) {
          await loadForAuthenticatedUser(activeUserId, localDate);
        }
      },
      recordResponse: async (input) => {
        const { activeUserId, operationStatus } = get();

        if (!activeUserId) {
          const error = new Error('Không thể xác định tài khoản hiện tại. Vui lòng đăng nhập lại.');
          set({ errorMessage: error.message, operationStatus: 'error' });
          throw error;
        }

        if (operationStatus === 'loading') {
          throw new DoseTrackingOperationInProgressError();
        }

        const userId = activeUserId;
        set({ operationStatus: 'loading', errorMessage: null });

        try {
          const event = await repository.recordDoseResponse(userId, input);

          if (get().activeUserId === userId && get().localDate === input.scheduledLocalDate) {
            set((state) => ({
              events: state.events.some((existing) => existing.id === event.id)
                ? state.events.map((existing) => (existing.id === event.id ? event : existing))
                : [...state.events, event].sort((left, right) =>
                  left.scheduledAt.localeCompare(right.scheduledAt) || left.id.localeCompare(right.id)),
              operationStatus: 'idle',
              errorMessage: null,
            }));
          }

          return event;
        } catch (error) {
          if (get().activeUserId === userId) {
            set({
              operationStatus: 'error',
              errorMessage: toSafeErrorMessage(error, 'Không thể lưu phản hồi uống thuốc.'),
            });
          }
          throw error;
        }
      },
      clearError: () => set((state) => ({
        errorMessage: null,
        operationStatus: state.operationStatus === 'error' ? 'idle' : state.operationStatus,
      })),
      reset: () => {
        invalidateListRequest();
        set({
          activeUserId: null,
          localDate: null,
          events: [],
          listStatus: 'idle',
          operationStatus: 'idle',
          errorMessage: null,
        });
      },
    };
  });
}

export const useDoseTrackingStore = createDoseTrackingStore();
