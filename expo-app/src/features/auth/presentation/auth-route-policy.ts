import type { AuthStatus, ProfileStatus } from '@/store/session-store';
import type { UserRole } from '@/types/domain';

export type AppRoute = '/login' | '/role-selection' | '/elderly' | '/caregiver';

export type AuthRouteAccess = {
  showInitializationGate: boolean;
  showProfileError: boolean;
  allowUnauthenticatedRoutes: boolean;
  allowRoleSelection: boolean;
  allowElderlyDashboard: boolean;
  allowCaregiverDashboard: boolean;
  redirectTo: AppRoute;
};

/**
 * Pure route policy. Client guards are UX controls only; Firestore Rules remain
 * the authorization boundary for persisted data.
 */
export function getAuthRouteAccess(
  authStatus: AuthStatus,
  profileStatus: ProfileStatus,
  role: UserRole | null,
): AuthRouteAccess {
  const noPrivateRoutes: Pick<
    AuthRouteAccess,
    'allowRoleSelection' | 'allowElderlyDashboard' | 'allowCaregiverDashboard'
  > = {
    allowRoleSelection: false,
    allowElderlyDashboard: false,
    allowCaregiverDashboard: false,
  };

  if (authStatus === 'initializing') {
    return {
      showInitializationGate: true,
      showProfileError: false,
      allowUnauthenticatedRoutes: false,
      redirectTo: '/login',
      ...noPrivateRoutes,
    };
  }

  if (authStatus === 'unauthenticated') {
    return {
      showInitializationGate: false,
      showProfileError: false,
      allowUnauthenticatedRoutes: true,
      redirectTo: '/login',
      ...noPrivateRoutes,
    };
  }

  if (profileStatus === 'idle' || profileStatus === 'loading') {
    return {
      showInitializationGate: true,
      showProfileError: false,
      allowUnauthenticatedRoutes: false,
      redirectTo: '/role-selection',
      ...noPrivateRoutes,
    };
  }

  if (profileStatus === 'error' || profileStatus === 'disabled') {
    return {
      showInitializationGate: false,
      showProfileError: true,
      allowUnauthenticatedRoutes: false,
      redirectTo: '/role-selection',
      ...noPrivateRoutes,
    };
  }

  if (profileStatus === 'missing') {
    return {
      showInitializationGate: false,
      showProfileError: false,
      allowUnauthenticatedRoutes: false,
      allowRoleSelection: true,
      allowElderlyDashboard: false,
      allowCaregiverDashboard: false,
      redirectTo: '/role-selection',
    };
  }

  if (profileStatus === 'ready' && role === 'elderly') {
    return {
      showInitializationGate: false,
      showProfileError: false,
      allowUnauthenticatedRoutes: false,
      allowRoleSelection: false,
      allowElderlyDashboard: true,
      allowCaregiverDashboard: false,
      redirectTo: '/elderly',
    };
  }

  if (profileStatus === 'ready' && role === 'caregiver') {
    return {
      showInitializationGate: false,
      showProfileError: false,
      allowUnauthenticatedRoutes: false,
      allowRoleSelection: false,
      allowElderlyDashboard: false,
      allowCaregiverDashboard: true,
      redirectTo: '/caregiver',
    };
  }

  return {
    showInitializationGate: false,
    showProfileError: true,
    allowUnauthenticatedRoutes: false,
    redirectTo: '/role-selection',
    ...noPrivateRoutes,
  };
}
