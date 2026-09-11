import 'dart:async';

import 'package:markai_mobile/features/chat/application/voice_input_controller.dart';

class FakeSpeechInput implements SpeechInputBackend {
  final stream = StreamController<Map<String, dynamic>>.broadcast(sync: true);
  final starts = <String>[], stops = <String>[], cancels = <String>[];
  bool ready = true;
  Object? startError;
  @override
  Stream<Map<String, dynamic>> get events => stream.stream;
  void emit(String type, [Object? value, String? session]) => stream.add({
    'session': session ?? starts.last,
    'type': type,
    'value': value,
  });
  @override
  Future<void> start(String session) async {
    starts.add(session);
    if (startError != null) throw startError!;
    if (ready) emit('ready');
  }

  @override
  Future<void> stop(String session) async {
    stops.add(session);
  }

  @override
  Future<void> cancel(String session) async {
    cancels.add(session);
  }
}
