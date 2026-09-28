import 'dart:async';

import 'package:flutter/material.dart';

import '../../shared/widgets/common.dart';
import '../chat/application/workspace_controller.dart';

/// Startup never delays a ready workspace for an animation.
class StartupScreen extends StatefulWidget {
  final WorkspaceController controller;
  final VoidCallback? onIntroComplete;
  const StartupScreen({
    super.key,
    required this.controller,
    this.onIntroComplete,
  });

  @override
  State<StartupScreen> createState() => _StartupScreenState();
}

class _StartupScreenState extends State<StartupScreen> {
  Timer? loadingHintTimer;
  bool showLoadingHint = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onIntroComplete?.call();
    });
    loadingHintTimer = Timer(const Duration(seconds: 1), () {
      if (mounted) setState(() => showLoadingHint = true);
    });
  }

  @override
  void dispose() {
    loadingHintTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final muted = dark ? const Color(0xff9ca3af) : const Color(0xff6b7280);
    return Scaffold(
      backgroundColor: dark ? const Color(0xff111214) : Colors.white,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, box) => SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: box.maxHeight,
                minWidth: box.maxWidth,
              ),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: 1),
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 200),
                      builder: (context, opacity, child) =>
                          Opacity(opacity: opacity, child: child),
                      child: const Column(
                        children: [
                          Brand(size: 60),
                          SizedBox(height: 16),
                          Text(
                            'MarkAI',
                            style: TextStyle(
                              fontFamily: 'Plus Jakarta Sans',
                              fontSize: 20,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    // Reserve the status line so slow loading does not move the logo.
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        c.startupFailed
                            ? '暂时无法连接，请检查网络后重试。'
                            : showLoadingHint && !c.connected
                            ? '正在连接…'
                            : ' ',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12,
                          height: 1.6,
                          color: muted,
                        ),
                      ),
                    ),
                    if (c.startupFailed) ...[
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: () => c.start(),
                        child: const Text('重试'),
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
