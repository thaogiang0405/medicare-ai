import { create } from 'zustand';

import {
  mockAuthRepository,
  type RegisterInput,
  type SignInInput,
} from '@/features/auth';
import type { AppUser, UserRole } from '@/types/domain';

interface SessionState {
  user: AppUser | null;
  isLoading: boolean;
  errorMessage: string | null;
  signIn(input: SignInInput): Promise<AppUser>;
  register(input: RegisterInput): Promise<AppUser>;
  continueAs(role: UserRole): Promise<AppUser>;
  signOut(): Promise<void>;
  clearError(): void;
}

async function performSessionAction(
  set: (partial: Partial<SessionState>) => void,
  action: () => Promise<AppUser>,
): Promise<AppUser> {
  set({ isLoading: true, errorMessage: null });

  try {
    const user = await action();
    set({ user, isLoading: false });
    return user;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Không thể tiếp tục ở chế độ demo.';
    set({ isLoading: false, errorMessage });
    throw error;
  }
}

/** In-memory UI state; no user or health information is persisted locally. */
export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  isLoading: false,
  errorMessage: null,
  signIn: (input) => performSessionAction(set, () => mockAuthRepository.signIn(input)),
  register: (input) => performSessionAction(set, () => mockAuthRepository.register(input)),
  continueAs: (role) => performSessionAction(set, () => mockAuthRepository.continueAs(role)),
  signOut: async () => {
    set({ isLoading: true, errorMessage: null });

    try {
      await mockAuthRepository.signOut();
      set({ user: null, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Không thể đăng xuất chế độ demo.';
      set({ isLoading: false, errorMessage });
      throw error;
    }
  },
  clearError: () => set({ errorMessage: null }),
}));
