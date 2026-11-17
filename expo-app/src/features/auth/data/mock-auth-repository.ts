import type { AppUser, UserRole } from '@/types/domain';

import type { AuthRepository, RegisterInput, SignInInput } from '../domain/auth-repository';

const demoUsers: Record<UserRole, AppUser> = {
  elderly: {
    id: 'demo-elderly-minh',
    displayName: 'Cô Minh',
    role: 'elderly',
    isAuthenticated: true,
  },
  caregiver: {
    id: 'demo-caregiver-nam',
    displayName: 'Anh Nam',
    role: 'caregiver',
    isAuthenticated: true,
  },
};

function waitForDemoResponse(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 180);
  });
}

function cloneUser(user: AppUser): AppUser {
  return { ...user };
}

/**
 * Temporary repository for Migration 1.
 * No password, token, or health data is persisted by this implementation.
 */
export class MockAuthRepository implements AuthRepository {
  async signIn(_input: SignInInput): Promise<AppUser> {
    await waitForDemoResponse();
    return cloneUser(demoUsers.elderly);
  }

  async register(input: RegisterInput): Promise<AppUser> {
    await waitForDemoResponse();
    const displayName = input.displayName.trim() || 'Người dùng demo';

    return {
      ...cloneUser(demoUsers.elderly),
      displayName,
      role: null,
    };
  }

  async continueAs(role: UserRole): Promise<AppUser> {
    await waitForDemoResponse();
    return cloneUser(demoUsers[role]);
  }

  async signOut(): Promise<void> {
    await waitForDemoResponse();
  }
}

export const mockAuthRepository = new MockAuthRepository();
