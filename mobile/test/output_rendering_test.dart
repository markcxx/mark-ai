import 'dart:io';
import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:markdown/markdown.dart' as md;
import 'package:markai_mobile/core/theme/markai_theme.dart';
import 'package:markai_mobile/features/chat/presentation/math_markdown.dart';
import 'package:markai_mobile/features/chat/presentation/message_item.dart';
import 'package:markai_mobile/features/chat/presentation/thinking_panel.dart';
import 'package:markai_mobile/features/chat/presentation/tool_call_block.dart';
import 'package:markai_mobile/shared/models/chat.dart';
import 'package:markai_mobile/shared/widgets/app_toast.dart';

import 'support/fake_workspace.dart';

void main() {
  test(
    'math preserves code, escaped dollars, inline and display delimiters',
    () {
      final doc = md.Document(
        inlineSyntaxes: [MathInlineSyntax()],
        blockSyntaxes: const [MathBlockSyntax()],
        extensionSet: md.ExtensionSet.gitHubFlavored,
      );
      final html = md.renderToHtml(
        doc.parseLines([
          r'公式 $x^2$ 与 \(y=2\)，价格 \$20。代码 `$a$`。',
          '',
          r'\[',
          r'\frac{1}{2}',
          r'\]',
          '',
          '```tex',
          r'$not_math$',
          '```',
        ]),
      );
      expect('<math-inline>'.allMatches(html).length, 2);
      expect(html, contains('<math-display>'));
      expect(html, contains('<code>\$a\$</code>'));
      expect(html, contains('价格 \$20'));
    },
  );

  testWidgets(
    'thinking auto state persists on completion and toggles purple state',
    (tester) async {
      Widget panel(bool active) => MaterialApp(
        home: Scaffold(
          body: ThinkingPanel(
            content: '检查条件',
            display: 'auto',
            active: active,
            duration: 1200,
            child: const Text('推导内容'),
          ),
        ),
      );
      await tester.pumpWidget(panel(true));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('推导内容'), findsOneWidget);
      await tester.pumpWidget(panel(false));
      await tester.pumpAndSettle();
      expect(find.text('推导内容'), findsOneWidget);
      expect(find.text('已深度思考 (1.2 秒)'), findsOneWidget);
      await tester.tap(find.text('已深度思考 (1.2 秒)'));
      await tester.pumpAndSettle();
      expect(find.text('推导内容'), findsNothing);
    },
  );

  testWidgets('translation loading toast persists and replacement expires', (
    tester,
  ) async {
    final host = GlobalKey<AppToastHostState>();
    await tester.pumpWidget(
      MaterialApp(
        home: AppToastHost(key: host, child: const Scaffold()),
      ),
    );
    host.currentState!.show('正在翻译...', kind: 'loading', id: 'translation');
    await tester.pump(const Duration(seconds: 10));
    expect(find.text('正在翻译...'), findsOneWidget);
    host.currentState!.show('翻译完成', kind: 'success', id: 'translation');
    await tester.pump();
    expect(find.text('正在翻译...'), findsNothing);
    expect(find.text('翻译完成'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 2300));
    expect(find.text('翻译完成'), findsNothing);
  });

  testWidgets('wide markdown table scrolls at 320px without clipping controls', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 844);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final c = await fixtureWorkspace();
    final message = ChatMessage({
      'id': 'table',
      'role': 'assistant',
      'content':
          '| 项目 | 公式 | 说明 |\n|---|---|---|\n| 能量 | \$E=mc^2\$ | 支持公式与 **加粗** |',
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: markaiTheme(Brightness.light),
        home: Scaffold(
          body: SingleChildScrollView(
            child: MessageItem(
              message: message,
              controller: c,
              onSelect: (_) {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(Math), findsOneWidget);
    expect(find.byTooltip('复制表格'), findsOneWidget);
    expect(tester.takeException(), isNull);
    final tableRect = tester.getRect(find.byType(Table));
    await tester.dragFrom(
      Offset(180, tableRect.top + 55),
      const Offset(-120, 0),
    );
    await tester.pumpAndSettle();
    final horizontal = tester.state<ScrollableState>(
      find.byWidgetPredicate(
        (widget) =>
            widget is Scrollable && widget.axisDirection == AxisDirection.right,
      ),
    );
    expect(horizontal.position.pixels, greaterThan(0));
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });

  for (final dark in [false, true]) {
    testWidgets('output layout ${dark ? 'dark' : 'light'} at 390px', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      await tester.runAsync(() async {
        await (FontLoader(
          'Noto Sans SC',
        )..addFont(rootBundle.load('assets/fonts/NotoSansSC.ttf'))).load();
        final manifest = await rootBundle.loadString('FontManifest.json');
        // Formula package fonts are loaded by the engine on Android; widget
        // screenshots must explicitly load the bundled font families.
        expect(manifest, contains('KaTeX_Main'));
        for (final entry in jsonDecode(manifest) as List) {
          if (!(entry['family'] as String).contains('KaTeX')) continue;
          final loader = FontLoader(entry['family'] as String);
          for (final font in entry['fonts'] as List) {
            loader.addFont(rootBundle.load(font['asset'] as String));
          }
          await loader.load();
        }
      });
      final c = await fixtureWorkspace();
      final message = ChatMessage({
        'id': 'output',
        'role': 'assistant',
        'content':
            r'行内公式 $E=mc^2$。'
            '\n\n'
            r'\['
            '\n'
            r'\frac{-b\pm\sqrt{b^2-4ac}}{2a}'
            '\n'
            r'\]',
        'segments': [],
      });
      final key = GlobalKey();
      await tester.pumpWidget(
        MaterialApp(
          theme: markaiTheme(dark ? Brightness.dark : Brightness.light),
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(390, 844),
              disableAnimations: true,
            ),
            child: Scaffold(
              body: RepaintBoundary(
                key: key,
                child: ColoredBox(
                  color: dark ? const Color(0xff111214) : Colors.white,
                  child: SingleChildScrollView(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        children: [
                          ToolCallBlock(
                            data: {
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
                          ),
                          ToolCallBlock(
                            generatedFile: true,
                            toolLabel: 'Word 文档生成',
                            data: {
                              'status': 'error',
                              'toolName': 'word_document_finalize',
                              'error': '生成失败，请稍后重试',
                            },
                          ),
                          ThinkingPanel(
                            content: '检查条件',
                            display: 'collapsed',
                            active: false,
                            duration: 1200,
                            child: const Text(
                              '先检查条件，再推导公式。',
                              style: TextStyle(
                                fontSize: 13,
                                height: 1.625,
                                color: Color(0xff6b7280),
                              ),
                            ),
                          ),
                          MessageItem(
                            message: message,
                            controller: c,
                            onSelect: (_) {},
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('已调用联网搜索'));
      await tester.tap(find.text('Word 文档生成调用失败'));
      await tester.tap(find.text('已深度思考 (1.2 秒)'));
      await tester.pumpAndSettle();
      expect(find.byType(Math), findsNWidgets(2));
      expect(find.text('生成失败，请稍后重试'), findsOneWidget);
      expect(tester.takeException(), isNull);
      if (const bool.fromEnvironment('UPDATE_COMPONENT_SCREENSHOTS')) {
        await tester.runAsync(() async {
          final image =
              await (key.currentContext!.findRenderObject()
                      as RenderRepaintBoundary)
                  .toImage();
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          await File('qa/native-output-${dark ? 'dark' : 'light'}-390.png')
              .writeAsBytes(bytes!.buffer.asUint8List());
          image.dispose();
        });
      }
      await tester.pumpWidget(const SizedBox());
      c.dispose();
    });
  }
}
