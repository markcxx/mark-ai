import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/chat/presentation/code_highlighter.dart';
import 'package:markai_mobile/shared/models/chat.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final fixtures = jsonList(
    jsonDecode(File('../contracts/prism-fixtures.json').readAsStringSync()),
  );
  for (final (index, fixture) in fixtures.indexed) {
    test(
      'native Web Prism tokens: ${fixture['language']} fixture $index',
      () async {
        final result = await CodeHighlighter.tokenize(
          fixture['code'] as String,
          fixture['language'] as String,
        );
        expect(
          result,
          fixture['tokens'],
          reason: fixture['language'] as String,
        );
        expect(result.map((t) => t['text']).join(), fixture['code']);
      },
      timeout: const Timeout(Duration(minutes: 1)),
    );
  }
  test('unknown language preserves plain source', () async {
    expect(
      await CodeHighlighter.tokenize('plain <text>', 'unknown-custom-language'),
      [
        {'text': 'plain <text>', 'classes': []},
      ],
    );
  }, timeout: const Timeout(Duration(minutes: 1)));

  test(
    'concurrent blocks retain their own Unicode source and language',
    () async {
      final sources = List.generate(8, (i) => 'const message$i = "你好🌍 $i";');
      final results = await Future.wait(
        sources.map((source) => CodeHighlighter.tokenize(source, 'javascript')),
      );
      for (var i = 0; i < sources.length; i++) {
        expect(results[i].map((t) => t['text']).join(), sources[i]);
        expect(
          await CodeHighlighter.tokenize(sources[i], 'javascript'),
          results[i],
        );
      }
    },
  );
}
