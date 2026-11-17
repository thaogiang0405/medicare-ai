import { create } from 'zustand';

import { mockDoseEventRepository } from '@/features/schedules';
import type { DoseEvent, DoseResponseStatus } from '@/types/domain';

interface DoseEventState {
  events: DoseEvent[];
  isLoading: boolean;
  errorMessage: string | null;
  loadToday(userId: string): Promise<void>;
  recordResponse(eventId: string, status: DoseResponseStatus): Promise<void>;
  clearError(): void;
}

/** Temporary state for demo dose confirmations only; it resets with the app. */
export const useDoseEventStore = create<DoseEventState>((set) => ({
  events: [],
  isLoading: false,
  errorMessage: null,
  loadToday: async (userId) => {
    set({ isLoading: true, errorMessage: null });

    try {
      const events = await mockDoseEventRepository.getTodayEvents(userId);
      set({ events, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Không thể tải lịch uống demo.';
      set({ isLoading: false, errorMessage });
    }
  },
  recordResponse: async (eventId, status) => {
    set({ errorMessage: null });

    try {
      const updatedEvent = await mockDoseEventRepository.recordResponse(eventId, status);
      set((state) => ({
        events: state.events.map((event) => (event.id === eventId ? updatedEvent : event)),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Không thể cập nhật phản hồi demo.';
      set({ errorMessage });
    }
  },
  clearError: () => set({ errorMessage: null }),
}));
