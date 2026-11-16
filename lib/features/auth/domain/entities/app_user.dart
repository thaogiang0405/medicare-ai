import 'user_role.dart';

class AppUser {
  const AppUser({
    required this.id,
    required this.displayName,
    this.role,
    required this.isAuthenticated,
  });

  const AppUser.signedOut()
    : id = '',
      displayName = '',
      role = null,
      isAuthenticated = false;

  final String id;
  final String displayName;
  final UserRole? role;
  final bool isAuthenticated;
}
