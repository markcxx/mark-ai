import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/chat/presentation/tool_summary.dart'
    as summaries;
import 'package:markai_mobile/shared/models/chat.dart';
import 'package:markai_mobile/features/chat/presentation/tool_call_block.dart';

String webToolSummary(Json data) => summaries.webToolSummary(data).text;
String generatedToolSummary(Json data) =>
    summaries.generatedToolSummary(data).text;

void main() {
  test('shows search queries, specific pages and find terms', () {
    expect(
      webToolSummary({'status': 'done', 'query': 'mac 图片导入', 'results': []}),
      '已搜索 mac 图片导入',
    );
    expect(
      webToolSummary({
        'tool': 'read_webpage',
        'status': 'searching',
        'query': 'https://www.example.com/photos/import?track=x',
      }),
      '正在读取 example.com/photos/import',
    );
    expect(
      webToolSummary({
        'tool': 'find_in_page',
        'status': 'done',
        'query': '导入',
        'title': '照片指南',
        'page': {
          'matches': [8, 9],
        },
      }),
      '已查找 导入 · 照片指南 · 2 处匹配',
    );
    expect(
      webToolSummary({
        'tool': 'read_webpage',
        'status': 'error',
        'title': '照片指南',
      }),
      '读取失败 照片指南',
    );
  });
  test(
    'identifies generated filenames, document steps and calculator functions',
    () {
      expect(
        generatedToolSummary({
          'status': 'done',
          'toolName': 'create_excel_workbook',
          'file': {'name': '月度统计.xlsx'},
        }),
        '已生成表格 月度统计.xlsx',
      );
      expect(
        generatedToolSummary({
          'status': 'running',
          'toolName': 'word_document_append',
          'progress': {'detail': '第二章 项目方案'},
        }),
        '正在构建文档章节 第二章 项目方案',
      );
      expect(
        generatedToolSummary({'status': 'done', 'toolName': 'convert_units'}),
        '已完成单位换算',
      );
    },
  );
  testWidgets(
    'long collapsed summaries remain reachable without overflowing a mobile row',
    (tester) async {
      final query = List.filled(25, '照片导入与同步').join(' ');
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 320,
              child: ToolCallBlock(
                data: {'status': 'done', 'query': query, 'results': []},
              ),
            ),
          ),
        ),
      );
      expect(find.text('已搜索 $query', findRichText: true), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('已搜索 $query', findRichText: true));
      await tester.pumpAndSettle();
      expect(find.text(query), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
