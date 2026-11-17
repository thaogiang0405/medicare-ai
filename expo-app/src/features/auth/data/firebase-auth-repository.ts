import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  validatePassword,
  type Auth,
  type User,
} from 'firebase/auth';

import { getFirebaseAuth } from '@/services/firebase';
import type { AppUser } from '@/types/domain';

import {
  AuthRepositoryError,
  isEnumerationSafePasswordResetError,
  mapFirebaseAuthError,
} from './auth-errors';
import type {
  AuthRepository,
  AuthStateErrorObserver,
  AuthStateObserver,
  AuthStateUnsubscribe,
  RegisterInput,
  SignInInput,
} from '../domain/auth-repository';

export type FirebaseAuthUser = {
  uid: string;
  displayName: string | null;
};

export type FirebaseAuthPort = {
  createUser(email: string, password: string): Promise<FirebaseAuthUser>;
  signIn(email: string, password: string): Promise<FirebaseAuthUser>;
  signOut(): Promise<void>;
  observeAuthState(
    onChange: (user: FirebaseAuthUser | null) => void,
    onError?: (error: Error) => void,
  ): AuthStateUnsubscribe;
  sendPasswordReset(email: string): Promise<void>;
  updateProfile(user: FirebaseAuthUser, update: { displayName: string }): Promise<void>;
  validatePassword(password: string): Promise<{ isValid: boolean }>;
};

function createFirebaseAuthPort(auth: Auth = getFirebaseAuth()): FirebaseAuthPort {
  return {
    async createUser(email, password) {
      return (await createUserWithEmailAndPassword(auth, email, password)).user;
    },
    async signIn(email, password) {
      return (await signInWithEmailAndPassword(auth, email, password)).user;
    },
    signOut: () => signOut(auth),
    observeAuthState: (onChange, onError) =>
      onAuthStateChanged(auth, (user) => onChange(user), onError),
    sendPasswordReset: (email) => sendPasswordResetEmail(auth, email),
    updateProfile: (user, update) => updateProfile(user as User, update),
    validatePassword: (password) => validatePassword(auth, password),
  };
}

export function mapFirebaseUserToAppUser(user: FirebaseAuthUser): AppUser {
  return {
    id: user.uid,
    displayName: user.displayName?.trim() || 'Người dùng MediCare',
    role: null,
    isAuthenticated: true,
  };
}

/** Firebase-backed implementation; no password or token is persisted by this layer. */
export class FirebaseAuthRepository implements AuthRepository {
  constructor(private readonly authPort: FirebaseAuthPort = createFirebaseAuthPort()) {}

  async signIn({ email, password }: SignInInput): Promise<AppUser> {
    try {
      return mapFirebaseUserToAppUser(await this.authPort.signIn(email.trim(), password));
    } catch (error) {
      throw mapFirebaseAuthError(error, 'signIn');
    }
  }

  async register({ displayName, email, password }: RegisterInput): Promise<AppUser> {
    const normalizedDisplayName = displayName.trim();

    try {
      const passwordStatus = await this.authPort.validatePassword(password);

      if (!passwordStatus.isValid) {
        throw new AuthRepositoryError(
          'Mật khẩu chưa đáp ứng chính sách bảo mật. Hãy dùng mật khẩu mạnh hơn.',
          'auth/password-does-not-meet-requirements',
        );
      }

      const user = await this.authPort.createUser(email.trim(), password);

      if (normalizedDisplayName) {
        await this.authPort.updateProfile(user, { displayName: normalizedDisplayName });
      }

      return mapFirebaseUserToAppUser({
        ...user,
        displayName: normalizedDisplayName || user.displayName,
      });
    } catch (error) {
      throw mapFirebaseAuthError(error, 'register');
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.authPort.signOut();
    } catch (error) {
      throw mapFirebaseAuthError(error, 'signOut');
    }
  }

  observeAuthState(
    onChange: AuthStateObserver,
    onError?: AuthStateErrorObserver,
  ): AuthStateUnsubscribe {
    return this.authPort.observeAuthState(
      (user) => onChange(user ? mapFirebaseUserToAppUser(user) : null),
      (error) => onError?.(mapFirebaseAuthError(error, 'observeAuthState')),
    );
  }

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await this.authPort.sendPasswordReset(email.trim());
    } catch (error) {
      // Preserve an account-enumeration-safe response when older project settings
      // still report an unknown email explicitly.
      if (isEnumerationSafePasswordResetError(error)) {
        return;
      }

      throw mapFirebaseAuthError(error, 'passwordReset');
    }
  }
}

let firebaseAuthRepository: FirebaseAuthRepository | null = null;

/** Lazily creates the live repository after Firebase Auth persistence is ready. */
export function getFirebaseAuthRepository(): FirebaseAuthRepository {
  firebaseAuthRepository ??= new FirebaseAuthRepository();
  return firebaseAuthRepository;
}
