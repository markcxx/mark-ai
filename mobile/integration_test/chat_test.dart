import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:markai_mobile/main.dart';

import '../test/support/fake_workspace.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('Android composer, history, theme and model menu', (
    tester,
  ) async {
    final c = await fixtureWorkspace();
    c.settings['general']['reduceMotion'] = true;
    await tester.pumpWidget(MarkAIApp(controller: c, autoStart: false));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '介绍一下 MarkAI');
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('发送消息'));
    await tester.pumpAndSettle();
    expect(c.messages.length, 2);
    expect(find.text('介绍一下 MarkAI'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.byTooltip('展开侧栏'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('搜索会话'), findsOneWidget);
    expect(find.text('开启新话题'), findsOneWidget);
    expect(find.text('历史'), findsOneWidget);
    await binding.convertFlutterSurfaceToImage();
    await tester.pumpAndSettle();
    await binding.takeScreenshot('android-sidebar-light');
    await tester.tap(find.byTooltip('收起侧栏'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('切换主题'));
    await tester.pumpAndSettle();
    expect(c.general['themeMode'], 'dark');
    await binding.takeScreenshot('android-chat-dark');
    await tester.tap(find.byTooltip('展开侧栏'));
    await tester.pumpAndSettle();
    await binding.takeScreenshot('android-sidebar-dark');
    await tester.tap(find.byTooltip('收起侧栏'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('切换主题'));
    await tester.pumpAndSettle();
    await binding.takeScreenshot('android-chat-light');
    expect(tester.takeException(), isNull);
  });
}
