import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/mock_auth_repository.dart';
import '../../domain/entities/app_user.dart';
import '../../domain/entities/user_role.dart';

/// Temporary in-memory session used until Firebase Authentication is configured.
/// Its public API is deliberately shaped like an auth repository boundary so the
/// data source can be replaced without changing screens.
final demoSessionProvider = NotifierProvider<DemoSessionController, AppUser>(
  DemoSessionController.new,
);

class DemoSessionController extends Notifier<AppUser> {
  @override
  AppUser build() => ref.read(authRepositoryProvider).currentUser;

  Future<void> continueAs(UserRole role) async {
    state = await ref.read(authRepositoryProvider).signInForDemo(role);
  }

  Future<void> signOut() async {
    final repository = ref.read(authRepositoryProvider);
    await repository.signOut();
    state = repository.currentUser;
  }
}
