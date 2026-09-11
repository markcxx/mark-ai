import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/chat/presentation/workspace_shell.dart';

void main() {
  for (final dark in [false, true]) {
    testWidgets('sidebar follows finger, reverses and settles ($dark)', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      bool open = false;
      late StateSetter rebuild;
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            brightness: dark ? Brightness.dark : Brightness.light,
          ),
          home: StatefulBuilder(
            builder: (context, setState) {
              rebuild = setState;
              return WorkspaceShell(
                open: open,
                reduceMotion: false,
                sidebarWidth: 260,
                onOpen: () => rebuild(() => open = true),
                onClose: () => rebuild(() => open = false),
                sidebar: const ColoredBox(color: Colors.grey),
                child: const ColoredBox(color: Colors.white),
              );
            },
          ),
        ),
      );
      final panel = find.byKey(const ValueKey('workspace-main-panel'));
      final drag = await tester.startGesture(const Offset(70, 400));
      await drag.moveBy(const Offset(30, 0));
      await tester.pump();
      await drag.moveBy(const Offset(80, 0));
      await tester.pump();
      expect(tester.getTopLeft(panel).dx, closeTo(110, 1));
      expect(open, isFalse); // No logical state change until release.
      await drag.moveBy(const Offset(-40, 0));
      await tester.pump();
      expect(tester.getTopLeft(panel).dx, closeTo(70, 1));
      await drag.cancel();
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(panel).dx, 0);
      await tester.dragFrom(const Offset(70, 400), const Offset(200, 0));
      await tester.pumpAndSettle();
      expect(open, isTrue);
      expect(tester.getTopLeft(panel).dx, 260);
      await tester.dragFrom(const Offset(230, 400), const Offset(-190, 0));
      await tester.pumpAndSettle();
      expect(open, isFalse);
      expect(tester.getTopLeft(panel).dx, 0);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('child horizontal scroll wins, desktop does not swipe', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    var opens = 0;
    final scroll = ScrollController(initialScrollOffset: 200);
    await tester.pumpWidget(
      MaterialApp(
        home: WorkspaceShell(
          open: false,
          reduceMotion: true,
          sidebarWidth: 260,
          onOpen: () => opens++,
          onClose: () {},
          sidebar: const SizedBox(),
          child: SingleChildScrollView(
            controller: scroll,
            scrollDirection: Axis.horizontal,
            child: const SizedBox(
              width: 1000,
              child: ColoredBox(color: Colors.white),
            ),
          ),
        ),
      ),
    );
    await tester.dragFrom(const Offset(100, 400), const Offset(150, 0));
    await tester.pumpAndSettle();
    expect(opens, 0);
    expect(scroll.offset, lessThan(200));
    tester.view.physicalSize = const Size(1000, 844);
    await tester.pumpAndSettle();
    await tester.dragFrom(const Offset(200, 400), const Offset(200, 0));
    await tester.pumpAndSettle();
    expect(opens, 0);
    await tester.pumpWidget(const SizedBox());
    scroll.dispose();
  });
}
