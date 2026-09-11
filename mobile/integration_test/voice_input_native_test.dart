import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:markai_mobile/features/chat/application/voice_input_controller.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('native system speech bridge starts and cancels on Android', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: Center(child: Text('系统语音输入原生测试'))),
      ),
    );
    const methods = MethodChannel('markai/speech_input');
    final available = await methods.invokeMethod<bool>('available');
    expect(
      available,
      isTrue,
      reason: 'Simulator must have a system RecognitionService',
    );
    final backend = AndroidSpeechInput();
    final first = Completer<Map<String, dynamic>>();
    final received = <String>[];
    final subscription = backend.events.listen((event) {
      received.add(event['type'] as String);
      if ((event['type'] == 'ready' || event['type'] == 'error') &&
          !first.isCompleted) {
        first.complete(event);
      }
    });
    try {
      await backend.start('native-smoke');
      final event = await first.future.timeout(const Duration(seconds: 20));
      debugPrint('System recognizer initial event: $event');
      expect(
        event['type'],
        'ready',
        reason:
            'Must open the native recognizer, not just discover its package',
      );
      await backend.cancel('native-smoke');
      await Future<void>.delayed(const Duration(milliseconds: 500));
      expect(received, isNot(contains('final')));
    } finally {
      await backend.cancel('native-smoke');
      await subscription.cancel();
    }
  });
}
