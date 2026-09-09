import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/shared/models/chat.dart';

import 'support/fake_workspace.dart';
import 'support/ui_fixture.dart';

import 'package:markai_mobile/shared/widgets/agent_avatar.dart';

void main() {
  testWidgets(
    'mobile sidebar pushes the full width conversation without a scrim',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      await tester.runAsync(() async {
        await AgentAvatar.preload();
        for (final font in [
          ('Noto Sans SC', 'NotoSansSC'),
          ('Plus Jakarta Sans', 'PlusJakartaSans'),
        ]) {
          await (FontLoader(
            font.$1,
          )..addFont(rootBundle.load('assets/fonts/${font.$2}.ttf'))).load();
        }
      });
      final c = await fixtureWorkspace();
      c.settings['general']['reduceMotion'] = true;
      c.user = jsonMap(uiFixture['user']);
      c.models = jsonList(uiFixture['models']).map(ModelRef.fromJson).toList();
      c.model = c.models.first;
      final boundary = GlobalKey();
      debugDisableShadows = false;
      addTearDown(() {
        debugDisableShadows = true;
      });
      await tester.pumpWidget(
        RepaintBoundary(
          key: boundary,
          child: MarkAIApp(controller: c, autoStart: false),
        ),
      );
      await tester.pumpAndSettle();
      Future<void> screenshot(String name) async {
        if (!const bool.fromEnvironment('UPDATE_COMPONENT_SCREENSHOTS')) return;
        await tester.runAsync(() async {
          final image =
              await (boundary.currentContext!.findRenderObject()
                      as RenderRepaintBoundary)
                  .toImage();
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          await File('qa/native-$name-light-390.png')
              .writeAsBytes(bytes!.buffer.asUint8List());
          image.dispose();
        });
      }

      await screenshot('welcome');
      await tester.tap(find.byTooltip('会话操作'));
      await tester.pumpAndSettle();
      await screenshot('header-menu');
      expect(find.text('全宽显示'), findsOneWidget);
      await tester.tapAt(const Offset(380, 400));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('分享与导出'));
      await tester.pumpAndSettle();
      await screenshot('share-menu');
      expect(find.text('导出图片'), findsOneWidget);
      await tester.tapAt(const Offset(20, 400));
      await tester.pumpAndSettle();
      final initialComposer = tester.getRect(find.byType(TextField));
      await tester.tap(find.byTooltip('展开侧栏'));
      await tester.pumpAndSettle();
      expect(
        tester.getRect(find.byType(TextField)).left,
        initialComposer.left + 260,
      );
      expect(
        tester.getRect(find.byType(TextField)).width,
        initialComposer.width,
      );
      await screenshot('sidebar');
      await tester.tap(find.text('测试用户'));
      await tester.pumpAndSettle();
      await screenshot('account-menu');
      expect(find.text('文件管理'), findsOneWidget);
      await tester.tapAt(const Offset(380, 400));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('收起侧栏'));
      await tester.pumpAndSettle();
      expect(tester.getRect(find.byType(TextField)), initialComposer);
      await tester.tap(find.byTooltip('当前会话工具'));
      await tester.pumpAndSettle();
      await screenshot('tools');
      expect(find.text('还没有安装工具'), findsOneWidget);
      await tester.tapAt(const Offset(380, 100));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('gpt-4o'));
      await tester.pumpAndSettle();
      await screenshot('models');
      expect(find.text('图片生成模型'), findsOneWidget);
      await tester.tap(find.text('图片生成').first);
      await tester.pumpAndSettle();
      expect(find.text('gpt-4o'), findsNothing);
      expect(find.text('gpt-image-2'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.byTooltip('关闭'));
      await tester.pumpAndSettle();
      final api = c.api as FakeApi;
      api.sessions['qa-session'] = jsonList(uiFixture['sessions']).first;
      api.messages['qa-session'] = jsonList(uiFixture['messages']);
      await c.loadSessions();
      await c.openSession('qa-session');
      await tester.pumpAndSettle();
      await screenshot('conversation');
      await tester.tap(find.byTooltip('更多').last);
      await tester.pumpAndSettle();
      await screenshot('message-menu');
      await tester.tap(find.text('翻译'));
      await tester.pumpAndSettle();
      await screenshot('translation-menu');
      expect(find.text('日本語'), findsOneWidget);
      await tester.tapAt(const Offset(380, 30));
      await tester.pumpAndSettle();
      expect(find.text('介绍一下 MarkAI'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      c.dispose();
      debugDisableShadows = true;
    },
  );
}
