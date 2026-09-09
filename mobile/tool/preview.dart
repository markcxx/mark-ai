// Deterministic UI review entry point. Never used by the production app.
import 'package:flutter/material.dart';
import 'package:markai_mobile/main.dart';

import '../test/support/fake_workspace.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final c = await fixtureWorkspace();
  c.draft = '介绍一下 MarkAI';
  await c.send();
  c.settings['general']['themeMode'] = const String.fromEnvironment(
    'PREVIEW_THEME',
    defaultValue: 'light',
  );
  runApp(MarkAIApp(controller: c, autoStart: false));
}
