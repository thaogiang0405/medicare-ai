import { getAuthRouteAccess } from './auth-route-policy';

describe('getAuthRouteAccess', () => {
  it('shows an initialization gate before Firebase restores auth state', () => {
    expect(getAuthRouteAccess('initializing')).toEqual({
      showInitializationGate: true,
      allowUnauthenticatedRoutes: false,
      allowAuthenticatedRoutes: false,
    });
  });

  it('keeps protected routes inaccessible when unauthenticated', () => {
    expect(getAuthRouteAccess('unauthenticated')).toEqual({
      showInitializationGate: false,
      allowUnauthenticatedRoutes: true,
      allowAuthenticatedRoutes: false,
    });
  });

  it('removes login/register access once an authenticated session exists', () => {
    expect(getAuthRouteAccess('authenticated')).toEqual({
      showInitializationGate: false,
      allowUnauthenticatedRoutes: false,
      allowAuthenticatedRoutes: true,
    });
  });
});
