import type { UserProfile, UserRole } from '@/types/domain';

/**
 * Deliberately excludes uid, roles, primaryRole and timestamps. Those values
 * are identity/authorization data and cannot be changed through the client.
 */
export type UpdateOwnUserProfileInput = {
  displayName?: string;
  locale?: 'vi';
  timeZone?: 'Asia/Ho_Chi_Minh';
};

export interface UserProfileRepository {
  getCurrentUserProfile(): Promise<UserProfile | null>;
  createInitialProfile(primaryRole: UserRole): Promise<UserProfile>;
  updateOwnProfile(input: UpdateOwnUserProfileInput): Promise<UserProfile>;
}
