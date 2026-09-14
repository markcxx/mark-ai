import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/chat/presentation/code_highlighter.dart';
import 'package:markai_mobile/shared/models/chat.dart';
import 'package:markai_mobile/shared/models/code_themes.dart';

void main() {
  test('native application languages retain bundled grammars', () {
    for (final language in ['dart', 'kotlin', 'swift', 'rust', 'csharp']) {
      expect(codeLanguages[language], isNotEmpty, reason: language);
    }
  });
  test('legacy themes resolve both modes and modern names stay exact', () {
    expect(resolveCodeTheme('one', false), 'one-light');
    expect(resolveCodeTheme('one', true), 'one-dark-pro');
    expect(
      resolveCodeTheme('github-dark-high-contrast', false),
      'github-dark-high-contrast',
    );
    expect(resolveCodeTheme('unknown', true), 'one-dark-pro');
  });
  test(
    'concurrent identical requests share work; theme changes do not',
    () async {
      var calls = 0;
      final gate = Completer<void>();
      final service = HighlightService((code, language, theme) async {
        calls++;
        await gate.future;
        return <String, dynamic>{
          'tokens': [
            {'text': code},
          ],
          'bg': theme,
        };
      });
      final first = service.highlight('你好🌍', 'ts', 'one-light');
      final duplicate = service.highlight('你好🌍', 'ts', 'one-light');
      final dark = service.highlight('你好🌍', 'ts', 'one-dark-pro');
      gate.complete();
      expect(await first, await duplicate);
      expect((await dark)['bg'], 'one-dark-pro');
      await service.highlight('你好🌍', 'ts', 'one-light');
      expect(calls, 2);
    },
  );
  test('failures can be retried and cache evicts old entries', () async {
    var calls = 0;
    final service = HighlightService((code, language, theme) async {
      if (++calls == 1) throw StateError('temporary');
      return <String, dynamic>{
        'tokens': <Json>[
          {'text': code},
        ],
      };
    });
    await expectLater(
      service.highlight('a', 'ts', 'one-light'),
      throwsStateError,
    );
    await service.highlight('a', 'ts', 'one-light');
    for (var i = 0; i < 33; i++) {
      await service.highlight('$i', 'ts', 'one-light');
    }
    await service.highlight('a', 'ts', 'one-light');
    expect(calls, 36);
  });
}
