import 'dart:io';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/core/theme/markai_theme.dart';
import 'package:markai_mobile/features/chat/application/workspace_controller.dart';
import 'package:markai_mobile/features/settings/settings_screen.dart';
import 'package:markai_mobile/shared/models/chat.dart';

import 'support/fake_workspace.dart';

class ImageApi extends FakeApi {
  ImageApi(super.store, this.image);
  final Uint8List image;
  @override
  Future<Response<dynamic>> raw(
    String method,
    String path, {
    dynamic body,
    CancelToken? cancel,
    ResponseType type = ResponseType.json,
    bool allowDownloadRedirect = false,
    Map<String, String>? extraHeaders,
  }) async => Response(
    data: image,
    statusCode: 200,
    requestOptions: RequestOptions(path: path),
  );
}

void main() {
  for (final width in [320.0, 390.0]) {
    for (final dark in [false, true]) {
      testWidgets(
        'composer attachments, thinking and compact settings $width $dark',
        (tester) async {
          tester.view.physicalSize = Size(width, 844);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          late Uint8List bytes;
          await tester.runAsync(() async {
            for (final (family, path) in [
              ('Noto Sans SC', 'assets/fonts/NotoSansSC.ttf'),
              ('Plus Jakarta Sans', 'assets/fonts/PlusJakartaSans.ttf'),
              (
                'packages/lucide_icons_flutter/Lucide',
                'packages/lucide_icons_flutter/assets/lucide.ttf',
              ),
            ]) {
              await (FontLoader(family)..addFont(rootBundle.load(path))).load();
            }
            final recorder = ui.PictureRecorder();
            final canvas = Canvas(recorder);
            canvas.drawColor(const Color(0xffcbe6e5), BlendMode.src);
            canvas.drawCircle(
              const Offset(54, 22),
              10,
              Paint()..color = const Color(0xffffd18a),
            );
            canvas.drawPath(
              Path()
                ..moveTo(0, 76)
                ..lineTo(28, 20)
                ..lineTo(70, 76)
                ..close(),
              Paint()..color = const Color(0xff56877c),
            );
            final picture = recorder.endRecording();
            final image = await picture.toImage(76, 76);
            bytes = (await image.toByteData(format: ui.ImageByteFormat.png))!
                .buffer
                .asUint8List();
            image.dispose();
            picture.dispose();
          });
          final api = ImageApi(MemoryStore(), bytes);
          final c = WorkspaceController(api, MemoryStore())..connected = true;
          await c.loadInitial();
          addTearDown(c.dispose);
          c.models = [
            ModelRef('kimi-k2.5', 'moonshot', {
              'thinking': {'defaultEnabled': true},
            }),
            ModelRef('fixed', 'test'),
          ];
          c.model = c.models.first;
          c.settings['general']['themeMode'] = dark ? 'dark' : 'light';
          c.settings['general']['reduceMotion'] = true;
          c.setDraft('请帮我看看这些附件');
          c.attachments = [
            {
              'id': 'photo',
              'name': '山景.png',
              'contentType': 'image/png',
              'size': 100,
            },
            {
              'id': 'document',
              'name': '项目需求说明.pdf',
              'contentType': 'application/pdf',
              'size': 2048,
            },
          ];
          final boundary = GlobalKey();
          await tester.pumpWidget(
            RepaintBoundary(
              key: boundary,
              child: MarkAIApp(controller: c, autoStart: false),
            ),
          );
          await tester.pumpAndSettle();
          final preview = tester.widget<Image>(find.byType(Image).last);
          await tester.runAsync(
            () => precacheImage(preview.image, boundary.currentContext!),
          );
          await tester.pumpAndSettle();
          final imageRect = tester.getRect(
            find.byKey(const ValueKey('pending-image-photo')),
          );
          final fileRect = tester.getRect(
            find.byKey(const ValueKey('pending-file-document')),
          );
          expect(imageRect.size, const Size(76, 76));
          expect(imageRect.left, lessThan(30));
          expect(
            fileRect.left,
            fileRect.top == imageRect.top
                ? imageRect.right + 8
                : imageRect.left,
          );
          expect(
            tester.widget<Image>(find.byType(Image).last).fit,
            BoxFit.cover,
          );
          final send = tester.getRect(find.byTooltip('发送消息'));
          final add = tester.getRect(find.byTooltip('添加附件'));
          expect(add.right, lessThanOrEqualTo(send.left));
          expect(
            tester.getSize(find.byKey(const ValueKey('chat-send-surface'))),
            const Size(32, 32),
          );
          await tester.tap(find.byTooltip('关闭深度思考'));
          await tester.pumpAndSettle();
          expect(c.thinkingEnabled, false);
          expect(find.byTooltip('开启深度思考'), findsOneWidget);
          await tester.tap(find.byTooltip('添加附件'));
          await tester.pumpAndSettle();
          expect(find.text('拍照'), findsOneWidget);
          expect(
            tester.getRect(find.text('拍照')).top,
            greaterThan(tester.getRect(find.byType(TextField)).bottom),
          );
          Future<void> capture(String name) async {
            if (!const bool.fromEnvironment('UPDATE_COMPONENT_SCREENSHOTS') ||
                width != 390) {
              return;
            }
            await tester.runAsync(() async {
              final image =
                  await (boundary.currentContext!.findRenderObject()
                          as RenderRepaintBoundary)
                      .toImage();
              final data = await image.toByteData(
                format: ui.ImageByteFormat.png,
              );
              await Directory('/tmp/markai-composer-qa')
                  .create(recursive: true);
              await File('/tmp/markai-composer-qa/$name-$dark.png')
                  .writeAsBytes(data!.buffer.asUint8List());
              image.dispose();
            });
          }

          expect(
            tester.widget<RawImage>(find.byType(RawImage).last).image,
            isNotNull,
          );
          await capture('attachments');
          await tester.tap(find.byType(TextField));
          await tester.pumpAndSettle();
          expect(find.text('拍照'), findsNothing);
          await tester.tap(find.byTooltip('移除项目需求说明.pdf'));
          await tester.pumpAndSettle();
          expect(c.attachments, hasLength(1));
          expect(c.draft, '请帮我看看这些附件');
          await tester.tap(find.byTooltip('发送消息'));
          await tester.pumpAndSettle();
          final sent = api.requests.lastWhere(
            (r) => r['path'] == '/api/chat',
          )['body'];
          expect(sent['thinkingEnabled'], false);
          expect(sent['messages'].last['attachments'], hasLength(1));
          c.selectModel(c.models.last);
          await tester.pumpAndSettle();
          expect(find.byTooltip('开启深度思考'), findsNothing);
          expect(tester.takeException(), isNull);
          await tester.pumpWidget(
            RepaintBoundary(
              key: boundary,
              child: MaterialApp(
                debugShowCheckedModeBanner: false,
                theme: markaiTheme(dark ? Brightness.dark : Brightness.light),
                home: SettingsScreen(controller: c),
              ),
            ),
          );
          await tester.pumpAndSettle();
          await capture('appearance');
          expect(tester.takeException(), isNull);
          await tester.pumpWidget(const SizedBox());
        },
      );
    }
  }
}
