import '../../../shared/models/chat.dart';

class MessageAccumulator {
  final ChatMessage message;
  final Stopwatch elapsed = Stopwatch()..start();
  int? _thinkingStarted;
  MessageAccumulator(this.message);
  void _finishThinking() {
    final segments = message.segments;
    for (final segment in segments.where(
      (s) => s['type'] == 'thinking' && s['isActive'] == true,
    )) {
      segment['isActive'] = false;
      segment['duration'] =
          (segment['duration'] as num? ?? 0) +
          elapsed.elapsedMilliseconds -
          (_thinkingStarted ?? elapsed.elapsedMilliseconds);
    }
    _thinkingStarted = null;
    message.segments = segments;
  }

  void add(Json event) {
    final type = event['type'];
    if (type != 'reasoning' && type != 'usage') _finishThinking();
    final segments = message.segments;
    if (type == 'content' || type == 'reasoning') {
      final text = event['text'] as String? ?? '';
      if (text.isEmpty) return;
      final segmentType = type == 'content' ? 'content' : 'thinking';
      if (segments.isEmpty || segments.last['type'] != segmentType) {
        segments.add({
          'type': segmentType,
          'content': '',
          if (type == 'reasoning') 'isActive': true,
        });
      }
      segments.last['content'] = '${segments.last['content']}$text';
      if (type == 'content') {
        message.content += text;
      } else {
        _thinkingStarted ??= elapsed.elapsedMilliseconds;
        segments.last['isActive'] = true;
      }
    } else if (type == 'usage') {
      for (final key in [
        'inputTokens',
        'outputTokens',
        'totalTokens',
        'tokenUsageSource',
      ]) {
        if (event[key] != null) message.data[key] = event[key];
      }
    } else if (type == 'tool' || type == 'file' || type == 'image') {
      final key = type == 'tool'
          ? 'webSearch'
          : type == 'file'
          ? 'generatedFile'
          : 'generatedImage';
      final segmentType = type == 'tool'
          ? 'tool'
          : type == 'file'
          ? 'generated-file'
          : 'generated-image';
      final value = jsonMap(event[key]);
      final index = segments.indexWhere((s) {
        final old = jsonMap(s[key]);
        return s['type'] == segmentType &&
            (type == 'file'
                ? old['callId'] == value['callId']
                : type == 'tool'
                ? old['tool'] == value['tool'] && old['query'] == value['query']
                : false);
      });
      final next = {
        'type': segmentType,
        key: {if (index >= 0) ...jsonMap(segments[index][key]), ...value},
      };
      if (index >= 0) {
        segments[index] = next;
      } else {
        segments.add(next);
      }
    }
    message.segments = segments;
  }

  void finish({bool interrupted = false}) {
    _finishThinking();
    elapsed.stop();
    message.data.addAll({
      'isStreaming': false,
      'isReasoning': false,
      'interrupted': interrupted,
      'generationDuration': elapsed.elapsedMilliseconds,
      'reasoning': message.segments
          .where((s) => s['type'] == 'thinking')
          .map((s) => s['content'])
          .join(),
      'reasoningDuration': message.segments
          .where((s) => s['type'] == 'thinking')
          .fold<num>(0, (v, s) => v + (s['duration'] as num? ?? 0)),
    });
  }
}
