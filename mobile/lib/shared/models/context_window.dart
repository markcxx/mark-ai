import 'dart:convert';
import 'dart:math' as math;

import 'chat.dart';
import 'tool_context_data.dart';

int estimateTextTokens(String text) {
  final value = text.trim();
  if (value.isEmpty) return 0;
  final cjk = RegExp(r'[\u3400-\u9fff\uf900-\ufaff]').allMatches(value).length;
  return math.max(1, (cjk / 1.7 + (value.length - cjk) / 4).ceil());
}

int estimateDraftContextTokens({
  required List<ChatMessage> messages,
  required List<Json> attachments,
  required String draft,
  required List<String> toolIds,
  required bool webSearch,
}) {
  final tools = toolIds
      .map((id) => toolContextData.where((t) => t['id'] == id).firstOrNull)
      .whereType<Map<String, dynamic>>()
      .toList();
  final toolTokens = estimateTextTokens(
    jsonEncode({
      'prompt': tools
          .map((t) => t['prompt'])
          .whereType<String>()
          .where((p) => p.isNotEmpty)
          .join('\n\n'),
      'tools': tools.expand((t) => t['functions'] as List? ?? []).toList(),
    }),
  );
  final context = messages.map((m) {
    final quote = m.segments.where((s) => s['type'] == 'quote').firstOrNull;
    return {
      'content': quote == null
          ? m.content
          : '[引用内容]\n${quote['content']}\n[/引用内容]\n\n${m.content}',
      'role': m.role,
    };
  }).toList();
  if (draft.trim().isNotEmpty || attachments.isNotEmpty) {
    context.add({
      'content': draft.trim().isEmpty ? '请查看我上传的附件。' : draft.trim(),
      'role': 'user',
    });
  }
  final files = [
    ...attachments,
    for (final m in messages) ...[
      ...m.attachments,
      for (final s in m.segments.where((s) => s['type'] == 'generated-image'))
        jsonMap(jsonMap(s['generatedImage'])['file']),
    ],
  ];
  final fileTokens = files.fold<int>(0, (total, f) {
    final type = f['contentType'] as String? ?? '',
        name = f['name'] as String? ?? '',
        size = f['size'] as num? ?? 0;
    return total +
        (type.startsWith('image/')
            ? 32
            : math.min(
                30000,
                math.max(
                  64,
                  (size *
                          (type.contains('spreadsheet') ||
                                  name.toLowerCase().endsWith('.xlsx')
                              ? .5
                              : 1 / 3))
                      .ceil(),
                ),
              ));
  });
  return (context.isEmpty ? 0 : estimateTextTokens(jsonEncode(context))) +
      fileTokens +
      512 +
      toolTokens +
      (webSearch ? 1200 : 0);
}
