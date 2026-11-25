/**
 * Schedule persistence is opt-in until the separately reviewed M3.3 Rules are
 * deployed. Expo public variables are bundled into the client and therefore
 * route data only; they never grant authorization.
 */
export function isFirestoreSchedulesFeatureEnabled(
  value = process.env.EXPO_PUBLIC_FIRESTORE_SCHEDULES_ENABLED,
): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export const firestoreSchedulesUnavailableMessage =
  'Lưu lịch uống thuốc trên Firebase chưa được bật trên ứng dụng này. Vui lòng liên hệ chủ dự án.';
