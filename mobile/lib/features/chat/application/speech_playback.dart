import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';

List<String> splitSpeechText(String content, {int limit = 600}) {
  if (limit < 1) return [];
  final chars = content.trim().runes.toList(), chunks = <String>[];
  var start = 0;
  while (start < chars.length) {
    var length = (chars.length - start).clamp(0, limit);
    if (start + length < chars.length) {
      for (final boundary in [RegExp(r'[\n。！？!?；;]'), RegExp(r'[，,、：:\s]')]) {
        var found = false;
        for (var i = length - 1; i >= (length * .55).floor(); i--) {
          if (boundary.hasMatch(String.fromCharCode(chars[start + i]))) {
            length = i + 1;
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    final text = String.fromCharCodes(chars.sublist(start, start + length))
        .trim();
    if (text.isNotEmpty) chunks.add(text);
    start += length;
  }
  return chunks;
}

enum SpeechState { idle, loading, playing, paused, ended }

abstract class SpeechAudio {
  Stream<void> get completed;
  Stream<Duration> get position;
  Stream<Duration> get duration;
  Future<void> load(Uint8List bytes);
  Future<void> pause();
  Future<void> resume();
  Future<void> stop();
  Future<void> dispose();
}

class NativeSpeechAudio implements SpeechAudio {
  final AudioPlayer player = AudioPlayer();
  @override
  Stream<void> get completed => player.onPlayerComplete;
  @override
  Stream<Duration> get position => player.onPositionChanged;
  @override
  Stream<Duration> get duration => player.onDurationChanged;
  @override
  Future<void> load(Uint8List bytes) => player.setSource(BytesSource(bytes));
  @override
  Future<void> pause() => player.pause();
  @override
  Future<void> resume() => player.resume();
  @override
  Future<void> stop() => player.stop();
  @override
  Future<void> dispose() => player.dispose();
}

class SpeechPlayback extends ChangeNotifier {
  final ApiClient api;
  final void Function(Object) onError;
  final VoidCallback onLoading, onPlaybackStart, onStop;
  final SpeechAudio Function() createAudio;
  static SpeechPlayback? active;
  SpeechAudio? _audio;
  final subscriptions = <StreamSubscription>[];
  final buffers = <Uint8List>[];
  SpeechState state = SpeechState.idle;
  String content = '', voice = '__system__';
  int chunkIndex = 0, chunkCount = 0, _run = 0;
  Duration position = Duration.zero, duration = Duration.zero;
  bool disposed = false, _paused = false, _loaded = false;
  CancelToken? _cancel;
  SpeechPlayback({
    required this.api,
    required this.onError,
    required this.onLoading,
    required this.onPlaybackStart,
    required this.onStop,
    SpeechAudio Function()? createAudio,
  }) : createAudio = createAudio ?? NativeSpeechAudio.new;
  void update() {
    if (!disposed) notifyListeners();
  }

  SpeechAudio get audio {
    if (_audio == null) {
      _audio = createAudio();
      subscriptions.add(
        _audio!.position.listen((value) {
          position = value;
          update();
        }),
      );
      subscriptions.add(
        _audio!.duration.listen((value) {
          duration = value;
          update();
        }),
      );
    }
    return _audio!;
  }

  Future<void> pause() async {
    if (state == SpeechState.idle || state == SpeechState.ended) return;
    _paused = true;
    state = SpeechState.paused;
    update();
    await _audio?.pause();
  }

  Future<void> resume() async {
    if (active != this) await active?.pause();
    active = this;
    _paused = false;
    state = _loaded ? SpeechState.playing : SpeechState.loading;
    update();
    if (_loaded) await _audio?.resume();
  }

  Future<void> stop() async {
    _run++;
    _cancel?.cancel();
    _cancel = null;
    if (active == this) active = null;
    _paused = false;
    _loaded = false;
    state = SpeechState.idle;
    position = Duration.zero;
    duration = Duration.zero;
    onStop();
    update();
    await _audio?.stop();
  }

  Future<void> start(
    String text,
    String requestedVoice, {
    bool replay = false,
  }) async {
    final chunks = splitSpeechText(text);
    if (chunks.isEmpty) {
      onError(ApiFailure('没有可朗读的内容'));
      return;
    }
    final reuse = replay && text == content && requestedVoice == voice;
    final stopping = stop();
    final intent = _run;
    await stopping;
    if (disposed || intent != _run) return;
    if (active != this) await active?.pause();
    if (disposed || intent != _run) return;
    active = this;
    content = text;
    voice = requestedVoice;
    if (!reuse) buffers.clear();
    final run = ++_run, token = CancelToken();
    _cancel = token;
    chunkCount = chunks.length;
    chunkIndex = 1;
    state = SpeechState.loading;
    onLoading();
    update();
    try {
      for (var i = 0; i < chunks.length; i++) {
        if (token.isCancelled || run != _run || disposed) return;
        chunkIndex = i + 1;
        _loaded = false;
        position = Duration.zero;
        duration = Duration.zero;
        if (!_paused) state = SpeechState.loading;
        update();
        if (i >= buffers.length) {
          final response = await api.raw(
            'POST',
            '/api/speech',
            body: {'content': chunks[i], 'voice': voice},
            cancel: token,
            type: ResponseType.bytes,
          );
          if (token.isCancelled || run != _run || disposed) return;
          buffers.add(Uint8List.fromList((response.data as List).cast<int>()));
        }
        final done = Completer<void>();
        final listener = audio.completed.listen((_) {
          if (!done.isCompleted) done.complete();
        });
        try {
          await audio.load(buffers[i]);
          if (token.isCancelled || run != _run || disposed) return;
          _loaded = true;
          if (!_paused) await audio.resume();
          if (token.isCancelled || run != _run || disposed) return;
          state = _paused ? SpeechState.paused : SpeechState.playing;
          onPlaybackStart();
          update();
          await Future.any([done.future, token.whenCancel]);
        } finally {
          await listener.cancel();
        }
      }
      if (run == _run && !disposed && !token.isCancelled) {
        state = SpeechState.ended;
        position = duration;
        if (active == this) active = null;
        update();
      }
    } catch (error) {
      if (run == _run && !disposed && !token.isCancelled) {
        await stop();
        onError(error is ApiFailure ? error : ApiFailure('语音播放失败，请重试'));
      }
    }
  }

  Future<void> toggle(String text, String requestedVoice) async {
    switch (state) {
      case SpeechState.loading:
        await stop();
      case SpeechState.playing:
        await pause();
      case SpeechState.paused:
        await resume();
      case SpeechState.ended:
        await start(text, requestedVoice, replay: true);
      case SpeechState.idle:
        await start(text, requestedVoice);
    }
  }

  @override
  void dispose() {
    disposed = true;
    _run++;
    _cancel?.cancel();
    if (active == this) active = null;
    for (final sub in subscriptions) {
      sub.cancel();
    }
    _audio?.dispose();
    super.dispose();
  }
}
