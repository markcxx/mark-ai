import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:isolate';

import 'package:flutter/services.dart';
import 'package:flutter_js/javascript_runtime.dart';
import 'package:flutter_js/javascriptcore/jscore_runtime.dart';
import 'package:flutter_js/quickjs/quickjs_runtime2.dart';

import '../../../shared/models/chat.dart';

class CodeHighlighter {
  static final _source = rootBundle.loadString(
    'assets/web/code-highlighter.js',
  );
  static Future<_HighlightWorker>? _worker;
  static Timer? _idle;
  static final _pending = <(String, String), Future<List<Json>>>{};
  static final _cache = <(String, String), List<Json>>{};
  static int _cachedCharacters = 0;
  static const _maxCachedCharacters = 256 * 1024;

  static Future<List<Json>> tokenize(String code, String language) {
    final key = (code, language);
    final cached = _cache.remove(key);
    if (cached != null) {
      _cache[key] = cached;
      return Future.value(cached);
    }
    return _pending[key] ??= _tokenize(key);
  }

  static Future<List<Json>> _tokenize((String, String) key) async {
    _idle?.cancel();
    final worker = _worker ??= _start();
    try {
      final result = await (await worker).parse(key.$1, key.$2);
      final tokens = List<Json>.unmodifiable(
        result.map(
          (token) => Map<String, dynamic>.unmodifiable({
            ...token,
            'classes': List.unmodifiable(token['classes'] as List? ?? const []),
          }),
        ),
      );
      if (key.$1.length <= _maxCachedCharacters) {
        _cache[key] = tokens;
        _cachedCharacters += key.$1.length;
        while (_cache.length > 32 || _cachedCharacters > _maxCachedCharacters) {
          final oldest = _cache.keys.first;
          _cachedCharacters -= oldest.$1.length;
          _cache.remove(oldest);
        }
      }
      return tokens;
    } catch (_) {
      try {
        final instance = await worker;
        if (instance.disposed && identical(_worker, worker)) _worker = null;
      } catch (_) {
        if (identical(_worker, worker)) _worker = null;
      }
      rethrow;
    } finally {
      _pending.remove(key);
      if (_pending.isEmpty) {
        _idle = Timer(const Duration(seconds: 30), () {
          if (identical(_worker, worker)) {
            _worker = null;
            unawaited(
              worker.then((value) => value.dispose()).catchError((_) {}),
            );
          }
        });
      }
    }
  }

  static Future<_HighlightWorker> _start() async =>
      _HighlightWorker.start(await _source);
}

/// One isolate and one grammar runtime are reused across blocks. Only bundled
/// grammar executes; source is a JSON argument with no network or native bridge.
class _HighlightWorker {
  final ReceivePort replies = ReceivePort();
  final ready = Completer<SendPort>();
  final pending = <int, Completer<List<Json>>>{};
  Isolate? isolate;
  SendPort? commands;
  int nextId = 0;
  bool disposed = false;

  static Future<_HighlightWorker> start(String source) async {
    final worker = _HighlightWorker();
    worker.replies.listen(worker.receive);
    try {
      worker.isolate = await Isolate.spawn(
        _run,
        (worker.replies.sendPort, source),
        onError: worker.replies.sendPort,
        onExit: worker.replies.sendPort,
      );
      await worker.ready.future;
      return worker;
    } catch (_) {
      worker.dispose();
      rethrow;
    }
  }

  void receive(dynamic value) {
    if (value is SendPort) {
      commands = value;
      ready.complete(value);
    } else if (value is (int, List<Json>?, String?)) {
      final task = pending.remove(value.$1);
      if (value.$3 != null) {
        task?.completeError(StateError('代码着色失败'));
      } else {
        task?.complete(value.$2!);
      }
    } else {
      dispose();
    }
  }

  Future<List<Json>> parse(String code, String language) async {
    final port = await ready.future;
    if (disposed) throw StateError('代码着色资源已释放');
    final id = nextId++;
    final task = Completer<List<Json>>();
    pending[id] = task;
    port.send((id, code, language));
    return task.future;
  }

  void dispose() {
    if (disposed) return;
    disposed = true;
    // Let the isolate release the native JS engine before it exits. Killing a
    // warm isolate directly can strand native allocations outside Dart's heap.
    if (commands != null) {
      commands!.send(null);
    } else {
      isolate?.kill(priority: Isolate.immediate);
    }
    replies.close();
    final error = StateError('代码着色资源已释放');
    if (!ready.isCompleted) ready.completeError(error);
    for (final task in pending.values) {
      task.completeError(error);
    }
    pending.clear();
  }

  static void _run((SendPort, String) input) {
    final JavascriptRuntime engine =
        Platform.isAndroid || Platform.isLinux || Platform.isWindows
        ? QuickJsRuntime2(timeout: 3000)
        : JavascriptCoreRuntime();
    final loaded = engine.evaluate(input.$2);
    if (loaded.isError) {
      engine.dispose();
      throw StateError('代码着色规则加载失败');
    }
    final requests = ReceivePort();
    input.$1.send(requests.sendPort);
    requests.listen((dynamic message) {
      if (message == null) {
        engine.dispose();
        requests.close();
        return;
      }
      final (id, code, language) = message as (int, String, String);
      try {
        final value = engine.evaluate(
          'JSON.stringify(markaiTokens(${jsonEncode(code)},${jsonEncode(language)}))',
        );
        if (value.isError) throw StateError('代码着色失败');
        input.$1.send((id, jsonList(jsonDecode(value.stringResult)), null));
      } catch (_) {
        input.$1.send((id, null, '代码着色失败'));
      }
    });
  }
}
