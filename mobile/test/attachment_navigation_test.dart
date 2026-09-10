import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/features/chat/presentation/workspace_shell.dart';

import 'support/fake_workspace.dart';

void main() {
  testWidgets('attachment menu offers images files and camera', (tester) async {
    final c = await fixtureWorkspace();
    c.settings['general']['reduceMotion'] = true;
    await tester.pumpWidget(MarkAIApp(controller: c, autoStart: false));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('添加附件'));
    await tester.pumpAndSettle();
    for (final label in ['图片', '文件', '相机']) {
      expect(find.text(label), findsOneWidget);
    }
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
  testWidgets(
    'mobile right swipe opens sidebar; vertical and left swipes do not',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      var opens = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: WorkspaceShell(
            open: false,
            reduceMotion: true,
            sidebarWidth: 260,
            onOpen: () => opens++,
            onClose: () {},
            sidebar: const SizedBox(),
            child: const ColoredBox(color: Colors.white),
          ),
        ),
      );
      await tester.dragFrom(const Offset(160, 400), const Offset(0, -150));
      await tester.pumpAndSettle();
      expect(opens, 0);
      await tester.dragFrom(const Offset(200, 400), const Offset(-100, 0));
      await tester.pumpAndSettle();
      expect(opens, 0);
      await tester.dragFrom(const Offset(100, 400), const Offset(150, 0));
      await tester.pumpAndSettle();
      expect(opens, 1);
    },
  );
}
