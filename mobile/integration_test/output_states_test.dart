import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:markai_mobile/core/theme/markai_theme.dart';
import 'package:markai_mobile/shared/models/chat.dart';
import 'package:markai_mobile/features/chat/presentation/message_markdown.dart';
import 'package:markai_mobile/features/chat/presentation/message_sources.dart';
import 'package:markai_mobile/features/chat/presentation/translation_panel.dart';
import 'package:markai_mobile/features/chat/presentation/speech_action.dart';
import 'package:markai_mobile/features/chat/application/speech_playback.dart';

import '../test/support/fake_workspace.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'native citations, translation and speech states in both themes',
    (tester) async {
      final c = await fixtureWorkspace();
      final message = ChatMessage({
        'id': 'a',
        'role': 'assistant',
        'content': r'结论见[1]。$\begin{pmatrix}a&b\\c&d\end{pmatrix}$。',
        'segments': [
          {
            'type': 'tool',
            'webSearch': {
              'results': [
                {
                  'citationId': 1,
                  'title': '公式与来源参考',
                  'url': 'https://example.invalid/math',
                  'content': '这是一条完整的来源摘要，用来验证原生来源弹层。',
                  'publishedDate': '2026-09-09',
                },
              ],
            },
          },
        ],
      });
      final speech = SpeechPlayback(
        api: c.api,
        onError: (_) {},
        onLoading: () {},
        onPlaybackStart: () {},
        onStop: () {},
      );
      addTearDown(speech.dispose);
      speech.state = SpeechState.playing;
    speech.voice = 'Cherry';
      speech.duration = const Duration(seconds: 60);
      speech.position = const Duration(seconds: 15);
      speech.chunkCount = 2;
      speech.chunkIndex = 1;
      for (final dark in [false, true]) {
        await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner:false,
            theme: markaiTheme(dark ? Brightness.dark : Brightness.light),
            home: Scaffold(
              body: SafeArea(
                child: SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        MessageMarkdown(
                          message: message,
                          controller: c,
                          text: message.content,
                        ),
                        const TranslationPanel(
                          language: '英语',
                          child: Text('The complete translated text.'),
                        ),
                        MessageAudioPlayer(playback: speech),
                        MessageSources(
                          citations: collectMessageCitations(message),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('译文 · 英语'));
        await tester.pumpAndSettle();
        expect(find.text('The complete translated text.'), findsOneWidget);
        await tester.tap(find.text('1 个来源'));
        await tester.pumpAndSettle();
      if (!dark) {await binding.convertFlutterSurfaceToImage();await tester.pumpAndSettle();}
        await binding.takeScreenshot(
          'android-output-states-${dark ? 'dark' : 'light'}',
        );
      await tester.tap(find.text('1').first);
      await tester.pumpAndSettle();
      await Future<void>.delayed(const Duration(milliseconds:350));
      await tester.pump(const Duration(milliseconds:200));
        expect(find.text('打开来源'), findsOneWidget);
        expect(find.text('2026年9月9日'), findsOneWidget);
        await binding.takeScreenshot(
          'android-source-popover-${dark ? 'dark' : 'light'}',
        );
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump();
      }
    },
  );
  testWidgets('Android audio plugin loads PCM, pauses, resumes and completes', (
    tester,
  ) async {
    final audio = NativeSpeechAudio();
    final completion = Completer<void>();
    final listener = audio.completed.listen((_) {
      if (!completion.isCompleted) completion.complete();
    });
    final bytes = Uint8List(44 + 32000), data = ByteData.sublistView(bytes);
    void ascii(int offset, String text) {
      bytes.setRange(offset, offset + text.length, text.codeUnits);
    }

    ascii(0, 'RIFF');
    data.setUint32(4, bytes.length - 8, Endian.little);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    data.setUint32(16, 16, Endian.little);
    data.setUint16(20, 1, Endian.little);
    data.setUint16(22, 1, Endian.little);
    data.setUint32(24, 16000, Endian.little);
    data.setUint32(28, 32000, Endian.little);
    data.setUint16(32, 2, Endian.little);
    data.setUint16(34, 16, Endian.little);
    ascii(36, 'data');
    data.setUint32(40, 32000, Endian.little);
    try {
      await audio.load(bytes);
      await audio.resume();
      await Future<void>.delayed(const Duration(milliseconds: 150));
      await audio.pause();
      expect(completion.isCompleted, isFalse);
      await audio.resume();
      await completion.future.timeout(const Duration(seconds: 10));
    } finally {
      await listener.cancel();
      await audio.dispose();
    }
  });
}
