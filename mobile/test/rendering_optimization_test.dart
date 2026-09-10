import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/features/chat/presentation/message_markdown.dart';

import 'support/fake_workspace.dart';

void main() {
  testWidgets('stream updates preserve history widgets and composer geometry', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final c = await fixtureWorkspace();
    c.settings['general']['reduceMotion'] = true;
    c.settings['general']['responseAnimation'] = 'none';
    c.draft = 'first';
    await c.send();
    await c.waitForSessionNaming(c.activeSessionId!);
    c.messages.last.content = 'completed history';
    c.messages.last.segments = [
      {'type': 'content', 'content': 'completed history'},
    ];
    final api = c.api as FakeApi;
    api.holdStream = true;
    c.draft = 'second';
    final sending = c.send();
    await tester.runAsync(() async {
      for (var i = 0; i < 100 && !c.messages.last.streaming; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 1));
      }
    });
    await tester.pumpWidget(MarkAIApp(controller: c, autoStart: false));
    await tester.pumpAndSettle();
    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    c.setDraft('new draft');
    await tester.pumpAndSettle();
    expect(identical(app, tester.widget(find.byType(MaterialApp))), isTrue);
    final historyFinder = find.byWidgetPredicate(
      (w) => w is MessageMarkdown && w.text == 'completed history',
    );
    final history = tester.widget<MessageMarkdown>(historyFinder);
    final composer = tester.getRect(find.byType(TextField));
    final current = c.messages.last;
    current.content = 'new streamed text';
    current.segments = [
      {'type': 'content', 'content': current.content},
    ];
    c.streamingRevision.value++;
    await tester.pumpAndSettle();
    expect(find.text('new streamed text', findRichText: true), findsOneWidget);
    expect(identical(history, tester.widget(historyFinder)), isTrue);
    expect(tester.getRect(find.byType(TextField)), composer);
    expect(identical(app, tester.widget(find.byType(MaterialApp))), isTrue);
    expect(tester.takeException(), isNull);
    await tester.runAsync(() async {
      await c.stop();
      await sending;
    });
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
}
