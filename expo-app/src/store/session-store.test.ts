/* eslint-disable import/first */

jest.mock('@/features/auth', () => ({ getFirebaseAuthRepository: jest.fn() }));

import type {
  AuthRepository,
  AuthStateErrorObserver,
  AuthStateObserver,
  AuthStateUnsubscribe,
} from '@/features/auth/domain/auth-repository';
import type { AppUser } from '@/types/domain';

import { createSessionStore } from './session-store';

const authenticatedUser: AppUser = {
  id: 'user-1',
  displayName: 'Cô Minh',
  role: null,
  isAuthenticated: true,
};

function createRepository(): {
  repository: AuthRepository;
  emitAuthState(user: AppUser | null): void;
  emitAuthError(error: Error): void;
} {
  let onChange: AuthStateObserver | undefined;
  let onError: AuthStateErrorObserver | undefined;

  const repository: AuthRepository = {
    signIn: jest.fn(async () => authenticatedUser),
    register: jest.fn(async () => authenticatedUser),
    signOut: jest.fn(async () => undefined),
    sendPasswordReset: jest.fn(async () => undefined),
    observeAuthState: jest.fn(
      (change: AuthStateObserver, error?: AuthStateErrorObserver): AuthStateUnsubscribe => {
        onChange = change;
        onError = error;
        return () => undefined;
      },
    ),
  };

  return {
    repository,
    emitAuthState: (user) => onChange?.(user),
    emitAuthError: (error) => onError?.(error),
  };
}

describe('session store', () => {
  it('waits for Firebase observer state instead of auto-signing in with mock data', () => {
    const { repository, emitAuthState } = createRepository();
    const resetSessionData = jest.fn();
    const store = createSessionStore(() => repository, resetSessionData);

    expect(store.getState().user).toBeNull();
    expect(store.getState().authStatus).toBe('initializing');

    store.getState().initializeAuthState();
    emitAuthState(null);

    expect(store.getState()).toMatchObject({
      user: null,
      authStatus: 'unauthenticated',
      operationStatus: 'idle',
    });
  });

  it('restores an observed session and clears in-memory data on sign-out', async () => {
    const { repository, emitAuthState } = createRepository();
    const resetSessionData = jest.fn();
    const store = createSessionStore(() => repository, resetSessionData);

    store.getState().initializeAuthState();
    emitAuthState(authenticatedUser);

    expect(store.getState()).toMatchObject({
      user: authenticatedUser,
      authStatus: 'authenticated',
      operationStatus: 'idle',
    });

    await store.getState().signOut();

    expect(repository.signOut).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({
      user: null,
      authStatus: 'unauthenticated',
      operationStatus: 'idle',
    });
    expect(resetSessionData).toHaveBeenCalled();
  });

  it('keeps an auth initialization error separate from a persisted user identity', () => {
    const { repository, emitAuthError } = createRepository();
    const store = createSessionStore(() => repository, jest.fn());

    store.getState().initializeAuthState();
    emitAuthError(new Error('Không thể khôi phục trạng thái đăng nhập.'));

    expect(store.getState()).toMatchObject({
      user: null,
      authStatus: 'unauthenticated',
      operationStatus: 'error',
    });
  });
});
