import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:markai_mobile/core/theme/markai_theme.dart';
import 'package:markai_mobile/features/previews/artifact_card.dart';
import 'package:markai_mobile/features/chat/presentation/export_dialog.dart';
import 'package:markai_mobile/shared/models/chat.dart';

import '../test/support/fake_workspace.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  final exports = <String, String>{};
  binding.reportData = {'exports': exports};
  testWidgets('Android artifacts render and export without external services', (
    tester,
  ) async {
    final fixtures = {
      'echarts': '{"title":{"text":"测试图表"},"xAxis":{"data":["甲","乙"]},"yAxis":{},"series":[{"type":"bar","data":[3,7]}]}',
      'mermaid': 'graph TD\n A[开始] --> B[结束]',
      'markmap': '# 思维导图\n## 分支一\n- 子节点\n## 分支二',
    };
    for (final dark in [false, true]) {
      for (final entry in fixtures.entries) {
        final key = GlobalKey<ArtifactCardState>();
        await tester.pumpWidget(
          MaterialApp(
            theme: markaiTheme(dark ? Brightness.dark : Brightness.light),
            home: Scaffold(
              body: SafeArea(
                child: SingleChildScrollView(
                  child: ArtifactCard(
                    key: key,
                    kind: entry.key,
                    source: entry.value,
                  ),
                ),
              ),
            ),
          ),
        );
        for (
          var i = 0;
          i < 120 &&
              key.currentState?.ready != true &&
              key.currentState?.error == null;
          i++
        ) {
          await tester.pump(const Duration(milliseconds: 250));
          await Future<void>.delayed(const Duration(milliseconds: 250));
        }
        expect(
          key.currentState?.error,
          isNull,
          reason: '${entry.key} render error',
        );
        expect(
          key.currentState?.ready,
          isTrue,
          reason: '${entry.key} readiness',
        );
        await key.currentState!.command('zoomIn');
        await key.currentState!.command('fit');
        if (entry.key == 'markmap') {
          await key.currentState!.command('collapse');
          await key.currentState!.command('expand');
        }
        final png = await key.currentState!.exportBytes('png');
        expect(png.take(8), [137, 80, 78, 71, 13, 10, 26, 10]);
        expect(png.length, greaterThan(2000));
        exports['android-${entry.key}-${dark ? 'dark' : 'light'}-export.png'] =
            base64Encode(png);
        if (entry.key != 'echarts') {
          final svg = utf8.decode(await key.currentState!.exportBytes('svg'));
          expect(svg, contains('<svg'));
          expect(svg, contains(entry.key == 'markmap' ? '分支' : '开始'));
        }
        if (!dark) {
          key.currentState!.expand();
          await tester.pump(const Duration(milliseconds: 250));
          final expanded = tester.state<ArtifactCardState>(
            find.byType(ArtifactCard).last,
          );
          for (
            var i = 0;
            i < 120 && !expanded.ready && expanded.error == null;
            i++
          ) {
            await tester.pump(const Duration(milliseconds: 100));
            await Future<void>.delayed(const Duration(milliseconds: 100));
          }
          expect(expanded.ready, isTrue, reason: 'expanded ${entry.key}');
          expect(tester.takeException(), isNull);
          await tester.binding.handlePopRoute();
          await tester.pump(const Duration(milliseconds: 300));
        }
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump();
      }
    }
  });
  testWidgets('conversation image includes all messages and chart pixels', (
    tester,
  ) async {
    final c = await fixtureWorkspace();
    c.messages = [
      ChatMessage({'id': 'u', 'role': 'user', 'content': '导出公式与图表'}),
      ChatMessage({
        'id': 'a',
        'role': 'assistant',
        'model': 'gpt-4o',
        'content':
            r'完整公式 $\int_0^1 x^2dx=\frac13$。'
            '\n\n```mermaid\ngraph LR\nA[开始]-->B[完成]\n```\n\n最后一行也要导出。',
      }),
    ];
    await tester.pumpWidget(
      MaterialApp(
        theme: markaiTheme(Brightness.light),
        home: ExportDialog(
          controller: c,
          session: ChatSession({'id': 'qa', 'title': '导出验证'}),
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    final state = tester.state(find.byType(ExportDialog)) as dynamic;
    final pending = state.capture();
    for (var i = 0; i < 40; i++) {
      await tester.pump(const Duration(milliseconds: 100));
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    final png = await pending;
    expect(png.take(8), [137, 80, 78, 71, 13, 10, 26, 10]);
    exports['android-conversation-export.png'] = base64Encode(png);
    expect(tester.takeException(), isNull);
  });
  testWidgets('incomplete streamed chart recovers when the source completes', (
    tester,
  ) async {
    final key = GlobalKey<ArtifactCardState>();
    Widget card(String source) => MaterialApp(
      theme: markaiTheme(Brightness.light),
      home: Scaffold(
        body: SafeArea(
          child: SingleChildScrollView(
            child: ArtifactCard(key: key, kind: 'echarts', source: source),
          ),
        ),
      ),
    );
    await tester.pumpWidget(card('{"series":'));
    for (var i = 0; i < 100 && key.currentState?.error == null; i++) {
      await tester.pump(const Duration(milliseconds: 100));
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    expect(key.currentState!.error, isNotNull);
    expect(find.text('图表暂时无法展示'), findsOneWidget);
    await tester.pumpWidget(
      card(
        '{"xAxis":{"data":["A"]},"yAxis":{},"series":[{"type":"bar","data":[1]}]}',
      ),
    );
    for (var i = 0; i < 100 && !key.currentState!.ready; i++) {
      await tester.pump(const Duration(milliseconds: 100));
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    expect(key.currentState!.ready, isTrue);
    await tester.pump();
    expect(find.text('图表暂时无法展示'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
