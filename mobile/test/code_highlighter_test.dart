import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/chat/presentation/code_highlighter.dart';
import 'package:markai_mobile/shared/models/chat.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('native engine returns exactly the Web Prism tokens and preserves source', () async {
    final fixtures = jsonList(jsonDecode(await File('../contracts/prism-fixtures.json').readAsString()));
    for(final fixture in fixtures) {
      final result = await CodeHighlighter.tokenize(fixture['code'] as String,fixture['language'] as String);
      expect(result,fixture['tokens'],reason:fixture['language'] as String);
      expect(result.map((t)=>t['text']).join(),fixture['code']);
    }
    expect(await CodeHighlighter.tokenize('plain <text>','unknown-custom-language'),[{'text':'plain <text>','classes':[]}]);
  });
}
