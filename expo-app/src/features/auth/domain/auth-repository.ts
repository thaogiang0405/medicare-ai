import type { AppUser, UserRole } from '@/types/domain';

export interface SignInInput {
  identifier: string;
  password: string;
}

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
}

export interface AuthRepository {
  signIn(input: SignInInput): Promise<AppUser>;
  register(input: RegisterInput): Promise<AppUser>;
  continueAs(role: UserRole): Promise<AppUser>;
  signOut(): Promise<void>;
}
