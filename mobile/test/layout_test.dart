import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/main.dart';

import 'support/fake_workspace.dart';

void main() {
  for (final width in [320.0, 390.0, 840.0]) {
    for (final dark in [false, true]) {
      testWidgets('chat layout $width ${dark ? 'dark' : 'light'}', (
        tester,
      ) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(width, 844);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final c = await fixtureWorkspace();
        c.settings['general']['reduceMotion'] = true;
        c.settings['general']['themeMode'] = dark ? 'dark' : 'light';
        c.draft = '请介绍一下你自己';
        await c.send();
        await tester.pumpWidget(MarkAIApp(controller: c, autoStart: false));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.byTooltip('发送消息'), findsOneWidget);
        await tester.tap(find.byTooltip('展开侧栏'));
        await tester.pumpAndSettle();
        expect(find.byTooltip('搜索会话'), findsOneWidget);
        expect(
          tester.getSize(find.byType(Drawer)).width,
          width < 768 ? width * .90 : 260,
        );
        expect(find.text('开启新话题'), findsOneWidget);
        await tester.tap(find.text('更早'));
        await tester.pumpAndSettle();
        expect(
          find.descendant(
            of: find.byType(Drawer),
            matching: find.byTooltip('会话操作'),
          ),
          findsNothing,
        );
        await tester.tap(find.text('更早'));
        await tester.pumpAndSettle();
        await tester.tap(find.byTooltip('搜索会话'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField).last, '自动生成');
        await tester.pump(const Duration(milliseconds: 300));
        await tester.pumpAndSettle();
        expect(
          (c.api as FakeApi).requests.any(
            (r) => (r['path'] as String).contains('q='),
          ),
          isTrue,
        );
        await tester.tap(find.text('自动生成的标题').last);
        await tester.pumpAndSettle();
        expect(find.byType(Drawer), findsNothing);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        c.dispose();
      });
    }
  }
}
