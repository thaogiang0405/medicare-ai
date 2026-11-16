import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/app_user.dart';
import '../../domain/entities/user_role.dart';
import '../../domain/repositories/auth_repository.dart';

/// Deliberately local-only authentication for the Phase 1 UI foundation.
///
/// It has no credentials, network calls, persistence or Firebase configuration.
/// Replace the provider's implementation after `flutterfire configure` and
/// Firebase Auth setup, without changing pages or controllers.
class MockAuthRepository implements AuthRepository {
  AppUser _currentUser = const AppUser.signedOut();

  @override
  AppUser get currentUser => _currentUser;

  @override
  Future<AppUser> signInForDemo(UserRole role) async {
    _currentUser = AppUser(
      id: 'demo-${role.name}',
      displayName: role == UserRole.elderly ? 'Cô Minh' : 'Anh Nam',
      role: role,
      isAuthenticated: true,
    );
    return _currentUser;
  }

  @override
  Future<void> signOut() async {
    _currentUser = const AppUser.signedOut();
  }
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => MockAuthRepository(),
);
