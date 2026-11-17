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
  const routeAccess = getAuthRouteAccess(authStatus);

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
            <Stack.Protected guard={routeAccess.allowUnauthenticatedRoutes} redirectTo="/role-selection">
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
            </Stack.Protected>
            <Stack.Protected guard={routeAccess.allowAuthenticatedRoutes} redirectTo="/login">
              <Stack.Screen name="role-selection" />
              <Stack.Screen name="elderly" />
              <Stack.Screen name="caregiver" />
            </Stack.Protected>
          </Stack>
        </AuthInitializationGate>
      </FirebaseInitializationGate>
    </>
  );
}
