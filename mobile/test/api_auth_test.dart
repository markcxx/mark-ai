import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/core/network/api_client.dart';
import 'package:markai_mobile/features/chat/application/workspace_controller.dart';

import 'support/fake_workspace.dart';

void main() {
  test('logout sends JSON and clears durable authentication', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final origin = 'http://127.0.0.1:${server.port}';
    final storage = MemoryStore();
    await storage.write('cookies:$origin', {
      'values': ['better-auth.session_token=test-session; Path=/; HttpOnly'],
    });
    final api = ApiClient(storage);
    final restarted = ApiClient(storage);
    final controller = WorkspaceController(api, storage);
    var signedOut = false;
    server.listen((request) async {
      expect(request.method, 'POST');
      expect(request.uri.path, '/api/auth/sign-out');
      expect(request.headers.value('origin'), origin);
      expect(request.headers.contentType?.mimeType, 'application/json');
      expect(
        request.headers.value('cookie'),
        contains('better-auth.session_token=test-session'),
      );
      request.response.headers.contentType = ContentType.json;
      try {
        final body = jsonDecode(await utf8.decoder.bind(request).join());
        expect(body, isEmpty);
        signedOut = true;
        request.response.cookies.add(
          Cookie('better-auth.session_token', '')
            ..path = '/'
            ..maxAge = 0,
        );
        request.response.write('{"success":true}');
      } on FormatException {
        request.response.statusCode = 400;
        request.response.write(
          '{"code":"INVALID_JSON","message":"Malformed JSON request body"}',
        );
      }
      await request.response.close();
    });
    try {
      await api.configure(origin);
      controller.user = {'id': 'fixture'};
      controller.draft = 'private draft';
      await controller.logout();
      expect(signedOut, isTrue);
      expect(controller.guest, isTrue);
      expect(controller.user, isEmpty);
      expect(controller.draft, isEmpty);
      expect(api.headers['Cookie'], isEmpty);
      expect(await storage.read('cookies:$origin'), isEmpty);
      await restarted.configure(origin);
      expect(restarted.headers['Cookie'], isEmpty);
    } finally {
      controller.dispose();
      api.dio.close(force: true);
      restarted.dio.close(force: true);
      await server.close(force: true);
    }
  });

  test(
    'binary speech and download requests preserve JSON error details',
    () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final api = ApiClient(MemoryStore());
      server.listen((request) async {
        request.response.statusCode = 400;
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode({'error': '所选音色不可用，请重新选择'}));
        await request.response.close();
      });
      try {
        await api.configure('http://127.0.0.1:${server.port}');
        await expectLater(
          api.raw('POST', '/api/speech', type: ResponseType.bytes),
          throwsA(
            isA<ApiFailure>().having(
              (e) => e.message,
              'message',
              '所选音色不可用，请重新选择',
            ),
          ),
        );
      } finally {
        api.dio.close(force: true);
        await server.close(force: true);
      }
    },
  );
  test(
    'emulator loopback keeps the canonical development auth origin',
    () async {
      final api = ApiClient(MemoryStore());
      await api.configure('http://10.0.2.2:3000');
      expect(api.baseUrl, 'http://10.0.2.2:3000');
      expect(api.headers['Origin'], 'http://localhost:3000');
      await api.configure('https://markai.example');
      expect(api.headers['Origin'], 'https://markai.example');
    },
  );

  test(
    'real HTTP login cookie survives session verification and client restart',
    () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final origin = 'http://127.0.0.1:${server.port}';
      final storage = MemoryStore();
      final paths = <String>[];
      server.listen((request) async {
        paths.add(request.uri.path);
        request.response.headers.contentType = ContentType.json;
        if (request.headers.value('origin') != origin) {
          request.response.statusCode = 403;
          request.response.write(jsonEncode({'code': 'INVALID_ORIGIN'}));
        } else if (request.uri.path == '/api/auth/sign-in/email') {
          final body = jsonDecode(await utf8.decoder.bind(request).join());
          expect(body['email'], 'fixture@example.invalid');
          request.response.cookies.add(
            Cookie('better-auth.session_token', 'test-session')
              ..httpOnly = true
              ..path = '/',
          );
          request.response.write(
            jsonEncode({
              'user': {'id': 'fixture'},
            }),
          );
        } else if (request.cookies.any(
          (c) =>
              c.name == 'better-auth.session_token' &&
              c.value == 'test-session',
        )) {
          request.response.write(
            jsonEncode({
              'user': {'id': 'fixture'},
            }),
          );
        } else {
          request.response.statusCode = 401;
          request.response.write(jsonEncode({'error': '请先登录'}));
        }
        await request.response.close();
      });
      final api = ApiClient(storage);
      final restarted = ApiClient(storage);
      try {
        await api.configure(origin);
        await api.request(
          'POST',
          '/api/auth/sign-in/email',
          body: {
            'email': 'fixture@example.invalid',
            'password': 'fixture-only',
          },
        );
        expect(
          (await api.request('GET', '/api/auth/get-session'))['user']['id'],
          'fixture',
        );
        await restarted.configure(origin);
        expect(
          (await restarted.request('GET', '/api/models'))['user']['id'],
          'fixture',
        );
        expect(paths, [
          '/api/auth/sign-in/email',
          '/api/auth/get-session',
          '/api/models',
        ]);
      } finally {
        api.dio.close(force: true);
        restarted.dio.close(force: true);
        await server.close(force: true);
      }
    },
  );
}
