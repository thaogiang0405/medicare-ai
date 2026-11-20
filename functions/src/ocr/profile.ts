import { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { UserProfileReader } from './contracts';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads only the canonical M2.3 user profile. This is deliberately separate
 * from client-provided roles; a caller can never nominate their own role.
 */
export class AdminUserProfileReader implements UserProfileReader {
  public constructor(private readonly firestore: Firestore) {}

  public async get(uid: string): Promise<unknown | undefined> {
    const snapshot = await this.firestore.collection('users').doc(uid).get();
    return snapshot.exists ? snapshot.data() : undefined;
  }
}

export function assertEligibleElderlyProfile(uid: string, profile: unknown): void {
  if (!isRecord(profile)) {
    throw new HttpsError('permission-denied', 'Tài khoản chưa hoàn tất hồ sơ người cao tuổi.');
  }

  const roles = profile.roles;
  const hasCanonicalRole =
    isRecord(roles) &&
    profile.uid === uid &&
    profile.primaryRole === 'elderly' &&
    roles.elderly === true &&
    roles.caregiver === false &&
    profile.onboardingCompleted === true;

  if (!hasCanonicalRole) {
    throw new HttpsError('permission-denied', 'Chức năng quét đơn thuốc chỉ dành cho người cao tuổi đã hoàn tất hồ sơ.');
  }
}
