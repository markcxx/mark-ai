import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/features/chat/presentation/model_selector.dart';

import 'support/fake_workspace.dart';

void main() {
  testWidgets('model search focuses only after tapping it', (tester) async {
    final c = await fixtureWorkspace();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ModelSelector(controller: c)),
      ),
    );
    await tester.pumpAndSettle();
    final field = find.byType(TextField);
    final focus = tester.widget<TextField>(field).focusNode!;
    expect(focus.hasFocus, isFalse);
    expect(tester.testTextInput.isVisible, isFalse);
    await tester.tap(field);
    await tester.pump();
    expect(focus.hasFocus, isTrue);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
  testWidgets(
    'composer only focuses on tap and releases on send and new topic',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final c = await fixtureWorkspace();
      c.settings['general']['reduceMotion'] = true;
      await tester.pumpWidget(MarkAIApp(controller: c, autoStart: false));
      await tester.pumpAndSettle();
      final field = find.byType(TextField).first;
      FocusNode focus() => tester.widget<TextField>(field).focusNode!;
      expect(focus().hasFocus, isFalse);
      await tester.tap(field);
      await tester.pump();
      expect(focus().hasFocus, isTrue);
      await tester.enterText(field, '测试发送');
      await tester.pump();
      final api = c.api as FakeApi;
      api.createGate = Completer<void>();
      await tester.tap(find.byTooltip('发送消息'));
      await tester.pumpAndSettle();
      expect(find.byTooltip('停止生成'), findsOneWidget);
      expect(c.messages.single.content, '测试发送');
      expect(tester.widget<TextField>(field).controller!.text, isEmpty);
      expect(
        tester.getSize(find.byKey(const ValueKey('chat-send-surface'))),
        const Size(36, 36),
      );
      api.createGate!.complete();
      await tester.pumpAndSettle();
      expect(focus().hasFocus, isFalse);
      expect(tester.testTextInput.isVisible, isFalse);
      await tester.tap(find.byTooltip('展开侧栏'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('开启新话题'));
      await tester.pumpAndSettle();
      expect(focus().hasFocus, isFalse);
      expect(tester.testTextInput.isVisible, isFalse);
      await tester.pumpWidget(const SizedBox());
      c.dispose();
    },
  );
}
