import 'dart:convert';

import 'package:markdown/markdown.dart' as md;
import 'package:markai_mobile/features/chat/presentation/message_sources.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/chat/application/message_accumulator.dart';
import 'package:markai_mobile/features/chat/presentation/web_image_gallery.dart';
import 'package:markai_mobile/shared/models/chat.dart';

void main() {
  test('citation aliases resolve only registered source IDs', () {
    final document = md.Document(
      inlineSyntaxes: [
        CitationSyntax({1}),
      ],
    );
    final html = md.renderToHtml(
      document.parseLines(['依据 [1] 和 [citation:1]，未知 [citation:9]']),
    );
    expect('<citation>1</citation>'.allMatches(html).length, 2);
    expect(html, contains('[citation:9]'));
  });
  test('separate page reads retain identity and interrupted tools finish', () {
    final message = ChatMessage({'id': 'm', 'role': 'model', 'content': ''});
    final accumulator = MessageAccumulator(message);
    void add(String id, String status) => accumulator.add({
      'type': 'tool',
      'webSearch': {
        'callId': id,
        'tool': 'read_webpage',
        'query': 'https://example.com/a',
        'status': status,
        'results': [],
      },
    });
    add('first', 'searching');
    add('first', 'done');
    add('next', 'searching');
    accumulator.finish(interrupted: true);
    expect(message.segments.length, 2);
    expect(message.segments[0]['webSearch']['status'], 'done');
    expect(message.segments[1]['webSearch']['status'], 'error');
  });
  test(
    'selected picture provenance survives JSON reload and prompt context',
    () {
      final raw = {
        'id': 'm',
        'role': 'model',
        'content': '',
        'segments': [
          {
            'type': 'tool',
            'webSearch': {
              'tool': 'show_images',
              'status': 'done',
              'results': [
                {'url': 'https://example.com/a', 'title': '来源'},
              ],
              'images': [
                {
                  'id': 'img_1',
                  'url': 'https://example.com/a.jpg',
                  'title': '正文配图',
                  'sourceUrl': 'https://example.com/a',
                },
              ],
            },
          },
        ],
      };
      final restored = ChatMessage(
        Map<String, dynamic>.from(jsonDecode(jsonEncode(raw))),
      );
      final context = restored.toPrompt()['webContext'] as Map;
      expect((context['images'] as List).single['id'], 'img_1');
      expect(
        (context['sources'] as List).single['url'],
        'https://example.com/a',
      );
    },
  );
  test('image renderer rejects non-public and credentialed URLs', () {
    for (final value in [
      'file:///x',
      'http://localhost/x',
      'http://10.0.0.1/x',
      'https://user:pass@example.com/x',
    ]) {
      expect(publicWebImageUri(value), isNull);
    }
    expect(
      publicWebImageUri('https://example.com/image.jpg')?.host,
      'example.com',
    );
  });
}
