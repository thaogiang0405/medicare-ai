import { create } from 'zustand';

import {
  getFirebaseAuthRepository,
  type AuthRepository,
  type RegisterInput,
  type SignInInput,
} from '@/features/auth';
import type { AppUser } from '@/types/domain';

import { useDoseEventStore } from './dose-event-store';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';
export type SessionOperationStatus = 'idle' | 'loading' | 'error';

export interface SessionState {
  user: AppUser | null;
  authStatus: AuthStatus;
  operationStatus: SessionOperationStatus;
  errorMessage: string | null;
  initializeAuthState(): () => void;
  signIn(input: SignInInput): Promise<AppUser>;
  register(input: RegisterInput): Promise<AppUser>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  clearError(): void;
}

type AuthRepositoryFactory = () => AuthRepository;
type ResetSessionData = () => void;

function toSafeErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Không thể hoàn tất yêu cầu xác thực. Vui lòng thử lại.';
}

async function performAuthenticationAction(
  set: (partial: Partial<SessionState>) => void,
  resetSessionData: ResetSessionData,
  previousUser: () => AppUser | null,
  action: () => Promise<AppUser>,
): Promise<AppUser> {
  set({ operationStatus: 'loading', errorMessage: null });

  try {
    const user = await action();

    if (previousUser()?.id !== user.id) {
      resetSessionData();
    }

    set({ user, authStatus: 'authenticated', operationStatus: 'idle' });
    return user;
  } catch (error) {
    set({ operationStatus: 'error', errorMessage: toSafeErrorMessage(error) });
    throw error;
  }
}

/**
 * Creates an in-memory UI store. Firebase owns credential persistence through
 * AsyncStorage; Zustand never receives a password, ID token, or refresh token.
 */
export function createSessionStore(
  getRepository: AuthRepositoryFactory = getFirebaseAuthRepository,
  resetSessionData: ResetSessionData = () => useDoseEventStore.getState().reset(),
) {
  let authStateUnsubscribe: (() => void) | null = null;

  return create<SessionState>((set, get) => ({
    user: null,
    authStatus: 'initializing',
    operationStatus: 'idle',
    errorMessage: null,
    initializeAuthState: () => {
      authStateUnsubscribe?.();
      authStateUnsubscribe = null;
      set({ authStatus: 'initializing', operationStatus: 'idle', errorMessage: null });

      try {
        const unsubscribe = getRepository().observeAuthState(
          (user) => {
            const previousUser = get().user;

            if (!user || previousUser?.id !== user.id) {
              resetSessionData();
            }

            set({
              user,
              authStatus: user ? 'authenticated' : 'unauthenticated',
              operationStatus: 'idle',
              errorMessage: null,
            });
          },
          (error) => {
            resetSessionData();
            set({
              user: null,
              authStatus: 'unauthenticated',
              operationStatus: 'error',
              errorMessage: toSafeErrorMessage(error),
            });
          },
        );

        authStateUnsubscribe = unsubscribe;

        return () => {
          if (authStateUnsubscribe === unsubscribe) {
            unsubscribe();
            authStateUnsubscribe = null;
          }
        };
      } catch (error) {
        resetSessionData();
        set({
          user: null,
          authStatus: 'unauthenticated',
          operationStatus: 'error',
          errorMessage: toSafeErrorMessage(error),
        });
        return () => undefined;
      }
    },
    signIn: (input) =>
      performAuthenticationAction(
        set,
        resetSessionData,
        () => get().user,
        () => getRepository().signIn(input),
      ),
    register: (input) =>
      performAuthenticationAction(
        set,
        resetSessionData,
        () => get().user,
        () => getRepository().register(input),
      ),
    signOut: async () => {
      set({ operationStatus: 'loading', errorMessage: null });

      try {
        await getRepository().signOut();
        resetSessionData();
        set({ user: null, authStatus: 'unauthenticated', operationStatus: 'idle' });
      } catch (error) {
        set({ operationStatus: 'error', errorMessage: toSafeErrorMessage(error) });
        throw error;
      }
    },
    sendPasswordReset: async (email) => {
      set({ operationStatus: 'loading', errorMessage: null });

      try {
        await getRepository().sendPasswordReset(email);
        set({ operationStatus: 'idle' });
      } catch (error) {
        set({ operationStatus: 'error', errorMessage: toSafeErrorMessage(error) });
        throw error;
      }
    },
    clearError: () =>
      set((state) => ({
        errorMessage: null,
        operationStatus: state.operationStatus === 'error' ? 'idle' : state.operationStatus,
      })),
  }));
}

export const useSessionStore = createSessionStore();
