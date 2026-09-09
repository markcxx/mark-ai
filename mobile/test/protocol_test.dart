import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/core/network/api_client.dart';
import 'package:markai_mobile/features/chat/application/message_accumulator.dart';
import 'package:markai_mobile/shared/models/chat.dart';

void main() {
  test('shared server fixture preserves tool and file events', () async {
    final file = File('../contracts/fixtures/chat-stream.ndjson');
    final message = ChatMessage({
      'id': 'fixture',
      'role': 'model',
      'content': '',
    });
    final accumulator = MessageAccumulator(message);
    await for (final event in decodeChatStream(file.openRead())) {
      accumulator.add(event);
    }
    accumulator.finish();
    expect(message.segments.map((s) => s['type']), [
      'thinking',
      'tool',
      'content',
      'generated-file',
    ]);
    expect(message.data['totalTokens'], 32);
    expect(message.segments.last['generatedFile']['status'], 'done');
  });
  test('UTF-8 and NDJSON survive every byte boundary and an unterminated last line', () async {
    final events = [
      {'type': 'reasoning', 'text': '思考😀'},
      {'type': 'content', 'text': '你好\n世界'},
      {'type': 'usage', 'totalTokens': 23},
    ];
    final bytes = utf8.encode(events.map(jsonEncode).join('\n'));
    for (var split = 0; split <= bytes.length; split++) {
      expect(
        await decodeChatStream(
          Stream.fromIterable([bytes.sublist(0, split), bytes.sublist(split)]),
        ).toList(),
        events,
      );
    }
  });
  test('tool updates retain ordering and interrupted reasoning closes', () {
    final message = ChatMessage({'id': 'm', 'role': 'model', 'content': ''});
    final accumulator = MessageAccumulator(message);
    accumulator.add({'type': 'reasoning', 'text': '检查'});
    accumulator.add({
      'type': 'tool',
      'webSearch': {'tool': 'web_search', 'query': 'q', 'status': 'searching'},
    });
    accumulator.add({
      'type': 'tool',
      'webSearch': {
        'tool': 'web_search',
        'query': 'q',
        'status': 'done',
        'results': [],
      },
    });
    accumulator.add({'type': 'content', 'text': '答案'});
    accumulator.add({
      'type': 'usage',
      'totalTokens': 42,
      'tokenUsageSource': 'provider',
    });
    accumulator.finish(interrupted: true);
    expect(message.segments.map((s) => s['type']), [
      'thinking',
      'tool',
      'content',
    ]);
    expect(message.segments.first['isActive'], false);
    expect(message.content, '答案');
    expect(message.data['totalTokens'], 42);
    expect(message.interrupted, true);
  });
  test('round-trip preserves variants, unknown segments and metadata', () {
    final data = {
      'id': 'm',
      'role': 'model',
      'content': 'x',
      'segments': [
        {
          'type': 'future-artifact',
          'payload': {'x': 2},
        },
      ],
      'variants': [
        {'id': 'v', 'content': 'old', 'provider': 'p'},
      ],
      'custom': true,
    };
    expect(ChatMessage(data).toJson(), data);
  });
}
