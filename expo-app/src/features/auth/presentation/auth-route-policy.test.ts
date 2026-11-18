import { getAuthRouteAccess } from './auth-route-policy';

describe('getAuthRouteAccess', () => {
  it('holds every route behind an initialization gate until Firebase Auth resolves', () => {
    expect(getAuthRouteAccess('initializing', 'idle', null)).toMatchObject({
      showInitializationGate: true,
      allowUnauthenticatedRoutes: false,
      allowRoleSelection: false,
      allowElderlyDashboard: false,
      allowCaregiverDashboard: false,
    });
  });

  it('keeps every private route inaccessible when unauthenticated', () => {
    expect(getAuthRouteAccess('unauthenticated', 'idle', null)).toMatchObject({
      showInitializationGate: false,
      allowUnauthenticatedRoutes: true,
      allowRoleSelection: false,
      allowElderlyDashboard: false,
      allowCaregiverDashboard: false,
    });
  });

  it('waits for a profile before exposing an authenticated route', () => {
    expect(getAuthRouteAccess('authenticated', 'loading', null)).toMatchObject({
      showInitializationGate: true,
      allowUnauthenticatedRoutes: false,
      allowRoleSelection: false,
      allowElderlyDashboard: false,
      allowCaregiverDashboard: false,
    });
  });

  it('allows only role onboarding for an authenticated user without a profile', () => {
    expect(getAuthRouteAccess('authenticated', 'missing', null)).toMatchObject({
      allowRoleSelection: true,
      allowElderlyDashboard: false,
      allowCaregiverDashboard: false,
      redirectTo: '/role-selection',
    });
  });

  it('allows only the elderly dashboard for an elderly profile', () => {
    expect(getAuthRouteAccess('authenticated', 'ready', 'elderly')).toMatchObject({
      allowRoleSelection: false,
      allowElderlyDashboard: true,
      allowCaregiverDashboard: false,
      redirectTo: '/elderly',
    });
  });

  it('allows only the caregiver dashboard for a caregiver profile', () => {
    expect(getAuthRouteAccess('authenticated', 'ready', 'caregiver')).toMatchObject({
      allowRoleSelection: false,
      allowElderlyDashboard: false,
      allowCaregiverDashboard: true,
      redirectTo: '/caregiver',
    });
  });

  it('surfaces a profile error without opening a dashboard', () => {
    expect(getAuthRouteAccess('authenticated', 'error', null)).toMatchObject({
      showProfileError: true,
      allowRoleSelection: false,
      allowElderlyDashboard: false,
      allowCaregiverDashboard: false,
    });
  });
});
