import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'theme/app_theme.dart';

/// Development-safe failure state used when the official Firebase
/// configuration cannot be initialized. The app never falls back to mock
/// services silently in this condition.
class FirebaseInitializationFailureApp extends StatelessWidget {
  const FirebaseInitializationFailureApp({super.key, required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MediCare AI – Firebase setup required',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: Scaffold(
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(Icons.cloud_off_outlined, size: 64),
                    const SizedBox(height: 24),
                    Text(
                      'Không thể khởi tạo Firebase',
                      style: Theme.of(context).textTheme.headlineSmall,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Kiểm tra kết nối mạng, cấu hình Firebase Android và file firebase_options.dart rồi khởi động lại ứng dụng.',
                      textAlign: TextAlign.center,
                    ),
                    if (kDebugMode) ...[
                      const SizedBox(height: 20),
                      SelectableText(
                        'Loại lỗi (development): ${error.runtimeType}',
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
