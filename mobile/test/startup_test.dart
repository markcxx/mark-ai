import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/core/network/api_client.dart';
import 'package:markai_mobile/core/network/app_endpoint.dart';
import 'package:markai_mobile/features/auth/guest_screen.dart';
import 'package:markai_mobile/features/auth/startup_screen.dart';
import 'package:markai_mobile/features/chat/application/workspace_controller.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/shared/models/chat.dart';
import 'package:markai_mobile/shared/widgets/agent_avatar.dart';

import 'support/fake_workspace.dart';

class StartupApi extends FakeApi {
  Completer<void>? gate;
  bool fail = false, cloud = true;
  StartupApi(super.store);

  @override
  Future<void> configure(String url) async => baseUrl = url;

  @override
  Future<Json> request(
    String method,
    String path, {
    dynamic body,
    CancelToken? cancel,
  }) async {
    if (path == '/api/public/mobile-config') {
      await gate?.future;
      if (fail) {
        throw ApiFailure('Failed connecting to https://private.invalid');
      }
      return {'cloudMode': cloud, 'protocolVersion': 1};
    }
    return super.request(method, path, body: body, cancel: cancel);
  }
}

void main() {
  test('release endpoint ignores runtime overrides', () {
    expect(appApiUrl, 'https://chatai.markqq.com');
    expect(
      resolveAppEndpoint('http://10.0.2.2:3000', release: true),
      appApiUrl,
    );
    expect(
      resolveAppEndpoint('http://localhost:3000', release: false),
      'http://localhost:3000',
    );
  });

  test('saved development address cannot override compiled endpoint', () async {
    final store = MemoryStore();
    await store.write('connection', {'url': 'http://10.0.2.2:3000'});
    final api = StartupApi(store);
    final c = WorkspaceController(api, store);
    await c.start();
    expect(api.baseUrl, appApiUrl);
    expect(c.connected, isTrue);
    expect(c.guest, isTrue);
    c.dispose();
  });

  testWidgets(
    'startup never shows address form; failure retries without raw URL',
    (tester) async {
      await tester.runAsync(AgentAvatar.preload);
      final store = MemoryStore();
      final api = StartupApi(store)..gate = Completer<void>();
      final c = WorkspaceController(api, store);
      await tester.pumpWidget(MarkAIApp(controller: c));
      expect(find.byType(StartupScreen), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
      expect(find.textContaining('https://'), findsNothing);
      api.fail = true;
      api.gate!.complete();
      await tester.pumpAndSettle();
      expect(find.text('重试'), findsOneWidget);
      expect(find.textContaining('private.invalid'), findsNothing);
      expect(c.error, isNull);
      api.fail = false;
      await tester.tap(find.text('重试'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pump();
      expect(find.byType(GuestScreen), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      c.dispose();
    },
  );
}
