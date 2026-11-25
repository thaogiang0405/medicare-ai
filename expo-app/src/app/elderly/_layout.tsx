import { Stack } from 'expo-router';

import { getAuthRouteAccess } from '@/features/auth/presentation/auth-route-policy';
import { useSessionStore } from '@/store';

/**
 * Defence in depth for direct elderly URLs. The root layout has the same role
 * gate; this nested guard keeps medication management unavailable to caregivers.
 */
export default function ElderlyLayout() {
  const authStatus = useSessionStore((state) => state.authStatus);
  const profileStatus = useSessionStore((state) => state.profileStatus);
  const role = useSessionStore((state) => state.user?.role ?? null);
  const routeAccess = getAuthRouteAccess(authStatus, profileStatus, role);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={routeAccess.allowElderlyDashboard} redirectTo={routeAccess.redirectTo}>
        <Stack.Screen name="index" />
        <Stack.Screen name="medications" />
        <Stack.Screen name="prescription-ocr" />
        <Stack.Screen name="medication-package" />
        <Stack.Screen name="dose-history" />
        <Stack.Screen name="reminder-settings" />
      </Stack.Protected>
    </Stack>
  );
}
