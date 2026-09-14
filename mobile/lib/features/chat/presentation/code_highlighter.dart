import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/models/code_themes.dart';

typedef HighlightBackend = Future<Json> Function(
  String code,
  String language,
  String theme,
);

/// Shared, bounded cache. Each key includes the theme as well as source/language.
class HighlightService {
  final HighlightBackend backend;
  HighlightService(this.backend);
  final _pending = <(String, String, String), Future<Json>>{};
  final _cache = <(String, String, String), Json>{};
  int _characters = 0;
  static const _maxCharacters = 256 * 1024;

  Future<Json> highlight(String code, String language, String theme) {
    final key = (code, language, theme);
    final cached = _cache.remove(key);
    if (cached != null) {
      _cache[key] = cached;
      return Future.value(cached);
    }
    return _pending[key] ??= _highlight(key);
  }

  Future<Json> _highlight((String, String, String) key) async {
    try {
      final result = await backend(key.$1, key.$2, key.$3);
      if (key.$1.length <= _maxCharacters) {
        _cache[key] = result;
        _characters += key.$1.length;
        while (_cache.length > 32 || _characters > _maxCharacters) {
          final oldest = _cache.keys.first;
          _characters -= oldest.$1.length;
          _cache.remove(oldest);
        }
      }
      return result;
    } finally {
      _pending.remove(key);
    }
  }
}

class CodeHighlighter {
  static final _runtime = _ShikiRuntime();
  static final _service = HighlightService(_runtime.highlight);
  static Future<Json> highlight(String code, String language, String theme) =>
      _service.highlight(code, language, theme);
}

/// One lazily created local WebView runs the same Oniguruma WASM as Web Shiki.
/// Only tokens cross the bridge; Flutter still renders/selects/copies the code.
class _ShikiRuntime {
  WebViewController? _web;
  Future<void>? _ready;
  Future<void> _queue = Future.value();
  Timer? _idle;
  final _languages = <String>{}, _themes = <String>{};

  Future<void> _start() async {
    final ready = Completer<void>();
    final web = WebViewController();
    _web = web;
    await web.setJavaScriptMode(JavaScriptMode.unrestricted);
    await web.setNavigationDelegate(
      NavigationDelegate(
        onNavigationRequest: (_) => NavigationDecision.prevent,
      ),
    );
    await web.addJavaScriptChannel(
      'MarkAIHighlightReady',
      onMessageReceived: (message) {
        if (ready.isCompleted) return;
        if (message.message == 'ready') {
          ready.complete();
        } else {
          ready.completeError(StateError('代码着色资源加载失败'));
        }
      },
    );
    final source = await rootBundle.loadString(
      'assets/web/code-highlighter.js',
    );
    await web.loadHtmlString('''<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'">
<script>${source.replaceAll('</script', r'<\/script')}</script>''');
    await ready.future.timeout(const Duration(seconds: 20));
  }

  Future<Json> highlight(String code, String language, String theme) {
    _idle?.cancel();
    final task = _queue.then((_) => _highlight(code, language, theme));
    _queue = task.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    final currentQueue = _queue;
    unawaited(
      currentQueue.then((_) {
        if (!identical(_queue, currentQueue)) return;
        _idle = Timer(const Duration(seconds: 30), () {
          // Drop the controller and native runtime after all pending work finishes.
          unawaited(_web?.loadHtmlString('') ?? Future.value());
          _web = null;
          _ready = null;
          _languages.clear();
          _themes.clear();
        });
      }),
    );
    return task;
  }

  Future<Json> _highlight(String code, String language, String theme) async {
    try {
      await (_ready ??= _start());
    } catch (_) {
      _web = null;
      _ready = null;
      _languages.clear();
      _themes.clear();
      rethrow;
    }
    final names = codeLanguages[language] ?? const <String>[];
    final missing = names.where((name) => !_languages.contains(name)).toList();
    final grammars = await Future.wait(
      missing.map(
        (name) async => jsonDecode(
          await rootBundle.loadString('assets/web/shiki/languages/$name.json'),
        ),
      ),
    );
    final themeData = _themes.contains(theme)
        ? null
        : jsonDecode(
            await rootBundle.loadString('assets/web/shiki/themes/$theme.json'),
          );
    final result = await _web!.runJavaScriptReturningResult(
      'JSON.stringify(markaiHighlight(${jsonEncode(code)},${jsonEncode(names.isEmpty ? 'text' : language)},${jsonEncode(theme)},${jsonEncode(grammars)},${jsonEncode(themeData)}))',
    );
    // Android and WKWebView return JSON strings with different quoting.
    dynamic decoded = result is String ? jsonDecode(result) : result;
    if (decoded is String) decoded = jsonDecode(decoded);
    _languages.addAll(missing);
    _themes.add(theme);
    return jsonMap(decoded);
  }
}
