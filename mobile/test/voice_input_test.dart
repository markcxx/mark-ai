import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/chat/application/voice_input_controller.dart';

import 'support/fake_speech_input.dart';

void main() {
  late FakeSpeechInput backend;
  late VoiceInputController voice;
  late List<String> sent, errors;
  setUp(() {
    backend = FakeSpeechInput();
    sent = [];
    errors = [];
    voice = VoiceInputController(
      backend: backend,
      onText: sent.add,
      onError: errors.add,
    );
  });
  tearDown(() {
    voice.dispose();
    backend.stream.close();
  });

  test(
    'only sends final text after release; RMS drives the waveform',
    () async {
      await voice.start();
      backend.emit('level', 8.0);
      expect(voice.levels.last, greaterThan(0));
      backend.emit('partial', '你好');
      expect(sent, isEmpty);
      await voice.release();
      expect(backend.stops, hasLength(1));
      expect(sent, isEmpty);
      backend.emit('final', '你好世界');
      expect(sent, ['你好世界']);
      expect(voice.active, isFalse);
      backend.emit('final', '重复回调');
      expect(sent, hasLength(1));
    },
  );
  test(
    'slide up cancels even if a final result arrived before release',
    () async {
      await voice.start();
      backend.emit('final', '不应发送');
      expect(sent, isEmpty);
      voice.move(-90);
      await voice.release();
      expect(sent, isEmpty);
      expect(backend.cancels, hasLength(1));
    },
  );
  test(
    'sliding back restores send; old callbacks never enter a new hold',
    () async {
      await voice.start();
      final old = backend.starts.last;
      voice.cancel();
      await voice.start();
      backend.emit('final', '旧消息', old);
      expect(voice.text, isEmpty);
      voice.move(-100);
      voice.move(-20);
      backend.emit('final', '新消息');
      expect(sent, isEmpty);
      await voice.release();
      expect(sent, ['新消息']);
    },
  );
  test('releasing while starting never sends later recognition', () async {
    backend.ready = false;
    await voice.start();
    await voice.release();
    backend.emit('ready');
    backend.emit('final', '迟到结果');
    expect(sent, isEmpty);
    expect(voice.active, isFalse);
  });
  test(
    'permission/unavailable errors and empty speech preserve the draft',
    () async {
      backend.startError = PlatformException(
        code: 'permission',
        message: '请允许麦克风权限',
      );
      await voice.start();
      expect(errors, ['请允许麦克风权限']);
      expect(voice.active, isFalse);
      backend.startError = null;
      await voice.start();
      backend.emit('final', '  ');
      await voice.release();
      expect(sent, isEmpty);
      expect(errors.last, contains('没有听清'));
    },
  );
  testWidgets('timeout cancels without submitting partial transcription', (
    tester,
  ) async {
    await voice.start();
    backend.emit('partial', '未完成');
    await voice.release();
    await tester.pump(const Duration(seconds: 11));
    expect(voice.active, isFalse);
    expect(sent, isEmpty);
    expect(errors.single, contains('超时'));
  });
}
