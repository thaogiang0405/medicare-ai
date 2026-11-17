import type { AuthStatus } from '@/store/session-store';

export type AuthRouteAccess = {
  showInitializationGate: boolean;
  allowUnauthenticatedRoutes: boolean;
  allowAuthenticatedRoutes: boolean;
};

/** Pure policy used by the root navigator and unit tests. */
export function getAuthRouteAccess(authStatus: AuthStatus): AuthRouteAccess {
  if (authStatus === 'initializing') {
    return {
      showInitializationGate: true,
      allowUnauthenticatedRoutes: false,
      allowAuthenticatedRoutes: false,
    };
  }

  if (authStatus === 'authenticated') {
    return {
      showInitializationGate: false,
      allowUnauthenticatedRoutes: false,
      allowAuthenticatedRoutes: true,
    };
  }

  return {
    showInitializationGate: false,
    allowUnauthenticatedRoutes: true,
    allowAuthenticatedRoutes: false,
  };
}
