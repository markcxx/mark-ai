import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/chat/application/workspace_controller.dart';
import 'package:markai_mobile/features/chat/presentation/model_selector.dart';
import 'package:markai_mobile/shared/models/chat.dart';
import 'package:markai_mobile/shared/models/model_metadata.dart';
import 'package:markai_mobile/shared/models/model_metadata_data.dart';

import 'support/fake_workspace.dart';

void main() {
  test('mobile image registry stays in sync with the server', () {
    final source = File('../lib/chat/image-models.ts').readAsStringSync();
    final registry = RegExp(r'IMAGE_GENERATION_MODEL_IDS\s*=\s*\[([^\]]*)\]')
        .firstMatch(source)!;
    final serverIds = RegExp(r'"([^"]+)"')
        .allMatches(registry.group(1)!)
        .map((match) => match.group(1)!)
        .toList();
    expect(imageGenerationModelIds, serverIds);
    for (final id in serverIds) {
      expect(isImageGenerationModel(' ${id.toUpperCase()} '), isTrue);
    }
    expect(isImageGenerationModel('gpt-5.4'), isFalse);
  });

  for (final brightness in Brightness.values) {
    testWidgets('2.5 models appear in image filter in $brightness', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final store = MemoryStore();
      final controller = WorkspaceController(FakeApi(store), store);
      addTearDown(controller.dispose);
      controller.models = [
        for (final id in [
          'gpt-4o',
          'gpt-image-2.5-sunburst',
          'gpt-image-2.5-flare',
        ])
          ModelRef(id, 'openai'),
      ];
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(brightness: brightness),
          home: Scaffold(body: ModelSelector(controller: controller)),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('图片生成').first);
      await tester.pumpAndSettle();
      expect(find.text('gpt-4o'), findsNothing);
      expect(find.text('gpt-image-2.5-sunburst'), findsOneWidget);
      expect(find.text('gpt-image-2.5-flare'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('文本生成').first);
      await tester.pumpAndSettle();
      expect(find.text('gpt-4o'), findsOneWidget);
      expect(find.text('gpt-image-2.5-sunburst'), findsNothing);
      expect(find.text('gpt-image-2.5-flare'), findsNothing);
    });
  }
}
