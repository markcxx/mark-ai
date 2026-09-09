import 'dart:async';
import 'dart:math';

/// Uses the same adaptive rates as lib/chat/client/streaming.ts. Rune boundaries
/// keep surrogate pairs intact when the server sends emoji in large chunks.
class SmoothTextBuffer {
  final void Function(String) commit;
  SmoothTextBuffer(this.commit);
  final List<int> _queue = [];
  Timer? _timer;
  double _carry = 0;
  bool _finishing = false;
  Completer<void>? _done;
  void push(String text) {
    _queue.addAll(text.runes);
    _timer ??= Timer.periodic(const Duration(milliseconds: 16), (_) {
      final speed = min(
        1600,
        max(_finishing ? 120 : 48, _queue.length * (_finishing ? 10 : 5)),
      );
      _carry += .016 * speed;
      final count = min(_queue.length, _carry.floor());
      if (count > 0) {
        commit(String.fromCharCodes(_queue.take(count)));
        _queue.removeRange(0, count);
        _carry -= count;
      }
      if (_queue.isEmpty) _settle();
    });
  }

  void _settle() {
    _timer?.cancel();
    _timer = null;
    _carry = 0;
    _done?.complete();
    _done = null;
  }

  void flush() {
    if (_queue.isNotEmpty) {
      commit(String.fromCharCodes(_queue));
      _queue.clear();
    }
    _settle();
  }

  Future<void> finish() {
    _finishing = true;
    if (_queue.isEmpty) return Future.value();
    _done ??= Completer<void>();
    return _done!.future;
  }
}
