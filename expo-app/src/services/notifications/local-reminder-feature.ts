/**
 * Local device reminders are off by default. This Expo public flag is only a
 * rollout switch; permission and per-user consent are still required.
 */
export function isLocalRemindersFeatureEnabled(
  value = process.env.EXPO_PUBLIC_LOCAL_REMINDERS_ENABLED,
): boolean {
  return value?.trim().toLowerCase() === 'true';
}
