import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:markdown/markdown.dart' as md;
import 'package:markai_mobile/features/chat/presentation/message_sources.dart';
import 'package:markai_mobile/features/chat/presentation/translation_panel.dart';
import 'package:markai_mobile/features/chat/presentation/stream_fade.dart';
import 'package:markai_mobile/features/previews/file_preview.dart';
import 'package:markai_mobile/shared/models/chat.dart';
import 'package:markai_mobile/features/chat/presentation/message_markdown.dart';

import 'support/fake_workspace.dart';

void main() {
  testWidgets(
    'nested task lists and Web admonition markers render as components',
    (tester) async {
      final c = await fixtureWorkspace();
      final message = ChatMessage({
        'id': 'a',
        'role': 'assistant',
        'content':
            '> [!TIP]\n> 这是提示\n\n- [x] 已完成\n- [ ] 待处理\n  - 子项含公式 \$x^2\$',
      });
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageMarkdown(
              message: message,
              controller: c,
              text: message.content,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('TIP'), findsOneWidget);
      expect(find.text('[x] 已完成'), findsNothing);
      expect(find.byType(Math), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  test(
    'complex TeX matrices, aligned equations, cases and operators parse',
    () {
      for (final source in [
        r'\begin{pmatrix}a&b\\c&d\end{pmatrix}',
        r'\begin{aligned}f(x)&=x^2+1\\f\prime(x)&=2x\end{aligned}',
        r'f(x)=\begin{cases}x^2&x\ge0\\-x&x<0\end{cases}',
        r'\boxed{\sum_{n=1}^{\infty}\frac{1}{n^2}=\frac{\pi^2}{6}}',
        r'\int_{-\infty}^{\infty}e^{-x^2}\,dx=\sqrt{\pi}',
        r'\underbrace{a+\cdots+a}_{n\text{ times}}=na',
        r'\lim_{x\to0}\frac{\sin x}{x}=1',
      ]) {
        expect(Math.tex(source).parseError, isNull, reason: source);
      }
    },
  );
  test('document preview policy cannot be bypassed by MIME or extension', () {
    for (final extension in [
      'pdf',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
      'odt',
    ]) {
      expect(
        supportsNativeFilePreview({
          'name': '文件.$extension',
          'contentType': 'text/plain',
        }),
        isFalse,
      );
    }
    expect(
      supportsNativeFilePreview({
        'name': '附件',
        'contentType': 'application/pdf',
      }),
      isFalse,
    );
    for (final file in [
      {'name': 'a.png', 'contentType': 'image/png'},
      {'name': 'a.md', 'contentType': 'text/markdown'},
    ]) {
      expect(supportsNativeFilePreview(file), isTrue);
    }
  });
  test(
    'citations merge repeated results and preserve structured numbering',
    () {
      final result = collectMessageCitations(
        ChatMessage({
          'id': 'm',
          'role': 'assistant',
          'segments': [
            {
              'type': 'tool',
              'webSearch': {
                'results': [
                  {'url': ' https://a.test ', 'title': '旧', 'content': '摘录'},
                  {'url': 'https://b.test', 'citationId': 4},
                  {
                    'url': 'https://a.test',
                    'citationId': 2,
                    'title': '新',
                    'content': '',
                  },
                ],
              },
            },
          ],
        }),
      );
      expect(result.map((r) => r['citationId']), [2, 4]);
      expect(result.first['content'], '摘录');
      expect(result.first['title'], '新');
    },
  );
  test(
    'citations leave code, links, escaped and unknown references intact',
    () {
      final document = md.Document(
        inlineSyntaxes: [
          CitationSyntax({1, 2}),
        ],
      );
      final html = md.renderToHtml(
        document.parseLines([
          r'引用[1]，未知[3]，代码 `[1]`，链接[1](https://a.test)，转义\[2]。',
        ]),
      );
      expect('<citation>'.allMatches(html).length, 1);
      expect(html, contains('<code>[1]</code>'));
      expect(html, contains('href="https://a.test"'));
    },
  );
  testWidgets(
    'translation starts collapsed and preserves expansion on replacement',
    (tester) async {
      Widget panel(String text) => MaterialApp(
        home: Scaffold(
          body: TranslationPanel(language: '英语', child: Text(text)),
        ),
      );
      await tester.pumpWidget(panel('完整译文'));
      expect(find.text('完整译文'), findsNothing);
      await tester.tap(find.text('译文 · 英语'));
      await tester.pumpAndSettle();
      expect(find.text('完整译文'), findsOneWidget);
      await tester.pumpWidget(panel('替换后的完整译文'));
      await tester.pumpAndSettle();
      expect(find.text('替换后的完整译文'), findsOneWidget);
      await tester.tap(find.text('译文 · 英语'));
      await tester.pumpAndSettle();
      expect(find.text('替换后的完整译文'), findsNothing);
    },
  );
  testWidgets('stream fade preserves wrapping, Unicode and exclusion layout', (
    tester,
  ) async {
    Widget text(String value) => MaterialApp(
      home: Scaffold(
        body: SizedBox(
          width: 180,
          child: StreamFade(
            content: value,
            enabled: true,
            child: Column(
              children: [
                Text(value),
                const StreamFadeExclusion(
                  child: RepaintBoundary(child: Text('代码不淡入')),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpWidget(text('开始😀'));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpWidget(text('开始😀 追加的中文与 equation 内容'));
    await tester.pump(const Duration(milliseconds: 90));
    expect(find.text('开始😀 追加的中文与 equation 内容'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.takeException(), isNull);
  });
}
