import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthInitializationGate } from '@/features/app/presentation/AuthInitializationGate';
import { FirebaseInitializationGate } from '@/features/app/presentation/FirebaseInitializationGate';
import { getAuthRouteAccess } from '@/features/auth/presentation/auth-route-policy';
import { useSessionStore } from '@/store';

/**
 * Migration 1 keeps navigation intentionally shallow. Routes are grouped by
 * feature in the filesystem, while the Stack keeps the first-use flow simple.
 */
export default function RootLayout() {
  const authStatus = useSessionStore((state) => state.authStatus);
  const profileStatus = useSessionStore((state) => state.profileStatus);
  const user = useSessionStore((state) => state.user);
  const routeAccess = getAuthRouteAccess(authStatus, profileStatus, user?.role ?? null);

  return (
    <>
      <StatusBar style="dark" />
      <FirebaseInitializationGate>
        <AuthInitializationGate>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: '#FAFDFC' },
            }}>
            <Stack.Protected guard={routeAccess.allowUnauthenticatedRoutes} redirectTo={routeAccess.redirectTo}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
            </Stack.Protected>
            <Stack.Protected guard={routeAccess.allowRoleSelection} redirectTo={routeAccess.redirectTo}>
              <Stack.Screen name="role-selection" />
            </Stack.Protected>
            <Stack.Protected guard={routeAccess.allowElderlyDashboard} redirectTo={routeAccess.redirectTo}>
              <Stack.Screen name="elderly" />
            </Stack.Protected>
            <Stack.Protected guard={routeAccess.allowCaregiverDashboard} redirectTo={routeAccess.redirectTo}>
              <Stack.Screen name="caregiver" />
            </Stack.Protected>
          </Stack>
        </AuthInitializationGate>
      </FirebaseInitializationGate>
    </>
  );
}
