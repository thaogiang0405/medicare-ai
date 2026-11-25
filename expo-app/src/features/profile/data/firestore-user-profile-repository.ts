import type { Auth } from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

import { getFirebaseAuth, getFirebaseFirestore } from '@/services/firebase';
import {
  userProfileLocale,
  userProfileTimeZone,
  type UserProfile,
  type UserProfileRoles,
  type UserRole,
} from '@/types/domain';

import type {
  UpdateOwnUserProfileInput,
  UserProfileRepository,
} from '../domain/user-profile-repository';
import {
  mapUserProfileError,
  UserProfileRepositoryError,
} from './user-profile-errors';

type FirebaseAuthProfileUser = {
  uid: string;
  displayName: string | null;
};

type TimestampLike = {
  toDate(): Date;
};

type InitialProfileWrite = {
  uid: string;
  displayName: string;
  primaryRole: UserRole;
  roles: UserProfileRoles;
  locale: typeof userProfileLocale;
  timeZone: typeof userProfileTimeZone;
  onboardingCompleted: true;
};

type SafeProfileUpdate = Partial<Pick<InitialProfileWrite, 'displayName' | 'locale' | 'timeZone'>>;

const minimumDisplayNameLength = 2;
const maximumDisplayNameLength = 120;

/**
 * Narrow port used by tests. Every operation receives a UID sourced from the
 * currently authenticated Firebase Auth user, never from a UI route param.
 */
export type FirestoreUserProfilePort = {
  getCurrentAuthUser(): FirebaseAuthProfileUser | null;
  getProfile(uid: string): Promise<unknown | null>;
  createProfileOnce(uid: string, profile: InitialProfileWrite): Promise<unknown>;
  updateProfile(uid: string, update: SafeProfileUpdate): Promise<unknown>;
};

function isUserRole(value: unknown): value is UserRole {
  return value === 'elderly' || value === 'caregiver';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new UserProfileRepositoryError(`Hồ sơ có trường ${field} không hợp lệ.`);
  }

  return value.trim();
}

function readTimestamp(value: unknown, field: string): Date {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value;
  }

  if (
    typeof value === 'object'
    && value !== null
    && 'toDate' in value
    && typeof value.toDate === 'function'
  ) {
    const parsed = (value as TimestampLike).toDate();

    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }

  throw new UserProfileRepositoryError(`Hồ sơ có timestamp ${field} không hợp lệ.`);
}

function createRoles(primaryRole: UserRole): UserProfileRoles {
  return {
    elderly: primaryRole === 'elderly',
    caregiver: primaryRole === 'caregiver',
  };
}

function mapRoles(value: unknown, primaryRole: UserRole): UserProfileRoles {
  if (!isRecord(value) || typeof value.elderly !== 'boolean' || typeof value.caregiver !== 'boolean') {
    throw new UserProfileRepositoryError('Hồ sơ có trường roles không hợp lệ.');
  }

  const expected = createRoles(primaryRole);

  if (value.elderly !== expected.elderly || value.caregiver !== expected.caregiver) {
    throw new UserProfileRepositoryError('Vai trò trong hồ sơ không nhất quán.');
  }

  return expected;
}

/** Maps untrusted Firestore data to the portable domain model. */
export function mapUserProfileDocument(data: unknown): UserProfile {
  if (!isRecord(data)) {
    throw new UserProfileRepositoryError('Không tìm thấy dữ liệu hồ sơ hợp lệ.');
  }

  const uid = readRequiredString(data.uid, 'uid');
  const displayName = readRequiredString(data.displayName, 'displayName');

  if (!isUserRole(data.primaryRole)) {
    throw new UserProfileRepositoryError('Hồ sơ có primaryRole không hợp lệ.');
  }

  if (data.locale !== userProfileLocale || data.timeZone !== userProfileTimeZone) {
    throw new UserProfileRepositoryError('Hồ sơ có cài đặt ngôn ngữ hoặc múi giờ không hợp lệ.');
  }

  if (data.onboardingCompleted !== true) {
    throw new UserProfileRepositoryError('Hồ sơ chưa hoàn tất onboarding hợp lệ.');
  }

  return {
    uid,
    displayName,
    primaryRole: data.primaryRole,
    roles: mapRoles(data.roles, data.primaryRole),
    locale: userProfileLocale,
    timeZone: userProfileTimeZone,
    onboardingCompleted: true,
    createdAt: readTimestamp(data.createdAt, 'createdAt'),
    updatedAt: readTimestamp(data.updatedAt, 'updatedAt'),
  };
}

function mapOwnProfileDocument(data: unknown, expectedUid: string): UserProfile {
  const profile = mapUserProfileDocument(data);

  if (profile.uid !== expectedUid) {
    throw new UserProfileRepositoryError('Hồ sơ không khớp với phiên đăng nhập hiện tại.');
  }

  return profile;
}

function requireCurrentUser(port: FirestoreUserProfilePort): FirebaseAuthProfileUser {
  const user = port.getCurrentAuthUser();

  if (!user?.uid) {
    throw new UserProfileRepositoryError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  return user;
}

function normalizeDisplayName(displayName: string | null | undefined): string {
  const normalized = displayName?.trim();

  return normalized
    && normalized.length >= minimumDisplayNameLength
    && normalized.length <= maximumDisplayNameLength
    ? normalized
    : 'Người dùng MediCare';
}

function normalizeUpdate(input: UpdateOwnUserProfileInput): SafeProfileUpdate {
  const update: SafeProfileUpdate = {};

  if (input.displayName !== undefined) {
    const displayName = input.displayName.trim();

    if (
      displayName.length < minimumDisplayNameLength
      || displayName.length > maximumDisplayNameLength
    ) {
      throw new UserProfileRepositoryError('Tên hiển thị cần có từ 2 đến 120 ký tự.');
    }

    update.displayName = displayName;
  }

  if (input.locale !== undefined) {
    if (input.locale !== userProfileLocale) {
      throw new UserProfileRepositoryError('Ngôn ngữ hồ sơ không được hỗ trợ.');
    }

    update.locale = userProfileLocale;
  }

  if (input.timeZone !== undefined) {
    if (input.timeZone !== userProfileTimeZone) {
      throw new UserProfileRepositoryError('Múi giờ hồ sơ không được hỗ trợ.');
    }

    update.timeZone = userProfileTimeZone;
  }

  return update;
}

function createFirestoreUserProfilePort(
  auth: Auth = getFirebaseAuth(),
  firestore: Firestore = getFirebaseFirestore(),
): FirestoreUserProfilePort {
  const getReference = (uid: string) => doc(firestore, 'users', uid);

  return {
    getCurrentAuthUser: () => {
      const currentUser = auth.currentUser;

      return currentUser
        ? { uid: currentUser.uid, displayName: currentUser.displayName }
        : null;
    },
    async getProfile(uid) {
      const snapshot = await getDoc(getReference(uid));
      return snapshot.exists() ? snapshot.data() : null;
    },
    async createProfileOnce(uid, profile) {
      const reference = getReference(uid);

      await runTransaction(firestore, async (transaction) => {
        const existing = await transaction.get(reference);

        if (!existing.exists()) {
          transaction.set(reference, {
            ...profile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });

      const persisted = await getDoc(reference);

      if (!persisted.exists()) {
        throw new UserProfileRepositoryError('Không thể xác nhận hồ sơ vừa tạo.');
      }

      return persisted.data();
    },
    async updateProfile(uid, update) {
      const reference = getReference(uid);

      if (Object.keys(update).length > 0) {
        await updateDoc(reference, {
          ...update,
          updatedAt: serverTimestamp(),
        });
      }

      const persisted = await getDoc(reference);

      if (!persisted.exists()) {
        throw new UserProfileRepositoryError('Không tìm thấy hồ sơ để cập nhật.');
      }

      return persisted.data();
    },
  };
}

/**
 * Firebase implementation for the `/users/{auth.uid}` profile boundary.
 * It never accepts a caller-provided UID and never exposes a role mutation API.
 */
export class FirestoreUserProfileRepository implements UserProfileRepository {
  constructor(
    private readonly profilePort: FirestoreUserProfilePort = createFirestoreUserProfilePort(),
  ) {}

  async getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
      const user = requireCurrentUser(this.profilePort);
      const data = await this.profilePort.getProfile(user.uid);
      return data ? mapOwnProfileDocument(data, user.uid) : null;
    } catch (error) {
      throw mapUserProfileError(error);
    }
  }

  async createInitialProfile(primaryRole: UserRole): Promise<UserProfile> {
    if (!isUserRole(primaryRole)) {
      throw new UserProfileRepositoryError('Vai trò khởi tạo không hợp lệ.');
    }

    try {
      const user = requireCurrentUser(this.profilePort);
      const data = await this.profilePort.createProfileOnce(user.uid, {
        uid: user.uid,
        displayName: normalizeDisplayName(user.displayName),
        primaryRole,
        roles: createRoles(primaryRole),
        locale: userProfileLocale,
        timeZone: userProfileTimeZone,
        onboardingCompleted: true,
      });

      return mapOwnProfileDocument(data, user.uid);
    } catch (error) {
      throw mapUserProfileError(error);
    }
  }

  async updateOwnProfile(input: UpdateOwnUserProfileInput): Promise<UserProfile> {
    try {
      const user = requireCurrentUser(this.profilePort);
      const data = await this.profilePort.updateProfile(user.uid, normalizeUpdate(input));
      return mapOwnProfileDocument(data, user.uid);
    } catch (error) {
      throw mapUserProfileError(error);
    }
  }
}

let firestoreUserProfileRepository: FirestoreUserProfileRepository | null = null;

export function getFirestoreUserProfileRepository(): FirestoreUserProfileRepository {
  firestoreUserProfileRepository ??= new FirestoreUserProfileRepository();
  return firestoreUserProfileRepository;
}
