import 'package:flutter/material.dart';

import '../../app/theme/accessibility_tokens.dart';

class AppPage extends StatelessWidget {
  const AppPage({
    super.key,
    required this.title,
    required this.child,
    this.actions = const [],
    this.showBackButton = true,
    this.floatingActionButton,
    this.scrollable = true,
  });

  final String title;
  final Widget child;
  final List<Widget> actions;
  final bool showBackButton;
  final Widget? floatingActionButton;
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: const EdgeInsets.all(AccessibilityTokens.pagePadding),
      child: child,
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        automaticallyImplyLeading: showBackButton,
        actions: actions,
      ),
      body: SafeArea(
        child: scrollable ? SingleChildScrollView(child: content) : content,
      ),
      floatingActionButton: floatingActionButton,
    );
  }
}
