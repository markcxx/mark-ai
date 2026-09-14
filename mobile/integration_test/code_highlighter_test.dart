import 'package:flutter/material.dart';
import 'package:markai_mobile/features/chat/presentation/code_block.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:markai_mobile/features/chat/presentation/code_highlighter.dart';
import 'package:markai_mobile/shared/models/chat.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('offline Shiki initializes and preserves Unicode across themes', (
    tester,
  ) async {
    const code = 'const message: string = "你好🌍";\n// comment\n';
    for (final theme in [
      'one-light',
      'one-dark-pro',
      'github-dark-high-contrast',
    ]) {
      final result = await CodeHighlighter.highlight(code, 'ts', theme);
      final tokens = jsonList(result['tokens']);
      expect(tokens.map((token) => token['text']).join(), code);
      expect(tokens.any((token) => token['color'] != null), isTrue);
      expect(result['bg'], startsWith('#'));
    }
    final plain = await CodeHighlighter.highlight(
      '<script>"你好"</script>',
      'unknown',
      'one-light',
    );
    expect(
      jsonList(plain['tokens']).map((token) => token['text']).join(),
      '<script>"你好"</script>',
    );

    for (final dark in [false, true]) {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            brightness: dark ? Brightness.dark : Brightness.light,
          ),
          home: const Scaffold(
            body: SafeArea(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CodeBlock(
                  code: code,
                  language: 'ts',
                  collapseLines: 8,
                  lineNumbers: true,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 500)),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.byTooltip('复制代码'), findsOneWidget);
      if (!dark) await binding.convertFlutterSurfaceToImage();
      await tester.pumpAndSettle();
      await binding.takeScreenshot(
        dark ? 'shiki-native-dark' : 'shiki-native-light',
      );
    }
  });
}
