/**
 * M2.3 Firestore Rules are deployed, but profile access remains an explicit
 * local opt-in while the project owner controls profile testing. Expo public
 * variables are bundled into the app, so this flag is not authorization and
 * must never contain a secret.
 */
export function isFirestoreUserProfilesFeatureEnabled(value = process.env.EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export const firestoreUserProfilesUnavailableMessage =
  'Hồ sơ vai trò chưa được bật trên ứng dụng này. Vui lòng liên hệ chủ dự án.';
