import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/features/settings/settings_home.dart';
import 'package:markai_mobile/features/settings/settings_screen.dart';

import 'support/fake_workspace.dart';

void main() {
  for (final dark in [false, true]) {
    testWidgets('grouped settings and interactive back navigation ($dark)', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.runAsync(() async {
        await (FontLoader(
          'Noto Sans SC',
        )..addFont(rootBundle.load('assets/fonts/NotoSansSC.ttf'))).load();
      });
      final c = await fixtureWorkspace();
      addTearDown(c.dispose);
      c.settings['general']['reduceMotion'] = false;
      c.settings['general']['themeMode'] = dark ? 'dark' : 'light';
      c.setDraft('保留这条草稿');
      final boundary = GlobalKey();
      await tester.pumpWidget(
        RepaintBoundary(
          key: boundary,
          child: MarkAIApp(controller: c, autoStart: false),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump(const Duration(milliseconds: 500));
      await tester.tap(find.byTooltip('展开侧栏'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.tap(find.text('MarkAI 用户'));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsHome), findsOneWidget);
      expect(find.byType(Dialog), findsNothing);
      Future<void> screenshot(String name) async {
        if (!const bool.fromEnvironment('UPDATE_COMPONENT_SCREENSHOTS')) return;
        await tester.runAsync(() async {
          final image =
              await (boundary.currentContext!.findRenderObject()
                      as RenderRepaintBoundary)
                  .toImage();
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          await Directory('/tmp/markai-settings-qa').create(recursive: true);
          await File('/tmp/markai-settings-qa/$name-$dark.png')
              .writeAsBytes(bytes!.buffer.asUint8List());
          image.dispose();
        });
      }

      await screenshot('home');
      for (final title in [
        '个人资料',
        '文件管理',
        '外观',
        '对话',
        '语音',
        'AI 提供商',
        '应用更新',
      ]) {
        final entry = find.byKey(ValueKey('settings-category-$title'));
        await tester.ensureVisible(entry);
        await tester.tap(entry);
        await tester.pumpAndSettle();
        expect(find.byKey(const ValueKey('settings-tab-外观')), findsNothing);
        expect(find.byType(Dialog), findsNothing);
        final pageTitle = find.text(title).last;
        final before = tester.getTopLeft(pageTitle).dx;
        final drag = await tester.startGesture(const Offset(70, 220));
        await drag.moveBy(const Offset(30, 0));
        await tester.pump();
        await drag.moveBy(const Offset(100, 0));
        await tester.pump();
        expect(tester.getTopLeft(pageTitle).dx, greaterThan(before + 50));
        // Both levels must be painted while the current page follows the finger.
        expect(find.byType(SettingsHome), findsOneWidget);
        if (title == '外观') await screenshot('swipe');
        await drag.cancel();
        await tester.pumpAndSettle();
        expect(tester.getTopLeft(pageTitle).dx, closeTo(before, .1));
        await tester.dragFrom(const Offset(70, 220), const Offset(270, 0));
        await tester.pumpAndSettle();
        expect(find.byType(SettingsHome), findsOneWidget);
        expect(find.byType(SettingsScreen), findsNothing);
        expect(tester.takeException(), isNull);
      }
      await tester.dragFrom(const Offset(70, 220), const Offset(270, 0));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(SettingsHome), findsNothing);
      expect(find.text('开启新话题'), findsOneWidget);
      expect(c.draft, '保留这条草稿');
      await tester.pumpWidget(const SizedBox());
    });
  }
}
