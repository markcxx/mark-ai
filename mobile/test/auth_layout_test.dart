import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';

import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/features/auth/auth_screen.dart';
import 'package:markai_mobile/shared/widgets/agent_avatar.dart';

import 'support/fake_workspace.dart';

void main() {
  test('guest theme is local and does not call protected settings', () async {
    final c = await fixtureWorkspace();
    c.guest = true;
    final api = c.api as FakeApi;
    api.requests.clear();
    c.setSetting('themeMode', 'dark');
    await Future<void>.delayed(const Duration(milliseconds: 450));
    expect(api.requests, isEmpty);
    expect((await c.local.read('guest-settings:${api.baseUrl}'))['themeMode'], 'dark');
    c.dispose();
  });
  testWidgets('login geometry matches the 390 by 844 Web reference', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.runAsync(() async {
      final loader = FontLoader('Noto Sans SC')
        ..addFont(rootBundle.load('assets/fonts/NotoSansSC.ttf'));
      await loader.load();
      final icons = FontLoader('packages/lucide_icons_flutter/Lucide')
        ..addFont(
          rootBundle.load('packages/lucide_icons_flutter/assets/lucide.ttf'),
        );
      await icons.load();
      await AgentAvatar.preload();
    });
    debugDisableShadows = false;
    final c = await fixtureWorkspace();
    c.guest = true;
    c.settings['general']['reduceMotion'] = true;
    final snapshot = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: snapshot,
        child: MarkAIApp(controller: c, autoStart: false),
      ),
    );
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      await Future<void>.delayed(Duration.zero);
    });
    await tester.pump();
    expect(
      tester.getRect(find.byType(TextField)),
      const Rect.fromLTWH(13, 404.5, 364, 96),
    );
    expect(
      tester.getRect(find.byTooltip('发送消息')),
      const Rect.fromLTWH(323, 505.5, 44, 44),
    );
    Future<void> capture(String page) async {
      if (!const bool.fromEnvironment('UPDATE_AUTH_SCREENSHOTS')) return;
      await tester.runAsync(() async {
        final boundary =
            snapshot.currentContext!.findRenderObject()
                as RenderRepaintBoundary;
        final image = await boundary.toImage();
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await File('qa/native-$page-light-390.png')
            .writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
    }

    await capture('guest');
    await tester.tap(find.text('登录'));
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      await Future<void>.delayed(Duration.zero);
    });
    await tester.pump();
    final title = tester.getRect(find.text('登录你的账户'));
    final google = tester.getRect(
      find.widgetWithText(OutlinedButton, 'Google'),
    );
    expect(title.left, 25);
    expect(google.width, 164);
    expect(title.top, closeTo(254.40625, .25));
    expect(google.top, closeTo(357.59375, .25));
    await capture('login');
    await tester.pumpWidget(const SizedBox());
    debugDisableShadows = true;
    c.dispose();
  });
  for (final width in [320.0, 390.0, 840.0]) {
    for (final dark in [false, true]) {
      testWidgets('guest and full-page auth $width dark=$dark', (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(width, 844);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final c = await fixtureWorkspace();
        c.guest = true;
        c.settings['general']['reduceMotion'] = true;
        c.settings['general']['themeMode'] = dark ? 'dark' : 'light';
        await tester.pumpWidget(MarkAIApp(controller: c, autoStart: false));
        await tester.pumpAndSettle();
        expect(find.byTooltip('展开侧栏'), findsNothing);
        expect(find.byType(AgentAvatar), findsOneWidget);
        expect(tester.testTextInput.isVisible, isFalse);
        await tester.enterText(find.byType(TextField), '保留这段游客草稿');
        await tester.pump();
        await tester.tap(find.byTooltip('发送消息'));
        await tester.pumpAndSettle();
        expect(find.byType(AuthScreen), findsOneWidget);
        expect(find.byType(AlertDialog), findsNothing);
        expect(find.text('登录你的账户'), findsOneWidget);
        expect(find.text('Google'), findsOneWidget);
        expect(find.text('GitHub'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.byTooltip('显示密码'));
        await tester.tap(find.byTooltip('显示密码'));
        await tester.pump();
        expect(find.byTooltip('隐藏密码'), findsOneWidget);
        await tester.tap(find.text('忘记密码？'));
        await tester.pumpAndSettle();
        expect(find.text('发送重置链接'), findsOneWidget);
        await tester.tap(find.text('返回登录'));
        await tester.pumpAndSettle();
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        expect(find.text('保留这段游客草稿'), findsOneWidget);
        expect(c.draft, '保留这段游客草稿');
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        c.dispose();
      });
    }
  }
}
