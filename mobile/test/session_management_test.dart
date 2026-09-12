import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/features/chat/presentation/session_row.dart';
import 'package:markai_mobile/shared/models/chat.dart';

import 'support/fake_workspace.dart';

void main() {
  testWidgets('selection controls animate in and out with the title', (
    tester,
  ) async {
    final c = await fixtureWorkspace();
    c.settings['general']['reduceMotion'] = false;
    var selecting = false;
    late StateSetter rebuild;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) {
              rebuild = setState;
              return SessionRow(
                controller: c,
                session: ChatSession({
                  'id': 'a',
                  'title': '动画会话',
                  'updatedAt': 0,
                }),
                selectionMode: selecting,
                onSelect: () {},
              );
            },
          ),
        ),
      ),
    );
    final title = find.text('动画会话');
    final initial = tester.getTopLeft(title).dx;
    rebuild(() => selecting = true);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 80));
    final entering = tester.getTopLeft(title).dx;
    expect(entering, greaterThan(initial));
    expect(entering, lessThan(initial + 36));
    await tester.pumpAndSettle();
    expect(tester.getTopLeft(title).dx, initial + 36);
    rebuild(() => selecting = false);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 80));
    final leaving = tester.getTopLeft(title).dx;
    expect(leaving, greaterThan(initial));
    expect(leaving, lessThan(initial + 36));
    await tester.pumpAndSettle();
    expect(tester.getTopLeft(title).dx, initial);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });

  for (final dark in [false, true]) {
    testWidgets('long press and batch management ($dark)', (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final c = await fixtureWorkspace();
      c.settings['general']['reduceMotion'] = true;
      c.settings['general']['themeMode'] = dark ? 'dark' : 'light';
      c.sessions = [
        ChatSession({'id': 'a', 'title': '会话甲', 'updatedAt': 0}),
        ChatSession({
          'id': 'b',
          'title': '会话乙',
          'updatedAt': 0,
          'favorite': true,
        }),
      ];
      await tester.pumpWidget(MarkAIApp(controller: c, autoStart: false));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('展开侧栏'));
      await tester.pumpAndSettle();
      expect(find.text('命令中心'), findsNothing);
      expect(
        tester.getTopLeft(find.text('会话乙')).dy,
        lessThan(tester.getTopLeft(find.text('会话甲')).dy),
      );
      final star = tester.widget<Icon>(find.byIcon(Icons.star_rounded));
      expect(star.color, const Color(0xffeab308));
      expect(find.byTooltip('会话操作'), findsNothing);
      await tester.longPress(find.text('会话甲'));
      await tester.pumpAndSettle();
      expect(find.text('重命名'), findsOneWidget);
      expect(c.activeSessionId, isNull);
      await tester.tapAt(const Offset(385, 700));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('批量管理会话'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('会话甲'));
      await tester.tap(find.text('会话乙'));
      await tester.pumpAndSettle();
      expect(c.activeSessionId, isNull);
      await tester.tap(find.widgetWithText(TextButton, '收藏'));
      await tester.pumpAndSettle();
      expect(c.sessions.every((s) => s.favorite), isTrue);
      final api = c.api as FakeApi;
      expect(
        api.requests.where(
          (r) => r['method'] == 'PATCH' && r['path'] == '/api/sessions/b',
        ),
        isEmpty,
      );
      await tester.tap(find.text('会话甲'));
      await tester.tap(find.text('会话乙'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, '删除'));
      await tester.pumpAndSettle();
      expect(find.text('删除选中的 2 个会话？'), findsOneWidget);
      expect(api.requests.where((r) => r['method'] == 'DELETE'), isEmpty);
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(c.sessions.length, 2);
      await tester.tap(find.widgetWithText(TextButton, '删除'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('确认'));
      await tester.pumpAndSettle();
      expect(c.sessions, isEmpty);
      expect(api.requests.where((r) => r['method'] == 'DELETE').length, 2);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      c.dispose();
    });
  }
}
