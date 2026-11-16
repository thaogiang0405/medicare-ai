import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'app_routes.dart';

import 'package:medicare_ai/features/auth/presentation/pages/login_page.dart';
import 'package:medicare_ai/features/auth/presentation/pages/register_page.dart';
import 'package:medicare_ai/features/auth/presentation/pages/role_selection_page.dart';
import 'package:medicare_ai/features/caregiver_monitoring/presentation/pages/caregiver_dashboard_page.dart';
import 'package:medicare_ai/features/caregiver_monitoring/presentation/pages/elderly_profile_list_page.dart';
import 'package:medicare_ai/features/caregiver_monitoring/presentation/pages/monitoring_page.dart';
import 'package:medicare_ai/features/elderly_home/presentation/pages/elderly_home_page.dart';
import 'package:medicare_ai/features/family_connection/presentation/pages/family_connection_page.dart';
import 'package:medicare_ai/features/medication/presentation/pages/add_medication_page.dart';
import 'package:medicare_ai/features/medication/presentation/pages/medication_detail_page.dart';
import 'package:medicare_ai/features/medication/presentation/pages/medication_history_page.dart';
import 'package:medicare_ai/features/medication/presentation/pages/medication_list_page.dart';
import 'package:medicare_ai/features/onboarding/presentation/pages/onboarding_page.dart';
import 'package:medicare_ai/features/onboarding/presentation/pages/splash_page.dart';
import 'package:medicare_ai/features/prescription_scanner/presentation/pages/prescription_review_page.dart';
import 'package:medicare_ai/features/profile/presentation/pages/profile_page.dart';
import 'package:medicare_ai/features/schedule/presentation/pages/today_schedule_page.dart';
import 'package:medicare_ai/features/settings/presentation/pages/settings_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: AppRoutes.splash,
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashPage(),
      ),
      GoRoute(
        path: AppRoutes.onboarding,
        builder: (context, state) => const OnboardingPage(),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: AppRoutes.register,
        builder: (context, state) => const RegisterPage(),
      ),
      GoRoute(
        path: AppRoutes.roleSelection,
        builder: (context, state) => const RoleSelectionPage(),
      ),
      GoRoute(
        path: AppRoutes.elderlyHome,
        builder: (context, state) => const ElderlyHomePage(),
      ),
      GoRoute(
        path: AppRoutes.caregiverHome,
        builder: (context, state) => const CaregiverDashboardPage(),
      ),
      GoRoute(
        path: AppRoutes.todaySchedule,
        builder: (context, state) => const TodaySchedulePage(),
      ),
      GoRoute(
        path: AppRoutes.addMedication,
        builder: (context, state) => const AddMedicationPage(),
      ),
      GoRoute(
        path: AppRoutes.medicationHistory,
        builder: (context, state) => const MedicationHistoryPage(),
      ),
      GoRoute(
        path: AppRoutes.medicationList,
        builder: (context, state) => const MedicationListPage(),
      ),
      GoRoute(
        path: '/medications/:medicationId',
        builder: (context, state) => MedicationDetailPage(
          medicationId: state.pathParameters['medicationId']!,
        ),
      ),
      GoRoute(
        path: AppRoutes.prescriptionScanner,
        builder: (context, state) => const PrescriptionReviewPage(),
      ),
      GoRoute(
        path: AppRoutes.familyConnection,
        builder: (context, state) => const FamilyConnectionPage(),
      ),
      GoRoute(
        path: AppRoutes.profile,
        builder: (context, state) => const ProfilePage(),
      ),
      GoRoute(
        path: AppRoutes.settings,
        builder: (context, state) => const SettingsPage(),
      ),
      GoRoute(
        path: AppRoutes.elderlyProfiles,
        builder: (context, state) => const ElderlyProfileListPage(),
      ),
      GoRoute(
        path: AppRoutes.caregiverMonitoring,
        builder: (context, state) => const MonitoringPage(),
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
