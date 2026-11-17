/* eslint-disable import/first */

jest.mock('firebase/auth', () => ({}));
jest.mock('@/services/firebase', () => ({ getFirebaseAuth: jest.fn() }));

import {
  FirebaseAuthRepository,
  type FirebaseAuthPort,
  type FirebaseAuthUser,
} from './firebase-auth-repository';

const firebaseUser: FirebaseAuthUser = {
  uid: 'firebase-user-123',
  displayName: 'Cô Minh',
};

function createPort(overrides: Partial<FirebaseAuthPort> = {}): FirebaseAuthPort {
  return {
    createUser: jest.fn(async () => firebaseUser),
    signIn: jest.fn(async () => firebaseUser),
    signOut: jest.fn(async () => undefined),
    observeAuthState: jest.fn(() => () => undefined),
    sendPasswordReset: jest.fn(async () => undefined),
    updateProfile: jest.fn(async () => undefined),
    validatePassword: jest.fn(async () => ({ isValid: true })),
    ...overrides,
  };
}

describe('FirebaseAuthRepository', () => {
  it('creates an account, validates the password policy, and maps a Firebase user safely', async () => {
    const port = createPort();
    const repository = new FirebaseAuthRepository(port);

    const user = await repository.register({
      displayName: 'Cô Minh',
      email: 'minh@example.com',
      password: 'matkhau123',
    });

    expect(port.validatePassword).toHaveBeenCalledWith('matkhau123');
    expect(port.createUser).toHaveBeenCalledWith('minh@example.com', 'matkhau123');
    expect(port.updateProfile).toHaveBeenCalledWith(firebaseUser, { displayName: 'Cô Minh' });
    expect(user).toEqual({
      id: 'firebase-user-123',
      displayName: 'Cô Minh',
      role: null,
      isAuthenticated: true,
    });
  });

  it('returns neutral feedback for an invalid sign-in credential', async () => {
    const repository = new FirebaseAuthRepository(
      createPort({
        signIn: jest.fn(async () => {
          throw { code: 'auth/invalid-credential' };
        }),
      }),
    );

    await expect(repository.signIn({ email: 'unknown@example.com', password: 'wrong' })).rejects.toThrow(
      'Email hoặc mật khẩu không đúng',
    );
  });

  it('signs in an existing Firebase user and maps the session identity', async () => {
    const port = createPort();
    const repository = new FirebaseAuthRepository(port);

    await expect(repository.signIn({ email: 'minh@example.com', password: 'matkhau123' })).resolves.toEqual({
      id: 'firebase-user-123',
      displayName: 'Cô Minh',
      role: null,
      isAuthenticated: true,
    });
    expect(port.signIn).toHaveBeenCalledWith('minh@example.com', 'matkhau123');
  });

  it('does not reveal account existence when registration is rejected', async () => {
    const repository = new FirebaseAuthRepository(
      createPort({
        createUser: jest.fn(async () => {
          throw { code: 'auth/email-already-in-use' };
        }),
      }),
    );

    await expect(
      repository.register({
        displayName: 'Cô Minh',
        email: 'minh@example.com',
        password: 'matkhau123',
      }),
    ).rejects.toThrow('Không thể tạo tài khoản với thông tin đã nhập');
  });

  it('does not expose whether an account exists during password reset', async () => {
    const port = createPort({
      sendPasswordReset: jest.fn(async () => {
        throw { code: 'auth/user-not-found' };
      }),
    });
    const repository = new FirebaseAuthRepository(port);

    await expect(repository.sendPasswordReset('unknown@example.com')).resolves.toBeUndefined();
  });

  it('maps auth observer state and supports sign-out', async () => {
    let listener: ((user: FirebaseAuthUser | null) => void) | undefined;
    const unsubscribe = jest.fn();
    const port = createPort({
      observeAuthState: jest.fn((onChange) => {
        listener = onChange;
        return unsubscribe;
      }),
    });
    const repository = new FirebaseAuthRepository(port);
    const onChange = jest.fn();

    expect(repository.observeAuthState(onChange)).toBe(unsubscribe);
    listener?.(firebaseUser);
    listener?.(null);
    await repository.signOut();

    expect(onChange).toHaveBeenNthCalledWith(1, {
      id: 'firebase-user-123',
      displayName: 'Cô Minh',
      role: null,
      isAuthenticated: true,
    });
    expect(onChange).toHaveBeenNthCalledWith(2, null);
    expect(port.signOut).toHaveBeenCalledTimes(1);
  });
});
