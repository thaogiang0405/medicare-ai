/** Local opt-in only. Firebase Security Rules decide authorization. */
export function isFamilyCareFeatureEnabled(
  value = process.env.EXPO_PUBLIC_FAMILY_CARE_ENABLED,
): boolean {
  return value?.trim().toLowerCase() === 'true';
}
