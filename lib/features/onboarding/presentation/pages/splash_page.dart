import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:medicare_ai/app/router/app_routes.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    unawaited(_openOnboarding());
  }

  Future<void> _openOnboarding() async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (mounted) {
      context.go(AppRoutes.onboarding);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      body: Center(
        child: Semantics(
          label: 'MediCare AI đang khởi động',
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.health_and_safety_outlined,
                size: 84,
                color: colors.primary,
              ),
              const SizedBox(height: 20),
              Text(
                'MediCare AI',
                style: Theme.of(context).textTheme.displaySmall,
              ),
              const SizedBox(height: 8),
              const Text('Trợ lý quản lý thuốc và chăm sóc người cao tuổi'),
              const SizedBox(height: 28),
              const CircularProgressIndicator(),
            ],
          ),
        ),
      ),
    );
  }
}
