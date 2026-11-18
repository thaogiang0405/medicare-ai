/**
 * Medication records stay behind an explicit local opt-in while the M3.2
 * Security Rules await a separately approved deployment. Expo public variables
 * are bundled into the app; this is routing only, never authorization.
 */
export function isFirestoreMedicationsFeatureEnabled(
  value = process.env.EXPO_PUBLIC_FIRESTORE_MEDICATIONS_ENABLED,
): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export const firestoreMedicationsUnavailableMessage =
  'Lưu thuốc trên Firebase chưa được bật trên ứng dụng này. Vui lòng liên hệ chủ dự án.';
