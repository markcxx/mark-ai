import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/core/network/api_client.dart';
import 'package:markai_mobile/core/network/client_identity.dart';

import 'support/fake_workspace.dart';

class NetworkTestBinding extends AutomatedTestWidgetsFlutterBinding {
  @override
  bool get overrideHttpClient => false;
}

void main() {
  NetworkTestBinding();
  const channel = MethodChannel('markai/updates');
  setUp(() => debugDefaultTargetPlatformOverride = TargetPlatform.android);
  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test(
    'Android login and authenticated requests report installed version',
    () async {
      var infoCalls = 0;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
            expect(call.method, 'info');
            infoCalls++;
            return {'versionName': '1.0.8', 'versionCode': 1000008};
          });
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final api = ApiClient(MemoryStore());
      final received = <String>[];
      server.listen((request) async {
        expect(request.headers.value('x-markai-platform'), 'android');
        expect(request.headers.value('x-markai-app-version'), '1.0.8');
        received.add(request.uri.path);
        request.response.headers.contentType = ContentType.json;
        request.response.write('{}');
        await request.response.close();
      });
      try {
        await api.configure('http://127.0.0.1:${server.port}');
        await api.request('POST', '/api/auth/sign-in/email', body: {});
        await api.request('GET', '/api/models');
        await api.request('POST', '/api/auth/sign-out', body: {});
        expect(received, hasLength(3));
        expect(infoCalls, 1);
      } finally {
        api.dio.close(force: true);
        await server.close(force: true);
      }
    },
  );

  test(
    'missing native version keeps Android identity without blocking requests',
    () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            channel,
            (_) async => throw PlatformException(code: 'unavailable'),
          );
      expect(await loadClientIdentityHeaders(), {
        'X-MarkAI-Platform': 'android',
      });
      debugDefaultTargetPlatformOverride = TargetPlatform.linux;
      expect(await loadClientIdentityHeaders(), isEmpty);
    },
  );
}
