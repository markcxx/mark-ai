import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../shared/models/chat.dart';
import '../storage/local_store.dart';

class ApiFailure implements Exception {
  final String message;
  final int? status;
  ApiFailure(this.message, [this.status]);
  @override
  String toString() => message;
}

/// The same-origin client is deliberately separate from presigned uploads.
/// Authentication cookies must never be forwarded to external object storage.
class ApiClient {
  final LocalStore storage;
  final Dio dio;
  String baseUrl = '';
  String? _authOrigin;
  final Map<String, Cookie> _cookies = {};
  bool _cookiesDirty = false;
  Future<void> _cookieWrites = Future.value();
  Future<void>? _pendingCookieWrite;
  String? _pendingCookieValue;
  ApiClient(this.storage, {Dio? dio}) : dio = dio ?? Dio();
  Future<void> configure(String url) async {
    final uri = Uri.tryParse(url.trim());
    if (uri == null ||
        !['http', 'https'].contains(uri.scheme) ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        (uri.path.isNotEmpty && uri.path != '/')) {
      throw ApiFailure('请输入完整的服务地址，例如 https://你的域名');
    }
    baseUrl = uri.origin;
    // Android's emulator routes 10.0.2.2 to the host loopback. It is a
    // transport alias, while the development auth service is localhost.
    // Production requests keep their actual origin; never disable server CSRF.
    _authOrigin = kDebugMode && uri.scheme == 'http' && uri.host == '10.0.2.2'
        ? uri.replace(host: 'localhost').origin
        : uri.origin;
    dio.options = BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(minutes: 3),
      followRedirects: false,
      validateStatus: (_) => true,
    );
    _cookies.clear();
    _cookiesDirty = false;
    _pendingCookieWrite = null;
    _pendingCookieValue = null;
    final saved = await storage.read('cookies:$baseUrl');
    for (final raw in (saved['values'] as List? ?? [])) {
      try {
        final c = Cookie.fromSetCookieValue(raw as String);
        _cookies[c.name] = c;
      } catch (_) {
        /* Ignore obsolete cookie records. */
      }
    }
  }

  Map<String, String> get headers {
    final now = DateTime.now();
    return {
      'Origin': _authOrigin ?? baseUrl,
      'Accept': 'application/json',
      'Cookie': _cookies.values
          .where(
            (c) =>
                (c.expires == null || c.expires!.isAfter(now)) &&
                (!c.secure || baseUrl.startsWith('https:')),
          )
          .map((c) => '${c.name}=${c.value}')
          .join('; '),
    };
  }

  Future<void> _receiveCookies(Response<dynamic> response) async {
    var changed = false;
    for (final raw in response.headers['set-cookie'] ?? <String>[]) {
      final cookie = Cookie.fromSetCookieValue(raw);
      if (cookie.maxAge != null) {
        cookie.expires = DateTime.now().add(Duration(seconds: cookie.maxAge!));
      }
      if (cookie.maxAge == 0 || cookie.value.isEmpty) {
        changed = _cookies.remove(cookie.name) != null || changed;
      } else {
        changed =
            _cookies[cookie.name]?.toString() != cookie.toString() || changed;
        _cookies[cookie.name] = cookie;
      }
    }
    _cookiesDirty = _cookiesDirty || changed;
    if (!_cookiesDirty) return;
    final key = 'cookies:$baseUrl';
    final values = _cookies.values.map((c) => c.toString()).toList();
    final signature = jsonEncode(values);
    if (_pendingCookieValue == signature && _pendingCookieWrite != null) {
      return _pendingCookieWrite!;
    }
    // Initial requests may arrive together. Share identical writes and order
    // changed snapshots so an older encryption write cannot win the race.
    final task = _cookieWrites
        .catchError((_) {})
        .then((_) => storage.write(key, {'values': values}));
    late final Future<void> saving;
    saving = task
        .then((_) {
          if (identical(_pendingCookieWrite, saving)) _cookiesDirty = false;
        })
        .whenComplete(() {
          if (identical(_pendingCookieWrite, saving)) {
            _pendingCookieWrite = null;
            _pendingCookieValue = null;
          }
        });
    _pendingCookieValue = signature;
    _pendingCookieWrite = saving;
    _cookieWrites = saving;
    return saving;
  }

  Future<Response<dynamic>> raw(
    String method,
    String path, {
    dynamic body,
    CancelToken? cancel,
    ResponseType type = ResponseType.json,
    bool allowDownloadRedirect = false,
    Map<String, String>? extraHeaders,
  }) async {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw ApiFailure('请求地址无效');
    }
    try {
      final response = await dio.request<dynamic>(
        path,
        data: body,
        cancelToken: cancel,
        options: Options(
          method: method,
          headers: {...headers, ...?extraHeaders},
          responseType: type,
        ),
      );
      await _receiveCookies(response);
      if (allowDownloadRedirect &&
          [302, 303, 307, 308].contains(response.statusCode)) {
        return response;
      }
      if ((response.statusCode ?? 500) >= 300) {
        dynamic data = response.data;
        if (data is List<int>) {
          data = utf8.decode(data, allowMalformed: true);
        }
        if (data is ResponseBody) data = await utf8.decodeStream(data.stream);
        if (data is String) {
          try {
            data = jsonDecode(data);
          } catch (_) {
            data = {};
          }
        }
        final error = jsonMap(data)['error'];
        final code = jsonMap(data)['code'];
        throw ApiFailure(
          code == 'INVALID_ORIGIN' || code == 'MISSING_OR_NULL_ORIGIN'
              ? '服务地址与认证域名不一致，请使用与网页相同的服务地址，或检查服务端 APP_URL 配置'
              : response.statusCode == 401 && path == '/api/auth/sign-in/email'
              ? '邮箱或密码不正确'
              : response.statusCode == 401 || response.statusCode == 307
              ? '登录已失效，请重新登录'
              : error is String
              ? error
              : jsonMap(error)['message'] as String? ??
                    jsonMap(data)['message'] as String? ??
                    '请求失败，请稍后重试',
          response.statusCode,
        );
      }
      return response;
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) rethrow;
      throw ApiFailure('连接失败，请检查网络和服务地址');
    }
  }

  Future<Json> request(
    String method,
    String path, {
    dynamic body,
    CancelToken? cancel,
  }) async =>
      jsonMap((await raw(method, path, body: body, cancel: cancel)).data);
  Future<void> clearLogin() async {
    _cookies.clear();
    _cookiesDirty = false;
    _pendingCookieWrite = null;
    _pendingCookieValue = null;
    final key = 'cookies:$baseUrl';
    final task = _cookieWrites
        .catchError((_) {})
        .then((_) => storage.remove(key));
    _cookieWrites = task;
    await task;
  }

  Stream<Json> chat(Json body, CancelToken cancel) async* {
    final response = await raw(
      'POST',
      '/api/chat',
      body: body,
      cancel: cancel,
      type: ResponseType.stream,
    );
    final stream = (response.data as ResponseBody).stream.cast<List<int>>();
    if (response.headers
            .value('content-type')
            ?.contains('application/x-ndjson') !=
        true) {
      await for (final text in stream.transform(utf8.decoder)) {
        yield {'type': 'content', 'text': text};
      }
      return;
    }
    yield* decodeChatStream(stream);
  }
}

Stream<Json> decodeChatStream(Stream<List<int>> stream) async* {
  await for (final line
      in stream.transform(utf8.decoder).transform(const LineSplitter())) {
    if (line.trim().isEmpty) continue;
    try {
      final value = jsonDecode(line);
      if (value is! Map || value['type'] is! String) {
        throw const FormatException();
      }
      yield jsonMap(value);
    } on FormatException {
      throw ApiFailure('回复数据格式异常，请重新生成');
    }
  }
}
