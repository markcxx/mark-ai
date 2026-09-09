import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:markai_mobile/main.dart';

import '../test/support/fake_workspace.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('guest and auth screenshots at the same logical viewport', (
    tester,
  ) async {
    final c = await fixtureWorkspace();
    c.guest = true;
    c.settings['general']['reduceMotion'] = true;
    await tester.pumpWidget(MarkAIApp(controller: c, autoStart: false));
    await tester.pumpAndSettle();
    await binding.convertFlutterSurfaceToImage();
    await tester.pumpAndSettle();
    await binding.takeScreenshot('android-guest-light');
    await tester.tap(find.text('登录'));
    await tester.pumpAndSettle();
    expect(find.text('登录你的账户'), findsOneWidget);
    await binding.takeScreenshot('android-login-light');
    await tester.tap(find.byTooltip('切换主题'));
    await tester.pumpAndSettle();
    await binding.takeScreenshot('android-login-dark');
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await binding.takeScreenshot('android-guest-dark');
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
}
