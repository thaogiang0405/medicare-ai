import { create } from 'zustand';

import { mockDoseEventRepository } from '@/features/schedules';
import type { DoseEventRepository } from '@/features/schedules/domain/dose-event-repository';
import type { DoseEvent, DoseResponseStatus } from '@/types/domain';

interface DoseEventState {
  activeUserId: string | null;
  events: DoseEvent[];
  isLoading: boolean;
  errorMessage: string | null;
  loadToday(userId: string): Promise<void>;
  recordResponse(eventId: string, status: DoseResponseStatus): Promise<void>;
  clearError(): void;
  reset(): void;
}

/** Temporary state for demo dose confirmations only; it resets with the app. */
export function createDoseEventStore(repository: DoseEventRepository = mockDoseEventRepository) {
  return create<DoseEventState>((set, get) => ({
    activeUserId: null,
    events: [],
    isLoading: false,
    errorMessage: null,
    loadToday: async (userId) => {
      const normalizedUserId = userId.trim();

      if (!normalizedUserId) {
        set({
          activeUserId: null,
          events: [],
          isLoading: false,
          errorMessage: 'Không thể xác định tài khoản hiện tại. Vui lòng đăng nhập lại.',
        });
        return;
      }

      set({ activeUserId: normalizedUserId, events: [], isLoading: true, errorMessage: null });

      try {
        const events = await repository.getTodayEvents(normalizedUserId);
        set((state) => (state.activeUserId === normalizedUserId ? { events, isLoading: false } : state));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Không thể tải lịch uống demo.';
        set((state) => (state.activeUserId === normalizedUserId ? { isLoading: false, errorMessage } : state));
      }
    },
    recordResponse: async (eventId, status) => {
      const userId = get().activeUserId;

      if (!userId) {
        set({ errorMessage: 'Không thể xác định tài khoản hiện tại. Vui lòng đăng nhập lại.' });
        return;
      }

      set({ errorMessage: null });

      try {
        const updatedEvent = await repository.recordResponse(userId, eventId, status);
        set((state) => ({
          events:
            state.activeUserId === userId
              ? state.events.map((event) => (event.id === eventId ? updatedEvent : event))
              : state.events,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Không thể cập nhật phản hồi demo.';
        set((state) => (state.activeUserId === userId ? { errorMessage } : state));
      }
    },
    clearError: () => set({ errorMessage: null }),
    reset: () => set({ activeUserId: null, events: [], isLoading: false, errorMessage: null }),
  }));
}

export const useDoseEventStore = createDoseEventStore();
