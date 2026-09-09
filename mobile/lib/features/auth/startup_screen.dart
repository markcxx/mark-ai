import 'package:flutter/material.dart';

import '../../shared/widgets/common.dart';
import '../chat/application/workspace_controller.dart';

class StartupScreen extends StatelessWidget {
  final WorkspaceController controller;
  const StartupScreen({super.key, required this.controller});

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Brand(size: 48),
              if (controller.startupFailed) ...[
                const SizedBox(height: 24),
                const Text('暂时无法连接，请检查网络后重试。'),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => controller.start(),
                  child: const Text('重试'),
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}
