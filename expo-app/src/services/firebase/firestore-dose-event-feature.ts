/**
 * Dose tracking remains an explicit local opt-in until M3.4 Rules receive a
 * separately approved deployment. This public Expo variable routes data only;
 * it is never authorization and must not contain a secret.
 */
export function isFirestoreDoseEventsFeatureEnabled(
  value = process.env.EXPO_PUBLIC_FIRESTORE_DOSE_EVENTS_ENABLED,
): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export const firestoreDoseEventsUnavailableMessage =
  'Ghi nhận uống thuốc trên Firebase chưa được bật trên ứng dụng này. Vui lòng liên hệ chủ dự án.';
