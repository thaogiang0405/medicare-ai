/* eslint-disable import/first */

jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('@/services/firebase', () => ({
  getFirebaseAuth: jest.fn(),
  getFirebaseFirestore: jest.fn(),
}));

import type { UserProfile, UserRole } from '@/types/domain';

import {
  FirestoreUserProfileRepository,
  mapUserProfileDocument,
  type FirestoreUserProfilePort,
} from './firestore-user-profile-repository';

const createdAt = new Date('2026-11-17T00:00:00.000Z');
const updatedAt = new Date('2026-11-17T00:01:00.000Z');

function createDocument(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    uid: 'user-a',
    displayName: 'Nguyễn An',
    primaryRole: 'elderly',
    roles: { elderly: true, caregiver: false },
    locale: 'vi',
    timeZone: 'Asia/Ho_Chi_Minh',
    onboardingCompleted: true,
    createdAt: { toDate: () => createdAt },
    updatedAt: { toDate: () => updatedAt },
    ...overrides,
  };
}

function createPort(
  overrides: Partial<FirestoreUserProfilePort> = {},
): FirestoreUserProfilePort {
  return {
    getCurrentAuthUser: jest.fn(() => ({ uid: 'user-a', displayName: 'Nguyễn An' })),
    getProfile: jest.fn(async () => createDocument()),
    createProfileOnce: jest.fn(async (_uid, profile) =>
      createDocument({
        uid: profile.uid,
        displayName: profile.displayName,
        primaryRole: profile.primaryRole,
        roles: profile.roles,
      }),
    ),
    updateProfile: jest.fn(async (_uid, update) => createDocument(update)),
    ...overrides,
  };
}

describe('FirestoreUserProfileRepository', () => {
  it('reads and maps only the currently authenticated user profile', async () => {
    const port = createPort();
    const repository = new FirestoreUserProfileRepository(port);

    await expect(repository.getCurrentUserProfile()).resolves.toEqual<UserProfile>({
      uid: 'user-a',
      displayName: 'Nguyễn An',
      primaryRole: 'elderly',
      roles: { elderly: true, caregiver: false },
      locale: 'vi',
      timeZone: 'Asia/Ho_Chi_Minh',
      onboardingCompleted: true,
      createdAt,
      updatedAt,
    });
    expect(port.getProfile).toHaveBeenCalledWith('user-a');
  });

  it('returns missing distinctly instead of inventing a profile or role', async () => {
    const repository = new FirestoreUserProfileRepository(
      createPort({ getProfile: jest.fn(async () => null) }),
    );

    await expect(repository.getCurrentUserProfile()).resolves.toBeNull();
  });

  it('rejects a document whose uid does not match the authenticated identity', async () => {
    const repository = new FirestoreUserProfileRepository(
      createPort({ getProfile: jest.fn(async () => createDocument({ uid: 'user-b' })) }),
    );

    await expect(repository.getCurrentUserProfile()).rejects.toThrow('không khớp với phiên đăng nhập');
  });

  it('creates the exact initial schema from the current Firebase Auth identity', async () => {
    const port = createPort({
      getCurrentAuthUser: jest.fn(() => ({ uid: 'auth-user-42', displayName: 'Cô Mai' })),
    });
    const repository = new FirestoreUserProfileRepository(port);

    await expect(repository.createInitialProfile('caregiver')).resolves.toMatchObject({
      uid: 'auth-user-42',
      displayName: 'Cô Mai',
      primaryRole: 'caregiver',
      roles: { elderly: false, caregiver: true },
    });
    expect(port.createProfileOnce).toHaveBeenCalledWith('auth-user-42', {
      uid: 'auth-user-42',
      displayName: 'Cô Mai',
      primaryRole: 'caregiver',
      roles: { elderly: false, caregiver: true },
      locale: 'vi',
      timeZone: 'Asia/Ho_Chi_Minh',
      onboardingCompleted: true,
    });
  });

  it('uses a safe default name when a legacy Auth display name violates the Rules length', async () => {
    const port = createPort({
      getCurrentAuthUser: jest.fn(() => ({ uid: 'auth-user-42', displayName: 'A' })),
    });
    const repository = new FirestoreUserProfileRepository(port);

    await repository.createInitialProfile('elderly');

    expect(port.createProfileOnce).toHaveBeenCalledWith(
      'auth-user-42',
      expect.objectContaining({ displayName: 'Người dùng MediCare' }),
    );
  });

  it('keeps an existing concurrent profile instead of overwriting its role', async () => {
    const existing = createDocument({
      primaryRole: 'caregiver',
      roles: { elderly: false, caregiver: true },
    });
    const port = createPort({ createProfileOnce: jest.fn(async () => existing) });
    const repository = new FirestoreUserProfileRepository(port);

    await expect(repository.createInitialProfile('elderly')).resolves.toMatchObject({
      primaryRole: 'caregiver',
      roles: { elderly: false, caregiver: true },
    });
    expect(port.createProfileOnce).toHaveBeenCalledTimes(1);
  });

  it('updates only non-authority fields on the current user profile', async () => {
    const port = createPort();
    const repository = new FirestoreUserProfileRepository(port);

    await repository.updateOwnProfile({ displayName: 'Cô An' });

    expect(port.updateProfile).toHaveBeenCalledWith('user-a', { displayName: 'Cô An' });
  });

  it('rejects a display name that the Rules would reject before issuing an update', async () => {
    const port = createPort();
    const repository = new FirestoreUserProfileRepository(port);

    await expect(repository.updateOwnProfile({ displayName: 'A' })).rejects.toThrow('từ 2 đến 120 ký tự');
    await expect(repository.updateOwnProfile({ displayName: 'a'.repeat(121) })).rejects.toThrow(
      'từ 2 đến 120 ký tự',
    );
    expect(port.updateProfile).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated and malformed profile states with safe feedback', async () => {
    const missingAuthRepository = new FirestoreUserProfileRepository(
      createPort({ getCurrentAuthUser: jest.fn(() => null) }),
    );
    const malformedRepository = new FirestoreUserProfileRepository(
      createPort({ getProfile: jest.fn(async () => createDocument({ roles: { elderly: true, caregiver: true } })) }),
    );

    await expect(missingAuthRepository.getCurrentUserProfile()).rejects.toThrow('Phiên đăng nhập đã hết hạn');
    await expect(malformedRepository.getCurrentUserProfile()).rejects.toThrow('Vai trò trong hồ sơ không nhất quán');
  });

  it('maps Firestore permission failures without leaking data', async () => {
    const repository = new FirestoreUserProfileRepository(
      createPort({
        getProfile: jest.fn(async () => {
          throw { code: 'permission-denied' };
        }),
      }),
    );

    await expect(repository.getCurrentUserProfile()).rejects.toThrow('Không có quyền truy cập hồ sơ');
  });
});

describe('mapUserProfileDocument', () => {
  it('requires exactly one role matching the profile primary role', () => {
    expect(() => mapUserProfileDocument(createDocument({ primaryRole: 'invalid' as UserRole }))).toThrow(
      'primaryRole không hợp lệ',
    );
  });
});
