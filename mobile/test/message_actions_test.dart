import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/shared/models/chat.dart';

import 'support/fake_workspace.dart';

void main() {
  testWidgets(
    'touch reveals actions, copy confirms, and outside tap hides actions without layout jump',
    (tester) async {
      final c = await fixtureWorkspace();
      c.messages = [
        ChatMessage({'id': 'one', 'role': 'user', 'content': '需要复制的消息'}),
      ];
      c.settings['general']['reduceMotion'] = true;
      String? copied;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            copied = (call.arguments as Map)['text'] as String;
          }
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );
      await tester.pumpWidget(MarkAIApp(controller: c, autoStart: false));
      await tester.pumpAndSettle();
      final copy = find.byTooltip('复制');
      expect(copy.hitTestable(), findsNothing);
      final original = tester.getRect(find.text('需要复制的消息'));
      await tester.tap(find.text('需要复制的消息'));
      await tester.pumpAndSettle();
      expect(copy.hitTestable(), findsOneWidget);
      expect(tester.getRect(find.text('需要复制的消息')), original);
      await tester.tap(copy);
      await tester.pumpAndSettle();
      expect(copied, '需要复制的消息');
      expect(find.text('消息已复制'), findsOneWidget);
      await tester.tapAt(const Offset(10, 400));
      await tester.pumpAndSettle();
      expect(copy.hitTestable(), findsNothing);
      expect(tester.getRect(find.text('需要复制的消息')), original);
      await tester.pumpWidget(const SizedBox());
      c.dispose();
    },
  );
}
