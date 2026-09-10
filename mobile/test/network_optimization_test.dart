import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/core/network/api_client.dart';
import 'package:markai_mobile/features/previews/file_service.dart';
import 'package:markai_mobile/shared/models/chat.dart';

import 'support/fake_workspace.dart';

class CountingStore extends MemoryStore {
  int writes = 0;
  Completer<void>? gate;
  @override
  Future<void> write(String key, Json value) async {
    writes++;
    await gate?.future;
    await super.write(key, value);
  }
}

void main() {
  test(
    'concurrent identical cookie responses share one durable write',
    () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final store = CountingStore()..gate = Completer<void>();
      final api = ApiClient(store);
      var received = 0;
      server.listen((request) async {
        received++;
        request.response.headers.contentType = ContentType.json;
        request.response.cookies.add(Cookie('session', 'fixture'));
        request.response.write('{}');
        await request.response.close();
      });
      try {
        await api.configure('http://127.0.0.1:${server.port}');
        final requests = Future.wait(
          List.generate(5, (_) => api.request('GET', '/cookie')),
        );
        for (var i = 0; i < 1000 && (received < 5 || store.writes == 0); i++) {
          await Future<void>.delayed(const Duration(milliseconds: 1));
        }
        await Future<void>.delayed(const Duration(milliseconds: 20));
        expect(received, 5);
        expect(store.writes, 1);
        store.gate!.complete();
        await requests;
        expect(store.writes, 1);
        await api.clearLogin();
        expect(await store.read('cookies:${api.baseUrl}'), isEmpty);
      } finally {
        if (!store.gate!.isCompleted) store.gate!.complete();
        api.dio.close(force: true);
        await server.close(force: true);
      }
    },
  );
  test('cookie storage only changes when the server changes cookies', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final store = CountingStore();
    final api = ApiClient(store);
    server.listen((request) async {
      request.response.headers.contentType = ContentType.json;
      if (request.uri.path == '/cookie') {
        request.response.cookies.add(Cookie('session', 'fixture')..path = '/');
      } else if (request.uri.path == '/logout') {
        request.response.cookies.add(Cookie('session', '')..maxAge = 0);
      }
      request.response.write('{}');
      await request.response.close();
    });
    try {
      await api.configure('http://127.0.0.1:${server.port}');
      await api.request('GET', '/plain');
      expect(store.writes, 0);
      await api.request('GET', '/cookie');
      expect(store.writes, 1);
      await api.request('GET', '/cookie');
      await api.request('GET', '/plain');
      expect(store.writes, 1);
      await api.request('GET', '/logout');
      expect(store.writes, 2);
      final restarted = ApiClient(store);
      await restarted.configure(api.baseUrl);
      expect(restarted.headers['Cookie'], isEmpty);
      restarted.dio.close(force: true);
    } finally {
      api.dio.close(force: true);
      await server.close(force: true);
    }
  });

  test(
    'streamed sharing downloads preserve bytes without forwarding cookies',
    () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final remote = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final directory = await Directory.systemTemp.createTemp(
        'markai-download-test-',
      );
      final api = ApiClient(MemoryStore());
      final payload = utf8.encode('完整文件内容\n' * 10000);
      remote.listen((request) async {
        expect(request.headers.value('cookie'), isNull);
        request.response.add(payload);
        await request.response.close();
      });
      server.listen((request) async {
        if (request.uri.path == '/login') {
          request.response.headers.contentType = ContentType.json;
          request.response.cookies.add(Cookie('session', 'fixture'));
          request.response.write('{}');
        } else if (request.uri.path.contains('/redirect/')) {
          request.response.statusCode = 302;
          request.response.headers.set(
            'location',
            'http://127.0.0.1:${remote.port}/download',
          );
        } else if (request.uri.path.contains('/error/')) {
          request.response.statusCode = 403;
          request.response.headers.contentType = ContentType.json;
          request.response.write(jsonEncode({'error': '无权下载此文件'}));
        } else {
          expect(request.headers.value('cookie'), contains('session=fixture'));
          request.response.add(payload);
        }
        await request.response.close();
      });
      try {
        await api.configure('http://127.0.0.1:${server.port}');
        await api.request('POST', '/login');
        final files = FileService(api);
        for (final id in ['direct', 'redirect']) {
          final output = File('${directory.path}/$id.bin');
          await files.downloadTo({'id': id}, output);
          expect(await output.readAsBytes(), payload);
        }
        final failed = File('${directory.path}/failed.bin');
        await expectLater(
          files.downloadTo({'id': 'error'}, failed),
          throwsA(isA<ApiFailure>()),
        );
        expect(await failed.exists(), isFalse);
      } finally {
        api.dio.close(force: true);
        await server.close(force: true);
        await remote.close(force: true);
        await directory.delete(recursive: true);
      }
    },
  );
}
