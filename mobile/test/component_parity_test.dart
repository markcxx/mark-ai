import 'dart:io';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/core/theme/markai_theme.dart';
import 'package:markai_mobile/features/chat/application/workspace_controller.dart';
import 'package:markai_mobile/features/chat/presentation/profile_dialog.dart';
import 'package:markai_mobile/features/chat/presentation/plugin_center.dart';
import 'package:markai_mobile/features/chat/presentation/share_dialog.dart';
import 'package:markai_mobile/features/chat/presentation/file_manager.dart';
import 'package:markai_mobile/features/settings/settings_screen.dart';
import 'package:markai_mobile/shared/models/chat.dart';
import 'package:markai_mobile/shared/widgets/app_dialog.dart';

import 'support/fake_workspace.dart';

class ComponentApi extends FakeApi {
  Json profile = {
    'fullName': '测试用户',
    'email': 'qa@example.invalid',
    'age': 28,
    'role': 'user',
  };
  ComponentApi(super.store);
  @override
  Future<Json> request(
    String method,
    String path, {
    dynamic body,
    CancelToken? cancel,
  }) async {
    requests.add({'method': method, 'path': path, 'body': body});
    if (path == '/api/profile') {
      if (method == 'PATCH') profile = {...profile, ...jsonMap(body)};
      return {'user': profile};
    }
    if (path.endsWith('/share')) return {'share': null};
    return super.request(method, path, body: body, cancel: cancel);
  }
}

void main() {
  testWidgets('source-matched profile geometry, validation and save contract', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await tester.runAsync(() async {
      await (FontLoader(
        'Noto Sans SC',
      )..addFont(rootBundle.load('assets/fonts/NotoSansSC.ttf'))).load();
      await (FontLoader('packages/lucide_icons_flutter/Lucide')..addFont(
            rootBundle.load('packages/lucide_icons_flutter/assets/lucide.ttf'),
          ))
          .load();
    });
    final store = MemoryStore(), boundary = GlobalKey();
    final api = ComponentApi(store);
    // Separate instance prevents accidental use of live credentials or data.
    final controller = WorkspaceController(api, store);
    controller.user = {'name': '测试用户', 'email': 'qa@example.invalid'};
    debugDisableShadows = false;
    await tester.pumpWidget(
      RepaintBoundary(
        key: boundary,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: markaiTheme(Brightness.light),
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => showAppDialog(
                  context,
                  (_) => ProfileDialog(controller: controller),
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    if (const bool.fromEnvironment('UPDATE_COMPONENT_SCREENSHOTS')) {
      await tester.runAsync(() async {
        final image =
            await (boundary.currentContext!.findRenderObject()
                    as RenderRepaintBoundary)
                .toImage();
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await File('qa/native-profile-light-390.png')
            .writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
    }
    await tester.enterText(find.byType(TextField).first, '测试修改');
    await tester.enterText(find.byType(TextField).last, '5');
    await tester.tap(find.text('保存更改'));
    await tester.pumpAndSettle();
    expect(find.text('请输入 6～120 岁之间的有效年龄'), findsOneWidget);
    expect(api.requests.where((r) => r['method'] == 'PATCH'), isEmpty);
    await tester.enterText(find.byType(TextField).last, '29');
    await tester.tap(find.text('保存更改'));
    await tester.pumpAndSettle();
    expect(api.profile['fullName'], '测试修改');
    expect(controller.user['name'], '测试修改');
    expect(find.byType(ProfileDialog), findsNothing);
    await tester.pumpWidget(const SizedBox());
    debugDisableShadows = true;
    controller.dispose();
  });
  for (final width in [320.0, 390.0, 840.0]) {
    for (final brightness in Brightness.values) {
      testWidgets('component overlays $width $brightness', (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(width, 844);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetPhysicalSize);
        final store = MemoryStore();
        final c = WorkspaceController(ComponentApi(store), store);
        for (final page in [
          ProfileDialog(controller: c),
          ShareDialog(controller: c, sessionId: 'qa'),
          PluginCenter(controller: c),
          FileManager(controller: c),
          SettingsScreen(controller: c),
        ]) {
          final boundary = GlobalKey();
          await tester.pumpWidget(
            RepaintBoundary(
              key: boundary,
              child: MaterialApp(
                debugShowCheckedModeBanner: false,
                theme: markaiTheme(brightness),
                home: page,
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          if (const bool.fromEnvironment('UPDATE_COMPONENT_SCREENSHOTS') &&
              width == 390 &&
              brightness == Brightness.light &&
              page is SettingsScreen) {
            await tester.runAsync(() async {
              final image =
                  await (boundary.currentContext!.findRenderObject()
                          as RenderRepaintBoundary)
                      .toImage();
              final bytes = await image.toByteData(
                format: ui.ImageByteFormat.png,
              );
              await File('qa/native-settings-light-390.png')
                  .writeAsBytes(bytes!.buffer.asUint8List());
              image.dispose();
            });
          }
          await tester.pumpWidget(const SizedBox());
        }
        c.dispose();
      });
    }
  }
}
