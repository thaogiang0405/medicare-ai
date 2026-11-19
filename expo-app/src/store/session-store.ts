import { create } from 'zustand';

import {
  getFirebaseAuthRepository,
  type AuthRepository,
  type RegisterInput,
  type SignInInput,
} from '@/features/auth';
import {
  getFirestoreUserProfileRepository,
  type UserProfileRepository,
} from '@/features/profile';
import {
  firestoreUserProfilesUnavailableMessage,
  isFirestoreUserProfilesFeatureEnabled,
} from '@/services/firebase/firestore-profile-feature';
import { getLocalReminderService, isLocalRemindersFeatureEnabled } from '@/services/notifications';
import type { AppUser, UserProfile, UserRole } from '@/types/domain';

import { useDoseEventStore } from './dose-event-store';
import { useDoseTrackingStore } from './dose-tracking-store';
import { useMedicationScheduleStore } from './medication-schedule-store';
import { useMedicationStore } from './medication-store';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';
export type ProfileStatus = 'idle' | 'loading' | 'missing' | 'ready' | 'error' | 'disabled';
export type SessionOperationStatus = 'idle' | 'loading' | 'error';

export interface SessionState {
  user: AppUser | null;
  profile: UserProfile | null;
  authStatus: AuthStatus;
  profileStatus: ProfileStatus;
  operationStatus: SessionOperationStatus;
  errorMessage: string | null;
  profileErrorMessage: string | null;
  initializeAuthState(): () => void;
  retryProfileLoad(): Promise<void>;
  completeRoleOnboarding(role: UserRole): Promise<UserProfile>;
  signIn(input: SignInInput): Promise<AppUser>;
  register(input: RegisterInput): Promise<AppUser>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  clearError(): void;
}

type AuthRepositoryFactory = () => AuthRepository;
type ProfileRepositoryFactory = () => UserProfileRepository;
type ResetSessionData = (previousUserId?: string) => void;
type ProfileFeatureEnabled = () => boolean;

/** Clears account-bound presentation state without deleting repository data. */
export function resetDemoSessionData(previousUserId?: string): void {
  useDoseEventStore.getState().reset();
  useDoseTrackingStore.getState().reset();
  useMedicationStore.getState().reset();
  useMedicationScheduleStore.getState().reset();

  if (previousUserId?.trim() && isLocalRemindersFeatureEnabled()) {
    // Never let a local notification cleanup failure block auth state reset.
    void getLocalReminderService().cancelUserReminders(previousUserId).catch(() => undefined);
  }
}

function toSafeErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Không thể hoàn tất yêu cầu xác thực. Vui lòng thử lại.';
}

function toProfileUser(authUser: AppUser, profile: UserProfile): AppUser {
  return {
    ...authUser,
    displayName: profile.displayName,
    role: profile.primaryRole,
  };
}

async function performAuthenticationAction(
  set: (partial: Partial<SessionState>) => void,
  resetSessionData: ResetSessionData,
  previousUser: () => AppUser | null,
  action: () => Promise<AppUser>,
): Promise<AppUser> {
  set({ operationStatus: 'loading', errorMessage: null });

  try {
    const userBeforeAction = previousUser();
    const user = await action();

    if (userBeforeAction?.id !== user.id) {
      resetSessionData(userBeforeAction?.id);
    }

    // Firebase's observer remains the source of truth for the session and
    // starts the profile load. This avoids racing a sign-in promise against a
    // restored or switched auth identity.
    set({ operationStatus: 'idle', errorMessage: null });
    return user;
  } catch (error) {
    set({ operationStatus: 'error', errorMessage: toSafeErrorMessage(error) });
    throw error;
  }
}

/**
 * Creates an in-memory UI store. Firebase Auth owns credential persistence and
 * Firestore owns the profile document; Zustand never receives passwords or tokens.
 */
export function createSessionStore(
  getAuthRepository: AuthRepositoryFactory = getFirebaseAuthRepository,
  resetSessionData: ResetSessionData = resetDemoSessionData,
  getProfileRepository: ProfileRepositoryFactory = getFirestoreUserProfileRepository,
  isProfileFeatureEnabled: ProfileFeatureEnabled = isFirestoreUserProfilesFeatureEnabled,
) {
  let authStateUnsubscribe: (() => void) | null = null;
  let profileRequestVersion = 0;

  return create<SessionState>((set, get) => {
    const invalidateProfileRequest = () => {
      profileRequestVersion += 1;
      return profileRequestVersion;
    };

    const isCurrentProfileRequest = (requestVersion: number, uid: string) =>
      requestVersion === profileRequestVersion
      && get().authStatus === 'authenticated'
      && get().user?.id === uid;

    const resetProfileState = () => {
      invalidateProfileRequest();
      set({
        profile: null,
        profileStatus: 'idle',
        profileErrorMessage: null,
      });
    };

    const loadProfileForAuthenticatedUser = async (authUser: AppUser): Promise<void> => {
      const requestVersion = invalidateProfileRequest();

      set({
        user: { ...authUser, role: null },
        profile: null,
        profileStatus: 'loading',
        profileErrorMessage: null,
      });

      if (!isProfileFeatureEnabled()) {
        if (isCurrentProfileRequest(requestVersion, authUser.id)) {
          set({
            profileStatus: 'disabled',
            profileErrorMessage: firestoreUserProfilesUnavailableMessage,
          });
        }
        return;
      }

      try {
        const profile = await getProfileRepository().getCurrentUserProfile();

        if (!isCurrentProfileRequest(requestVersion, authUser.id)) {
          return;
        }

        if (!profile) {
          set({
            user: { ...authUser, role: null },
            profile: null,
            profileStatus: 'missing',
            profileErrorMessage: null,
          });
          return;
        }

        if (profile.uid !== authUser.id) {
          throw new Error('Hồ sơ không khớp với phiên đăng nhập hiện tại.');
        }

        set({
          user: toProfileUser(authUser, profile),
          profile,
          profileStatus: 'ready',
          profileErrorMessage: null,
        });
      } catch (error) {
        if (isCurrentProfileRequest(requestVersion, authUser.id)) {
          set({
            user: { ...authUser, role: null },
            profile: null,
            profileStatus: 'error',
            profileErrorMessage: toSafeErrorMessage(error),
          });
        }
      }
    };

    return {
      user: null,
      profile: null,
      authStatus: 'initializing',
      profileStatus: 'idle',
      operationStatus: 'idle',
      errorMessage: null,
      profileErrorMessage: null,
      initializeAuthState: () => {
        authStateUnsubscribe?.();
        authStateUnsubscribe = null;
        resetProfileState();
        set({ authStatus: 'initializing', operationStatus: 'idle', errorMessage: null, user: null });

        try {
          const unsubscribe = getAuthRepository().observeAuthState(
            (authUser) => {
              const previousUser = get().user;

              if (!authUser) {
                invalidateProfileRequest();
                resetSessionData(previousUser?.id);
                set({
                  user: null,
                  profile: null,
                  authStatus: 'unauthenticated',
                  profileStatus: 'idle',
                  operationStatus: 'idle',
                  errorMessage: null,
                  profileErrorMessage: null,
                });
                return;
              }

              if (previousUser?.id !== authUser.id) {
                resetSessionData(previousUser?.id);
              }

              set({
                user: { ...authUser, role: null },
                profile: null,
                authStatus: 'authenticated',
                profileStatus: 'loading',
                operationStatus: 'idle',
                errorMessage: null,
                profileErrorMessage: null,
              });
              void loadProfileForAuthenticatedUser(authUser);
            },
            (error) => {
              invalidateProfileRequest();
              resetSessionData(get().user?.id);
              set({
                user: null,
                profile: null,
                authStatus: 'unauthenticated',
                profileStatus: 'error',
                operationStatus: 'error',
                errorMessage: toSafeErrorMessage(error),
                profileErrorMessage: 'Không thể khôi phục hồ sơ an toàn. Vui lòng thử lại.',
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
          invalidateProfileRequest();
          resetSessionData();
          set({
            user: null,
            profile: null,
            authStatus: 'unauthenticated',
            profileStatus: 'error',
            operationStatus: 'error',
            errorMessage: toSafeErrorMessage(error),
            profileErrorMessage: 'Không thể khởi tạo hồ sơ an toàn. Vui lòng thử lại.',
          });
          return () => undefined;
        }
      },
      retryProfileLoad: async () => {
        const user = get().user;

        if (!user || get().authStatus !== 'authenticated') {
          return;
        }

        await loadProfileForAuthenticatedUser(user);
      },
      completeRoleOnboarding: async (role) => {
        const authUser = get().user;

        if (!authUser || get().authStatus !== 'authenticated') {
          const error = new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          set({ operationStatus: 'error', errorMessage: error.message });
          throw error;
        }

        const requestVersion = invalidateProfileRequest();
        set({
          profile: null,
          profileStatus: 'loading',
          profileErrorMessage: null,
          operationStatus: 'loading',
          errorMessage: null,
        });

        if (!isProfileFeatureEnabled()) {
          const error = new Error(firestoreUserProfilesUnavailableMessage);

          if (isCurrentProfileRequest(requestVersion, authUser.id)) {
            set({
              profileStatus: 'disabled',
              profileErrorMessage: error.message,
              operationStatus: 'error',
              errorMessage: error.message,
            });
          }
          throw error;
        }

        try {
          const profile = await getProfileRepository().createInitialProfile(role);

          if (!isCurrentProfileRequest(requestVersion, authUser.id)) {
            return profile;
          }

          if (profile.uid !== authUser.id) {
            throw new Error('Hồ sơ không khớp với phiên đăng nhập hiện tại.');
          }

          set({
            user: toProfileUser(authUser, profile),
            profile,
            profileStatus: 'ready',
            profileErrorMessage: null,
            operationStatus: 'idle',
            errorMessage: null,
          });
          return profile;
        } catch (error) {
          if (isCurrentProfileRequest(requestVersion, authUser.id)) {
            const message = toSafeErrorMessage(error);
            set({
              user: { ...authUser, role: null },
              profile: null,
              profileStatus: 'error',
              profileErrorMessage: message,
              operationStatus: 'error',
              errorMessage: message,
            });
          }
          throw error;
        }
      },
      signIn: (input) =>
        performAuthenticationAction(
          set,
          resetSessionData,
          () => get().user,
          () => getAuthRepository().signIn(input),
        ),
      register: (input) =>
        performAuthenticationAction(
          set,
          resetSessionData,
          () => get().user,
          () => getAuthRepository().register(input),
        ),
      signOut: async () => {
        set({ operationStatus: 'loading', errorMessage: null });
        const signedOutUserId = get().user?.id;

        try {
          await getAuthRepository().signOut();
          invalidateProfileRequest();
          resetSessionData(signedOutUserId);
          set({
            user: null,
            profile: null,
            authStatus: 'unauthenticated',
            profileStatus: 'idle',
            profileErrorMessage: null,
            operationStatus: 'idle',
          });
        } catch (error) {
          set({ operationStatus: 'error', errorMessage: toSafeErrorMessage(error) });
          throw error;
        }
      },
      sendPasswordReset: async (email) => {
        set({ operationStatus: 'loading', errorMessage: null });

        try {
          await getAuthRepository().sendPasswordReset(email);
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
    };
  });
}

export const useSessionStore = createSessionStore();
