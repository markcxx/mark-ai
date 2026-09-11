import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/core/theme/markai_theme.dart';
import 'package:markai_mobile/features/chat/presentation/hold_to_speak.dart';

import 'support/fake_speech_input.dart';

void main() {
  for (final dark in [false, true]) {
    testWidgets(
      'empty TextField supports hold, slide cancel, return and send ($dark)',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(390, 844);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.runAsync(() async {
          await (FontLoader(
            'Noto Sans SC',
          )..addFont(rootBundle.load('assets/fonts/NotoSansSC.ttf'))).load();
        });
        final backend = FakeSpeechInput(),
            sent = <String>[],
            errors = <String>[];
        final input = TextEditingController(),
            focus = FocusNode(),
            boundary = GlobalKey();
        var enabled = true, contextKey = 'session1';
        Future<void> render() => tester.pumpWidget(
          RepaintBoundary(
            key: boundary,
            child: MaterialApp(
              debugShowCheckedModeBanner: false,
              theme: markaiTheme(dark ? Brightness.dark : Brightness.light),
              home: Scaffold(
                body: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: HoldToSpeak(
                      enabled: enabled,
                      contextKey: contextKey,
                      backend: backend,
                      onStart: focus.unfocus,
                      onText: sent.add,
                      onError: errors.add,
                      child: TextField(
                        controller: input,
                        focusNode: focus,
                        enableInteractiveSelection: !enabled,
                        decoration: const InputDecoration(
                          hintText: '尽管问，长按说话...',
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        Future<void> capture(String state) async {
          await tester.pump(const Duration(milliseconds: 200));
          final rendered =
              boundary.currentContext!.findRenderObject()
                  as RenderRepaintBoundary;
          await tester.runAsync(() async {
            final image = await rendered.toImage();
            final bytes = await image.toByteData(
              format: ui.ImageByteFormat.png,
            );
            await Directory('qa').create(recursive: true);
            await File('qa/voice-${dark ? 'dark' : 'light'}-$state.png')
                .writeAsBytes(bytes!.buffer.asUint8List());
            image.dispose();
          });
        }

        await render();
        final field = find.byType(TextField);
        final start = tester.getCenter(field);
        var hold = await tester.startGesture(start);
        await tester.pump(const Duration(milliseconds: 600));
        expect(backend.starts, hasLength(1));
        expect(find.text('松手发送，上滑取消'), findsOneWidget);
        for (var i = 0; i < 48; i++) {
          backend.emit('level', (i % 8).toDouble());
        }
        await capture('recording');
        await hold.moveBy(const Offset(0, -100));
        await tester.pump();
        expect(find.text('松手取消'), findsOneWidget);
        await capture('cancel');
        backend.emit('final', '取消不发送');
        await hold.up();
        await tester.pump();
        expect(sent, isEmpty);
        expect(find.byType(VoiceInputOverlay), findsNothing);
        hold = await tester.startGesture(start);
        await tester.pump(const Duration(milliseconds: 600));
        await hold.moveBy(const Offset(0, -100));
        await tester.pump();
        await hold.moveTo(start);
        await tester.pump();
        backend.emit('final', '正常发送');
        await hold.up();
        await tester.pump();
        expect(sent, ['正常发送']);
        hold = await tester.startGesture(start);
        await tester.pump(const Duration(milliseconds: 600));
        contextKey = 'session2';
        await render();
        await tester.pump();
        backend.emit('final', '旧会话');
        await hold.up();
        await tester.pump();
        expect(sent, hasLength(1));
        hold = await tester.startGesture(start);
        await tester.pump(const Duration(milliseconds: 600));
        tester.binding.handleAppLifecycleStateChanged(
          AppLifecycleState.inactive,
        );
        backend.emit('final', '后台不发送');
        await hold.up();
        await tester.pump();
        expect(sent, hasLength(1));
        expect(find.byType(VoiceInputOverlay), findsNothing);
        tester.binding.handleAppLifecycleStateChanged(
          AppLifecycleState.resumed,
        );
        enabled = false;
        input.text = '保留草稿';
        await render();
        await tester.longPress(field);
        await tester.pump();
        expect(backend.starts, hasLength(4));
        expect(input.text, '保留草稿');
        expect(errors, isEmpty);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        input.dispose();
        focus.dispose();
        await backend.stream.close();
      },
    );
  }
}
