import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_js/javascript_runtime.dart';
import 'package:flutter_js/javascriptcore/jscore_runtime.dart';
import 'package:flutter_js/quickjs/quickjs_runtime2.dart';

import '../../../shared/models/chat.dart';

class CodeHighlighter {
  static final _source = rootBundle.loadString(
    'assets/web/code-highlighter.js',
  );
  static Future<List<Json>> tokenize(String code, String language) async =>
      compute(_parse, [await _source, code, language]);
  static List<Json> _parse(List<String> input) {
    // Only the bundled grammar executes. Message text is a JSON string argument.
    // No fetch bridge, DOM, filesystem API, or account credentials enter this engine.
    final JavascriptRuntime engine =
        Platform.isAndroid || Platform.isLinux || Platform.isWindows
        // The Android binary shipped by flutter_js does not export
        // jsSetMemoryLimit. Keep its supported execution timeout instead.
        ? QuickJsRuntime2(timeout: 3000)
        : JavascriptCoreRuntime();
    try {
      final loaded = engine.evaluate(input[0]);
      if (loaded.isError) throw StateError('代码着色规则加载失败：${loaded.stringResult}');
      final value = engine.evaluate(
        'JSON.stringify(markaiTokens(${jsonEncode(input[1])},${jsonEncode(input[2])}))',
      );
      if (value.isError) throw StateError('代码着色失败');
      return jsonList(jsonDecode(value.stringResult));
    } finally {
      engine.dispose();
    }
  }
}
