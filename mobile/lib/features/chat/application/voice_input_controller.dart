import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

abstract interface class SpeechInputBackend {
  Stream<Map<String, dynamic>> get events;
  Future<void> start(String session);
  Future<void> stop(String session);
  Future<void> cancel(String session);
}

class AndroidSpeechInput implements SpeechInputBackend {
  static const methods = MethodChannel('markai/speech_input');
  static const channel = EventChannel('markai/speech_input/events');
  @override
  Stream<Map<String, dynamic>> get events => channel
      .receiveBroadcastStream()
      .map((event) => Map<String, dynamic>.from(event as Map));
  @override
  Future<void> start(String session) =>
      methods.invokeMethod('start', {'session': session});
  @override
  Future<void> stop(String session) =>
      methods.invokeMethod('stop', {'session': session});
  @override
  Future<void> cancel(String session) =>
      methods.invokeMethod('cancel', {'session': session});
}

enum VoiceInputPhase { idle, starting, listening, finishing, ready }

class VoiceInputController extends ChangeNotifier {
  static int _nextSession = 0;
  final SpeechInputBackend backend;
  final ValueChanged<String> onText;
  final ValueChanged<String> onError;
  late final StreamSubscription<Map<String, dynamic>> _events;
  VoiceInputController({
    required this.backend,
    required this.onText,
    required this.onError,
  }) {
    _events = backend.events.listen(
      _event,
      onError: (_) {
        if (active) _fail('系统语音识别连接已中断，请重试');
      },
    );
  }

  VoiceInputPhase phase = VoiceInputPhase.idle;
  bool cancelArmed = false, _holding = false, _disposed = false;
  String text = '';
  String? _session;
  Timer? _timeout;
  double _level = 0;
  final List<double> levels = List.filled(48, 0, growable: true);
  bool get active => phase != VoiceInputPhase.idle;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<void> start() async {
    if (active || _disposed) return;
    final session =
        '${DateTime.now().microsecondsSinceEpoch}:${++_nextSession}';
    _session = session;
    _holding = true;
    cancelArmed = false;
    text = '';
    _level = 0;
    levels.fillRange(0, levels.length, 0);
    phase = VoiceInputPhase.starting;
    _notify();
    _timeout = Timer(
      const Duration(seconds: 12),
      () => _fail('语音服务未响应，请检查系统语音识别设置'),
    );
    try {
      await backend.start(session);
    } catch (error) {
      if (_session != session || _disposed) return;
      _fail(
        error is PlatformException && error.message != null
            ? error.message!
            : '此设备无法使用系统语音识别，请检查系统语音服务',
      );
    }
  }

  void move(double verticalOffset) {
    if (!active || !_holding) return;
    final next = verticalOffset <= -72;
    if (next != cancelArmed) {
      cancelArmed = next;
      _notify();
    }
  }

  Future<void> release() async {
    if (!active) return;
    _holding = false;
    if (cancelArmed || phase == VoiceInputPhase.starting) {
      cancel();
      return;
    }
    if (phase == VoiceInputPhase.ready) {
      _submit();
      return;
    }
    if (phase != VoiceInputPhase.finishing) await _finish();
  }

  Future<void> _finish() async {
    final session = _session;
    if (session == null ||
        phase == VoiceInputPhase.finishing ||
        phase == VoiceInputPhase.ready) {
      return;
    }
    phase = VoiceInputPhase.finishing;
    _timeout?.cancel();
    _timeout = Timer(const Duration(seconds: 10), () => _fail('识别等待超时，请重新输入'));
    _notify();
    try {
      await backend.stop(session);
    } catch (_) {
      if (_session == session) _fail('无法完成语音识别，请重试');
    }
  }

  void _event(Map<String, dynamic> event) {
    if (_disposed || _session == null || event['session'] != _session) return;
    switch (event['type']) {
      case 'ready':
        if (phase != VoiceInputPhase.starting) return;
        phase = VoiceInputPhase.listening;
        _timeout?.cancel();
        _timeout = Timer(const Duration(seconds: 60), _finish);
      case 'level':
        final value = event['value'];
        if (phase != VoiceInputPhase.listening ||
            value is! num ||
            !value.isFinite) {
          return;
        }
        _level =
            _level * .45 + ((value.toDouble() + 2) / 12).clamp(0.0, 1.0) * .55;
        levels.removeAt(0);
        levels.add(_level);
      case 'partial':
        text = (event['value'] as String? ?? '').trim();
      case 'end':
        if (phase != VoiceInputPhase.finishing) {
          phase = VoiceInputPhase.finishing;
          _timeout?.cancel();
          _timeout = Timer(
            const Duration(seconds: 10),
            () => _fail('识别等待超时，请重新输入'),
          );
        }
      case 'final':
        _timeout?.cancel();
        text = (event['value'] as String? ?? '').trim();
        phase = VoiceInputPhase.ready;
        if (!_holding) {
          _submit();
          return;
        }
      case 'error':
        _fail(event['value'] as String? ?? '语音识别失败，请重试');
        return;
    }
    _notify();
  }

  void _submit() {
    final value = text;
    cancel(); // Invalidate the session before invoking any application mutation.
    if (value.isEmpty) {
      onError('没有听清，请再次长按说话');
      return;
    }
    onText(value);
  }

  void _fail(String message) {
    if (!active || _disposed) return;
    final suppress = cancelArmed;
    cancel();
    if (!suppress) onError(message);
  }

  void cancel() {
    final session = _session;
    _session = null;
    _holding = false;
    phase = VoiceInputPhase.idle;
    _timeout?.cancel();
    if (session != null) unawaited(backend.cancel(session).catchError((_) {}));
    _notify();
  }

  @override
  void dispose() {
    _disposed = true;
    cancel();
    unawaited(_events.cancel());
    super.dispose();
  }
}
