import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';

/// Performs app-wide initialization before rendering the first screen.
///
/// Firebase, local notifications, OCR and text-to-speech are intentionally
/// registered behind services in later milestones. Keeping their initialization
/// here prevents presentation code from owning platform setup.
void bootstrap() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(ProviderScope(child: const MediCareApp()));
}
