/* eslint-disable import/first */

jest.mock('@/features/auth', () => ({ getFirebaseAuthRepository: jest.fn() }));
jest.mock('@/features/profile', () => ({ getFirestoreUserProfileRepository: jest.fn() }));

const mockResetDoseEvents = jest.fn();
const mockResetMedications = jest.fn();
const mockResetSchedules = jest.fn();

jest.mock('./dose-event-store', () => ({
  useDoseEventStore: { getState: () => ({ reset: mockResetDoseEvents }) },
}));
jest.mock('./medication-store', () => ({
  useMedicationStore: { getState: () => ({ reset: mockResetMedications }) },
}));
jest.mock('./medication-schedule-store', () => ({
  useMedicationScheduleStore: { getState: () => ({ reset: mockResetSchedules }) },
}));

import type {
  AuthRepository,
  AuthStateErrorObserver,
  AuthStateObserver,
  AuthStateUnsubscribe,
} from '@/features/auth/domain/auth-repository';
import type { UserProfileRepository } from '@/features/profile/domain/user-profile-repository';
import type { AppUser, UserProfile, UserRole } from '@/types/domain';

import { createSessionStore, resetDemoSessionData } from './session-store';

const createdAt = new Date('2026-11-17T00:00:00.000Z');
const updatedAt = new Date('2026-11-17T00:01:00.000Z');

function createAuthenticatedUser(id = 'user-1', displayName = 'Cô Minh'): AppUser {
  return { id, displayName, role: null, isAuthenticated: true };
}

function createProfile(uid = 'user-1', role: UserRole = 'elderly'): UserProfile {
  return {
    uid,
    displayName: uid === 'user-1' ? 'Cô Minh' : 'Anh Nam',
    primaryRole: role,
    roles: { elderly: role === 'elderly', caregiver: role === 'caregiver' },
    locale: 'vi',
    timeZone: 'Asia/Ho_Chi_Minh',
    onboardingCompleted: true,
    createdAt,
    updatedAt,
  };
}

function createAuthRepository(): {
  repository: AuthRepository;
  emitAuthState(user: AppUser | null): void;
  emitAuthError(error: Error): void;
} {
  let onChange: AuthStateObserver | undefined;
  let onError: AuthStateErrorObserver | undefined;

  const repository: AuthRepository = {
    signIn: jest.fn(async () => createAuthenticatedUser()),
    register: jest.fn(async () => createAuthenticatedUser()),
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

function createProfileRepository(
  overrides: Partial<UserProfileRepository> = {},
): UserProfileRepository {
  return {
    getCurrentUserProfile: jest.fn(async () => createProfile()),
    createInitialProfile: jest.fn(async (role: UserRole) => createProfile('user-1', role)),
    updateOwnProfile: jest.fn(async () => createProfile()),
    ...overrides,
  };
}

async function flushProfileLoad(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('session store', () => {
  it('clears medication, schedule, and dose presentation state on logout or account switching', () => {
    resetDemoSessionData();

    expect(mockResetDoseEvents).toHaveBeenCalledTimes(1);
    expect(mockResetMedications).toHaveBeenCalledTimes(1);
    expect(mockResetSchedules).toHaveBeenCalledTimes(1);
  });

  it('waits for Firebase observer state instead of auto-signing in with mock data', () => {
    const { repository, emitAuthState } = createAuthRepository();
    const store = createSessionStore(() => repository, jest.fn(), () => createProfileRepository(), () => true);

    expect(store.getState().user).toBeNull();
    expect(store.getState().authStatus).toBe('initializing');

    store.getState().initializeAuthState();
    emitAuthState(null);

    expect(store.getState()).toMatchObject({
      user: null,
      profile: null,
      authStatus: 'unauthenticated',
      profileStatus: 'idle',
      operationStatus: 'idle',
    });
  });

  it('restores a persisted profile before exposing its persisted role', async () => {
    const { repository, emitAuthState } = createAuthRepository();
    const profileRepository = createProfileRepository();
    const store = createSessionStore(() => repository, jest.fn(), () => profileRepository, () => true);

    store.getState().initializeAuthState();
    emitAuthState(createAuthenticatedUser());
    await flushProfileLoad();

    expect(store.getState()).toMatchObject({
      user: { id: 'user-1', displayName: 'Cô Minh', role: 'elderly' },
      profile: createProfile(),
      authStatus: 'authenticated',
      profileStatus: 'ready',
      operationStatus: 'idle',
    });
    expect(profileRepository.getCurrentUserProfile).toHaveBeenCalledTimes(1);
  });

  it('keeps an authenticated account without a profile at role onboarding', async () => {
    const { repository, emitAuthState } = createAuthRepository();
    const profileRepository = createProfileRepository({ getCurrentUserProfile: jest.fn(async () => null) });
    const store = createSessionStore(() => repository, jest.fn(), () => profileRepository, () => true);

    store.getState().initializeAuthState();
    emitAuthState(createAuthenticatedUser());
    await flushProfileLoad();

    expect(store.getState()).toMatchObject({
      user: { id: 'user-1', role: null },
      profile: null,
      authStatus: 'authenticated',
      profileStatus: 'missing',
    });
  });

  it('does not bypass profile protection while Firestore profiles are feature-gated', async () => {
    const { repository, emitAuthState } = createAuthRepository();
    const profileRepository = createProfileRepository();
    const store = createSessionStore(() => repository, jest.fn(), () => profileRepository, () => false);

    store.getState().initializeAuthState();
    emitAuthState(createAuthenticatedUser());
    await flushProfileLoad();

    expect(store.getState()).toMatchObject({
      user: { id: 'user-1', role: null },
      profile: null,
      authStatus: 'authenticated',
      profileStatus: 'disabled',
    });
    expect(profileRepository.getCurrentUserProfile).not.toHaveBeenCalled();
  });

  it('shows a profile error and supports a safe retry instead of selecting a fallback role', async () => {
    const { repository, emitAuthState } = createAuthRepository();
    const getCurrentUserProfile = jest
      .fn<ReturnType<UserProfileRepository['getCurrentUserProfile']>, []>()
      .mockRejectedValueOnce(new Error('Không thể tải hồ sơ an toàn.'))
      .mockResolvedValueOnce(createProfile());
    const profileRepository = createProfileRepository({ getCurrentUserProfile });
    const store = createSessionStore(() => repository, jest.fn(), () => profileRepository, () => true);

    store.getState().initializeAuthState();
    emitAuthState(createAuthenticatedUser());
    await flushProfileLoad();

    expect(store.getState()).toMatchObject({
      user: { id: 'user-1', role: null },
      profileStatus: 'error',
      profileErrorMessage: 'Không thể tải hồ sơ an toàn.',
    });

    await store.getState().retryProfileLoad();

    expect(store.getState()).toMatchObject({
      user: { id: 'user-1', role: 'elderly' },
      profileStatus: 'ready',
      profile: createProfile(),
    });
  });

  it('creates an initial profile once and honors an already-created concurrent role', async () => {
    const { repository, emitAuthState } = createAuthRepository();
    const profileRepository = createProfileRepository({
      getCurrentUserProfile: jest.fn(async () => null),
      createInitialProfile: jest.fn(async () => createProfile('user-1', 'caregiver')),
    });
    const store = createSessionStore(() => repository, jest.fn(), () => profileRepository, () => true);

    store.getState().initializeAuthState();
    emitAuthState(createAuthenticatedUser());
    await flushProfileLoad();

    await expect(store.getState().completeRoleOnboarding('elderly')).resolves.toMatchObject({
      primaryRole: 'caregiver',
    });

    expect(profileRepository.createInitialProfile).toHaveBeenCalledWith('elderly');
    expect(store.getState()).toMatchObject({
      user: { id: 'user-1', role: 'caregiver' },
      profileStatus: 'ready',
      operationStatus: 'idle',
    });
  });

  it('discards a stale profile result after the Auth observer switches accounts', async () => {
    const { repository, emitAuthState } = createAuthRepository();
    let resolveFirstProfile: ((profile: UserProfile | null) => void) | undefined;
    const firstProfile = new Promise<UserProfile | null>((resolve) => {
      resolveFirstProfile = resolve;
    });
    const getCurrentUserProfile = jest
      .fn<ReturnType<UserProfileRepository['getCurrentUserProfile']>, []>()
      .mockReturnValueOnce(firstProfile)
      .mockResolvedValueOnce(createProfile('user-2', 'caregiver'));
    const profileRepository = createProfileRepository({ getCurrentUserProfile });
    const store = createSessionStore(() => repository, jest.fn(), () => profileRepository, () => true);

    store.getState().initializeAuthState();
    emitAuthState(createAuthenticatedUser('user-1', 'Cô Minh'));
    emitAuthState(createAuthenticatedUser('user-2', 'Anh Nam'));
    await flushProfileLoad();
    resolveFirstProfile?.(createProfile('user-1', 'elderly'));
    await flushProfileLoad();

    expect(store.getState()).toMatchObject({
      user: { id: 'user-2', displayName: 'Anh Nam', role: 'caregiver' },
      profile: createProfile('user-2', 'caregiver'),
      profileStatus: 'ready',
    });
  });

  it('clears profile state and demo memory when signing out', async () => {
    const { repository, emitAuthState } = createAuthRepository();
    const resetSessionData = jest.fn();
    const store = createSessionStore(
      () => repository,
      resetSessionData,
      () => createProfileRepository(),
      () => true,
    );

    store.getState().initializeAuthState();
    emitAuthState(createAuthenticatedUser());
    await flushProfileLoad();

    await store.getState().signOut();

    expect(repository.signOut).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({
      user: null,
      profile: null,
      authStatus: 'unauthenticated',
      profileStatus: 'idle',
      operationStatus: 'idle',
    });
    expect(resetSessionData).toHaveBeenCalled();
  });

  it('keeps an Auth observer initialization error separate from an authenticated profile', () => {
    const { repository, emitAuthError } = createAuthRepository();
    const store = createSessionStore(() => repository, jest.fn(), () => createProfileRepository(), () => true);

    store.getState().initializeAuthState();
    emitAuthError(new Error('Không thể khôi phục trạng thái đăng nhập.'));

    expect(store.getState()).toMatchObject({
      user: null,
      profile: null,
      authStatus: 'unauthenticated',
      operationStatus: 'error',
    });
  });
});
