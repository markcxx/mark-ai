import 'package:flutter/material.dart';

import 'core/network/api_client.dart';
import 'core/storage/local_store.dart';
import 'core/theme/markai_theme.dart';
import 'features/auth/startup_screen.dart';
import 'features/chat/application/workspace_controller.dart';
import 'features/chat/presentation/chat_screen.dart';
import 'shared/widgets/app_toast.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final local = SecureLocalStore();
  runApp(MarkAIApp(controller: WorkspaceController(ApiClient(local), local)));
}

class MarkAIApp extends StatefulWidget {
  final WorkspaceController controller;
  final bool autoStart;
  const MarkAIApp({super.key, required this.controller, this.autoStart = true});
  @override
  State<MarkAIApp> createState() => _MarkAIAppState();
}

class _MarkAIAppState extends State<MarkAIApp> {
  final messenger = GlobalKey<ScaffoldMessengerState>();
  final toasts = GlobalKey<AppToastHostState>();
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(feedback);
    if (widget.autoStart) widget.controller.start();
  }

  void feedback() {
    final c = widget.controller;
    final text = c.error ?? c.notice;
    final kind = c.error != null ? 'error' : c.noticeKind;
    final id = c.noticeId;
    if (text != null) {
      c.error = null;
      c.notice = null;
      c.noticeId = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        toasts.currentState?.show(text, kind: kind, id: id);
      });
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(feedback);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      final mode = c.general['themeMode'];
      return MaterialApp(
        title: 'MarkAI',
        debugShowCheckedModeBanner: false,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(disableAnimations: c.general['reduceMotion'] == true),
          child: AppToastHost(key: toasts, child: child!),
        ),
        scaffoldMessengerKey: messenger,
        theme: markaiTheme(
          Brightness.light,
          primaryColor: c.general['primaryColor'] as String? ?? 'black',
        ),
        darkTheme: markaiTheme(
          Brightness.dark,
          primaryColor: c.general['primaryColor'] as String? ?? 'black',
        ),
        themeMode: mode == 'dark'
            ? ThemeMode.dark
            : mode == 'light'
            ? ThemeMode.light
            : ThemeMode.system,
        home: c.connected
            ? ChatScreen(controller: c)
            : StartupScreen(controller: c),
      );
    },
  );
}
