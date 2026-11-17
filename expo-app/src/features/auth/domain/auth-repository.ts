import type { AppUser } from '@/types/domain';

export interface SignInInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
}

export type AuthStateObserver = (user: AppUser | null) => void;
export type AuthStateErrorObserver = (error: Error) => void;
export type AuthStateUnsubscribe = () => void;

export interface AuthRepository {
  signIn(input: SignInInput): Promise<AppUser>;
  register(input: RegisterInput): Promise<AppUser>;
  signOut(): Promise<void>;
  observeAuthState(
    onChange: AuthStateObserver,
    onError?: AuthStateErrorObserver,
  ): AuthStateUnsubscribe;
  sendPasswordReset(email: string): Promise<void>;
}
