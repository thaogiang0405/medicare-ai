import { create } from 'zustand';

import { getDoseHistoryRepository } from '@/features/schedules/data/dose-history-repository-selector';
import {
  doseHistoryDefaultPageSize,
  getDoseHistoryDateRange,
  type DoseHistoryCursor,
  type DoseHistoryRange,
  type DoseHistoryRepository,
} from '@/features/schedules/domain/dose-history-repository';
import type { DoseEvent } from '@/types/domain';

export type DoseHistoryListStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DoseHistoryState {
  activeUserId: string | null;
  range: DoseHistoryRange;
  dateRange: Readonly<{ startLocalDate: string; endLocalDate: string }> | null;
  events: readonly DoseEvent[];
  nextCursor: DoseHistoryCursor | null;
  listStatus: DoseHistoryListStatus;
  isLoadingMore: boolean;
  errorMessage: string | null;
  loadForAuthenticatedUser(userId: string, range?: DoseHistoryRange, now?: Date): Promise<void>;
  loadMore(): Promise<void>;
  retry(): Promise<void>;
  reset(): void;
}

const lazyDoseHistoryRepository: DoseHistoryRepository = {
  listDoseHistory: (userId, query) => getDoseHistoryRepository().listDoseHistory(userId, query),
};

function toSafeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Không thể tải lịch sử uống thuốc. Vui lòng thử lại.';
}

function mergeDoseEvents(existing: readonly DoseEvent[], incoming: readonly DoseEvent[]): DoseEvent[] {
  const byId = new Map(existing.map((event) => [event.id, event] as const));

  for (const event of incoming) {
    byId.set(event.id, event);
  }

  return [...byId.values()].sort((left, right) =>
    (right.scheduledLocalDate ?? '').localeCompare(left.scheduledLocalDate ?? '')
    || (right.scheduledLocalTime ?? '').localeCompare(left.scheduledLocalTime ?? '')
    || right.id.localeCompare(left.id));
}

/**
 * Bounded, session-scoped history state. A request generation is invalidated
 * on logout, account switch, range change, and retry so late results cannot
 * surface under another elderly profile.
 */
export function createDoseHistoryStore(repository: DoseHistoryRepository = lazyDoseHistoryRepository) {
  let requestVersion = 0;

  return create<DoseHistoryState>((set, get) => {
    const invalidateRequests = () => {
      requestVersion += 1;
      return requestVersion;
    };
    const isCurrent = (version: number, userId: string) =>
      version === requestVersion && get().activeUserId === userId;

    const loadForAuthenticatedUser = async (
      userId: string,
      range: DoseHistoryRange = get().range,
      now: Date = new Date(),
    ): Promise<void> => {
      const normalizedUserId = userId.trim();

      if (!normalizedUserId) {
        invalidateRequests();
        set({
          activeUserId: null,
          dateRange: null,
          events: [],
          nextCursor: null,
          listStatus: 'error',
          isLoadingMore: false,
          errorMessage: 'Không thể xác định tài khoản hiện tại. Vui lòng đăng nhập lại.',
        });
        return;
      }

      const version = invalidateRequests();
      const dateRange = getDoseHistoryDateRange(range, now);
      set({
        activeUserId: normalizedUserId,
        range,
        dateRange,
        events: [],
        nextCursor: null,
        listStatus: 'loading',
        isLoadingMore: false,
        errorMessage: null,
      });

      try {
        const page = await repository.listDoseHistory(normalizedUserId, {
          ...dateRange,
          pageSize: doseHistoryDefaultPageSize,
        });

        if (isCurrent(version, normalizedUserId)) {
          set({
            events: page.events,
            nextCursor: page.nextCursor,
            listStatus: 'ready',
            isLoadingMore: false,
            errorMessage: null,
          });
        }
      } catch (error) {
        if (isCurrent(version, normalizedUserId)) {
          set({
            events: [],
            nextCursor: null,
            listStatus: 'error',
            isLoadingMore: false,
            errorMessage: toSafeErrorMessage(error),
          });
        }
      }
    };

    return {
      activeUserId: null,
      range: 'day',
      dateRange: null,
      events: [],
      nextCursor: null,
      listStatus: 'idle',
      isLoadingMore: false,
      errorMessage: null,
      loadForAuthenticatedUser,
      loadMore: async () => {
        const state = get();

        if (!state.activeUserId || !state.nextCursor || state.listStatus !== 'ready' || state.isLoadingMore) {
          return;
        }

        const userId = state.activeUserId;
        const version = requestVersion;
        const dateRange = state.dateRange;
        const cursor = state.nextCursor;

        if (!dateRange) {
          return;
        }
        set({ isLoadingMore: true, errorMessage: null });

        try {
          const page = await repository.listDoseHistory(userId, {
            ...dateRange,
            pageSize: doseHistoryDefaultPageSize,
            cursor,
          });

          if (isCurrent(version, userId) && get().nextCursor === cursor) {
            set((current) => ({
              events: mergeDoseEvents(current.events, page.events),
              nextCursor: page.nextCursor,
              isLoadingMore: false,
              errorMessage: null,
            }));
          }
        } catch (error) {
          if (isCurrent(version, userId)) {
            set({ isLoadingMore: false, errorMessage: toSafeErrorMessage(error) });
          }
        }
      },
      retry: async () => {
        const state = get();
        if (state.activeUserId) {
          await loadForAuthenticatedUser(state.activeUserId, state.range);
        }
      },
      reset: () => {
        invalidateRequests();
        set({
          activeUserId: null,
          range: 'day',
          dateRange: null,
          events: [],
          nextCursor: null,
          listStatus: 'idle',
          isLoadingMore: false,
          errorMessage: null,
        });
      },
    };
  });
}

export const useDoseHistoryStore = createDoseHistoryStore();
