import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/chat/application/speech_playback.dart';

import 'support/fake_workspace.dart';

class SpeechApi extends FakeApi {
  final calls = <Map<String, dynamic>>[];
  final pending = <Completer<Response<dynamic>>>[];
  SpeechApi() : super(MemoryStore());
  @override
  Future<Response<dynamic>> raw(
    String method,
    String path, {
    dynamic body,
    CancelToken? cancel,
    ResponseType type = ResponseType.json,
    bool allowDownloadRedirect = false,
    Map<String, String>? extraHeaders,
  }) {
    calls.add({'body': body, 'path': path, 'cancel': cancel});
    final result = Completer<Response<dynamic>>();
    pending.add(result);
    return result.future;
  }

  void complete(int index) => pending[index].complete(
    Response(
      data: [1, 2, 3],
      requestOptions: RequestOptions(path: '/api/speech'),
    ),
  );
}

class AudioFake implements SpeechAudio {
  final completion = StreamController<void>.broadcast();
  int loads = 0, plays = 0, stops = 0;
  @override
  Stream<void> get completed => completion.stream;
  @override
  Stream<Duration> get position => const Stream.empty();
  @override
  Stream<Duration> get duration => const Stream.empty();
  @override
  Future<void> load(Uint8List bytes) async {
    loads++;
  }

  @override
  Future<void> resume() async {
    plays++;
  }

  @override
  Future<void> pause() async {}
  @override
  Future<void> stop() async {
    stops++;
  }

  @override
  Future<void> dispose() async {
    await completion.close();
  }
}

Future<void> turn() => Future<void>.delayed(Duration.zero);
void main() {
  test(
    'speech splits Unicode without truncation and respects sentence boundaries',
    () {
      final text = '${'语音😀' * 180}。${'内容' * 350}';
      final chunks = splitSpeechText(text);
      expect(chunks.join(), text);
      expect(chunks.every((s) => s.runes.length <= 600), isTrue);
      expect(chunks.first.endsWith('。'), isTrue);
    },
  );
  test(
    'voice, pause during loading, cached replay and superseded requests',
    () async {
      final api = SpeechApi(), audio = AudioFake(), errors = <Object>[];
      final player = SpeechPlayback(
        api: api,
        onError: errors.add,
        onLoading: () {},
        onPlaybackStart: () {},
        onStop: () {},
        createAudio: () => audio,
      );
      addTearDown(player.dispose);
      final first = player.start('第一条', 'zh-CN-XiaoxiaoNeural');
      await turn();
      expect(api.calls.first['body'], {
        'content': '第一条',
        'voice': 'zh-CN-XiaoxiaoNeural',
      });
      await player.pause();
      await player.resume();
      expect(audio.plays, 0);
      expect(player.state, SpeechState.loading);
      api.complete(0);
      await turn();
      expect(player.state, SpeechState.playing);
      await player.pause();
      expect(player.state, SpeechState.paused);
      await player.resume();
      audio.completion.add(null);
      await first;
      expect(player.state, SpeechState.ended);
      final replay = player.start('第一条', 'zh-CN-XiaoxiaoNeural', replay: true);
      await turn();
      expect(api.calls.length, 1);
      audio.completion.add(null);
      await replay;
      final obsolete = player.start('旧请求', 'voice1');
      await turn();
      final current = player.start('新请求', 'voice2');
      await turn();
      api.complete(1);
      await obsolete;
      expect(player.state, SpeechState.loading);
      api.complete(2);
      await turn();
      expect(player.content, '新请求');
      expect(player.state, SpeechState.playing);
      audio.completion.add(null);
      await current;
      expect(errors, isEmpty);
    },
  );
  test('rapid start before stop completion honors latest intent', () async {
    final api = SpeechApi(), audio = AudioFake();
    final player = SpeechPlayback(
      api: api,
      onError: (_) {},
      onLoading: () {},
      onPlaybackStart: () {},
      onStop: () {},
      createAudio: () => audio,
    );
    addTearDown(player.dispose);
    final first = player.start('旧', 'one'), second = player.start('新', 'two');
    await turn();
    expect(api.calls.length, 1);
    expect(api.calls.single['body']['content'], '新');
    await first;
    api.complete(0);
    await turn();
    audio.completion.add(null);
    await second;
  });
}
