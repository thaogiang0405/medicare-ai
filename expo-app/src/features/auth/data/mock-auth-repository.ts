import type { AppUser } from '@/types/domain';

import type {
  AuthRepository,
  AuthStateErrorObserver,
  AuthStateObserver,
  AuthStateUnsubscribe,
  RegisterInput,
  SignInInput,
} from '../domain/auth-repository';

const demoUser: AppUser = {
  id: 'demo-auth-user',
  displayName: 'Người dùng demo',
  role: null,
  isAuthenticated: true,
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
 * Test-only replacement. The production session store never imports it.
 */
export class MockAuthRepository implements AuthRepository {
  async signIn(_input: SignInInput): Promise<AppUser> {
    await waitForDemoResponse();
    return cloneUser(demoUser);
  }

  async register(input: RegisterInput): Promise<AppUser> {
    await waitForDemoResponse();
    const displayName = input.displayName.trim() || 'Người dùng demo';

    return {
      ...cloneUser(demoUser),
      displayName,
    };
  }

  async signOut(): Promise<void> {
    await waitForDemoResponse();
  }

  observeAuthState(
    onChange: AuthStateObserver,
    _onError?: AuthStateErrorObserver,
  ): AuthStateUnsubscribe {
    onChange(null);
    return () => undefined;
  }

  async sendPasswordReset(_email: string): Promise<void> {
    await waitForDemoResponse();
  }
}

export const mockAuthRepository = new MockAuthRepository();
