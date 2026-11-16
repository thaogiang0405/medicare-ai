import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';

import 'app/app.dart';
import 'app/firebase_initialization_failure_app.dart';
import 'firebase_options.dart';

/// Performs app-wide initialization before rendering the first screen.
///
/// Platform services are initialized here so presentation code does not own
/// Firebase setup. Other services (notifications, OCR, TTS) remain deferred to
/// their dedicated milestones.
Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    runApp(ProviderScope(child: const MediCareApp()));
  } catch (error, stackTrace) {
    FlutterError.reportError(
      FlutterErrorDetails(
        exception: error,
        stack: stackTrace,
        library: 'MediCare AI bootstrap',
        context: ErrorDescription('while initializing Firebase'),
      ),
    );
    runApp(FirebaseInitializationFailureApp(error: error));
  }
}
