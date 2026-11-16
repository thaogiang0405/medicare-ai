import '../entities/app_user.dart';
import '../entities/user_role.dart';

/// Authentication boundary used by the presentation layer.
///
/// The Phase 1 implementation is in-memory. FirebaseAuthRepository will
/// implement this same contract once Firebase has been configured explicitly.
abstract interface class AuthRepository {
  AppUser get currentUser;

  Future<AppUser> signInForDemo(UserRole role);

  Future<void> signOut();
}
