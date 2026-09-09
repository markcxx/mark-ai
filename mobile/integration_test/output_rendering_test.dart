import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/shared/models/chat.dart';

import '../test/support/fake_workspace.dart';
import '../test/support/ui_fixture.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('native output formula, reasoning, tool states and toast', (
    tester,
  ) async {
    final c = await fixtureWorkspace();
    c.settings['general']['reduceMotion'] = true;
    c.user = jsonMap(uiFixture['user']);
    c.models = jsonList(uiFixture['models']).map(ModelRef.fromJson).toList();
    c.model = c.models.first;
    c.messages = [
      ChatMessage({
        'id': 'output',
        'role': 'assistant',
        'model': 'gpt-4o',
        'content':
            r'行内公式 $E=mc^2$。'
            '\n\n'
            r'\['
            '\n'
            r'\frac{-b\pm\sqrt{b^2-4ac}}{2a}'
            '\n'
            r'\]',
        'segments': [
          {
            'type': 'tool',
            'webSearch': {
              'status': 'done',
              'query': 'Flutter 公式',
              'results': [
                {
                  'title': '公式渲染参考',
                  'url': 'https://example.invalid/math',
                  'content': '数学公式、工具调用与正文应该保持一致。',
                },
              ],
            },
          },
          {
            'type': 'thinking',
            'content': '先检查条件，再推导公式。',
            'duration': 1200,
            'isActive': false,
          },
          {
            'type': 'content',
            'content':
                r'行内公式 $E=mc^2$。'
                '\n\n'
                r'\['
                '\n'
                r'\frac{-b\pm\sqrt{b^2-4ac}}{2a}'
                '\n'
                r'\]',
          },
        ],
      }),
    ];
    await tester.pumpWidget(MarkAIApp(controller: c, autoStart: false));
    await tester.pumpAndSettle();
    await binding.convertFlutterSurfaceToImage();
    await tester.tap(find.text('已调用联网搜索'));
    await tester.tap(find.text('已深度思考 (1.2 秒)'));
    await tester.pumpAndSettle();
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 500)),
    );
    await tester.pumpAndSettle();
    await binding.takeScreenshot('android-native-output-light');
    c.message('翻译完成', kind: 'success', id: 'translation');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('翻译完成'), findsOneWidget);
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 350)));
    await tester.pump();
    await binding.takeScreenshot('android-native-output-toast');
    await tester.tap(find.byTooltip('切换主题'));
    await tester.pumpAndSettle();
    await binding.takeScreenshot('android-native-output-dark');
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
}
