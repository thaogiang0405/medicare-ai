abstract final class AppRoutes {
  static const splash = '/';
  static const onboarding = '/onboarding';
  static const login = '/login';
  static const register = '/register';
  static const roleSelection = '/role-selection';
  static const elderlyHome = '/elderly';
  static const caregiverHome = '/caregiver';
  static const todaySchedule = '/schedule/today';
  static const medicationList = '/medications';
  static const addMedication = '/medications/add';
  static const medicationHistory = '/medications/history';
  static const prescriptionScanner = '/prescription/review';
  static const familyConnection = '/family-connection';
  static const profile = '/profile';
  static const settings = '/settings';
  static const elderlyProfiles = '/caregiver/profiles';
  static const caregiverMonitoring = '/caregiver/monitoring';

  static String medicationDetail(String medicationId) =>
      '/medications/$medicationId';
}
