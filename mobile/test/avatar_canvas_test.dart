import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/shared/widgets/agent_avatar.dart';

void main() {
  testWidgets(
    'animated avatar never leaks its transform or clip to later widgets',
    (tester) async {
      await tester.runAsync(AgentAvatar.preload);
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(child: AgentAvatar(size: 52, arriving: true)),
          ),
        ),
      );
      await tester.runAsync(() async {
        await Future<void>.delayed(Duration.zero);
      });
      // Include arrival rings, the idle transition, and later ambient states.
      for (var i = 0; i < 24; i++) {
        await tester.pump(const Duration(milliseconds: 750));
        final widget = tester.widget<CustomPaint>(
          find.descendant(
            of: find.byType(AgentAvatar),
            matching: find.byType(CustomPaint),
          ),
        );
        final recorder = ui.PictureRecorder();
        final canvas = Canvas(recorder)
          ..translate(17, 23)
          ..clipRect(const Rect.fromLTWH(0, 0, 200, 200));
        final transform = canvas.getTransform().toList();
        final count = canvas.getSaveCount();
        final clip = canvas.getLocalClipBounds();
        widget.painter!.paint(canvas, const Size(52, 52));
        expect(
          canvas.getTransform().toList(),
          transform,
          reason: 'Frame $i must not scale subsequent form fields',
        );
        expect(canvas.getSaveCount(), count);
        expect(canvas.getLocalClipBounds(), clip);
        recorder.endRecording().dispose();
        expect(tester.takeException(), isNull);
      }
      await tester.pumpWidget(const SizedBox());
    },
  );
}
