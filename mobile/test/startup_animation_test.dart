import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/auth/startup_screen.dart';
import 'package:markai_mobile/features/chat/application/workspace_controller.dart';
import 'package:markai_mobile/features/chat/presentation/chat_screen.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/shared/models/chat.dart';
import 'package:markai_mobile/shared/widgets/agent_avatar.dart';

import 'support/fake_workspace.dart';

class BootApi extends FakeApi {
  BootApi(super.store);
  final modelsReady = Completer<void>(), sessionsReady = Completer<void>();
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
      return {'cloudMode': false, 'protocolVersion': 1};
    }
    if (path == '/api/models') await modelsReady.future;
    if (path.startsWith('/api/sessions?')) await sessionsReady.future;
    return super.request(method, path, body: body, cancel: cancel);
  }
}

void viewport(WidgetTester tester, double width) {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = Size(width, 844);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
}

Future<void> preload(WidgetTester tester) async {
  await tester.runAsync(() async {
    await AgentAvatar.preload();
    if (const bool.fromEnvironment('CAPTURE_STARTUP')) {
      for (final font in ['NotoSansSC', 'PlusJakartaSans']) {
        await (FontLoader(
          font == 'NotoSansSC' ? 'Noto Sans SC' : 'Plus Jakarta Sans',
        )..addFont(rootBundle.load('assets/fonts/$font.ttf'))).load();
      }
    }
  });
}

void main() {
  testWidgets(
    'ready workspace waits for the full greeting without tap skipping or replay',
    (tester) async {
      viewport(tester, 390);
      await preload(tester);
      final c = await fixtureWorkspace();
      await tester.pumpWidget(
        MarkAIApp(controller: c, autoStart: false, showStartupAnimation: true),
      );
      await tester.pump();
      expect(find.byType(ChatScreen), findsNothing);
      expect(find.text('你好，我是 MarkAI'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 1600));
      expect(find.byType(ChatScreen), findsNothing);
      await tester.tap(find.byType(AgentAvatar));
      await tester.pump(const Duration(milliseconds: 1600));
      expect(find.byType(ChatScreen), findsNothing);
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pump();
      expect(find.byType(ChatScreen), findsOneWidget);
      expect(find.byType(StartupScreen), findsNothing);
      c.setDraft('继续聊天');
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pump();
      expect(find.byType(StartupScreen), findsNothing);
      await tester.pumpWidget(const SizedBox());
      c.dispose();
    },
  );
  testWidgets('greeting completion waits for both models and history', (
    tester,
  ) async {
    await preload(tester);
    final store = MemoryStore(), api = BootApi(MemoryStore());
    final c = WorkspaceController(api, store);
    await tester.pumpWidget(MarkAIApp(controller: c));
    await tester.pump();
    await tester.pump(StartupScreen.introDuration);
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();
    expect(find.byType(ChatScreen), findsNothing);
    expect(find.text('正在连接你的工作空间…'), findsOneWidget);
    api.modelsReady.complete();
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();
    expect(find.byType(ChatScreen), findsNothing);
    api.sessionsReady.complete();
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();
    expect(find.byType(ChatScreen), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
  testWidgets('reduced motion uses a short stationary greeting', (
    tester,
  ) async {
    await preload(tester);
    final c = await fixtureWorkspace();
    c.settings['general']['reduceMotion'] = true;
    await tester.pumpWidget(
      MarkAIApp(controller: c, autoStart: false, showStartupAnimation: true),
    );
    await tester.pump();
    expect(find.byType(ChatScreen), findsNothing);
    await tester.pump(const Duration(milliseconds: 450));
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();
    expect(find.byType(StartupScreen), findsNothing);
    expect(find.byType(ChatScreen), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
  testWidgets('backgrounding pauses the greeting instead of skipping it', (
    tester,
  ) async {
    await preload(tester);
    final c = await fixtureWorkspace();
    await tester.pumpWidget(
      MarkAIApp(controller: c, autoStart: false, showStartupAnimation: true),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 900));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump(const Duration(seconds: 5));
    expect(find.byType(ChatScreen), findsNothing);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.byType(ChatScreen), findsNothing);
    await tester.pump(const Duration(milliseconds: 2000));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();
    expect(find.byType(ChatScreen), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
  testWidgets('small screen supports enlarged system text', (tester) async {
    viewport(tester, 320);
    tester.view.physicalSize = const Size(320, 568);
    tester.platformDispatcher.textScaleFactorTestValue = 1.8;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await preload(tester);
    final c = await fixtureWorkspace();
    c.connected = false;
    await tester.pumpWidget(
      MarkAIApp(controller: c, autoStart: false, showStartupAnimation: true),
    );
    await tester.pump();
    await tester.pump(StartupScreen.introDuration);
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.text('你好，我是 MarkAI'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
  for (final dark in [false, true]) {
    for (final width in [320.0, 390.0, 840.0]) {
      testWidgets('startup layout $width dark=$dark', (tester) async {
        viewport(tester, width);
        await preload(tester);
        final c = await fixtureWorkspace();
        c.connected = false;
        c.settings['general']['themeMode'] = dark ? 'dark' : 'light';
        final boundary = GlobalKey();
        await tester.pumpWidget(
          RepaintBoundary(
            key: boundary,
            child: MarkAIApp(
              controller: c,
              autoStart: false,
              showStartupAnimation: true,
            ),
          ),
        );
        await tester.pump();
        for (var i = 0; i < 37; i++) {
          await tester.pump(const Duration(milliseconds: 100));
          expect(tester.takeException(), isNull);
          if (width == 390 && const bool.fromEnvironment('CAPTURE_STARTUP')) {
            await tester.runAsync(() async {
              final directory = Directory(
                const String.fromEnvironment(
                  'SCREENSHOT_DIRECTORY',
                  defaultValue: 'qa/startup',
                ),
              );
              await directory.create(recursive: true);
              final image =
                  await (boundary.currentContext!.findRenderObject()
                          as RenderRepaintBoundary)
                      .toImage();
              final bytes = await image.toByteData(
                format: ui.ImageByteFormat.png,
              );
              await File(
                '${directory.path}/${dark ? 'dark' : 'light'}-${i.toString().padLeft(2, '0')}.png',
              ).writeAsBytes(bytes!.buffer.asUint8List());
              image.dispose();
            });
          }
        }
        expect(find.text('正在连接你的工作空间…'), findsOneWidget);
        expect(find.byType(ChatScreen), findsNothing);
        await tester.pumpWidget(const SizedBox());
        c.dispose();
      });
    }
  }
}
