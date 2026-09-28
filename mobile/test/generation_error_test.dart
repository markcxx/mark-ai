import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/chat/application/workspace_controller.dart';
import 'package:markai_mobile/shared/models/chat.dart';
import 'package:markai_mobile/shared/models/model_metadata.dart';

import 'support/fake_workspace.dart';

class FailedGenerationApi extends FakeApi {
  FailedGenerationApi(super.store);
  @override
  Stream<Json> chat(Json body, CancelToken cancel) async* {
    yield {'type': 'content', 'text': '已生成的正文'};
    yield {'type': 'error', 'text': '模型服务当前繁忙（503），请稍后重试。'};
  }
}

void main() {
  test(
    'keeps partial output and persists a separate failure segment',
    () async {
      final store = MemoryStore();
      final c = WorkspaceController(FailedGenerationApi(store), store);
      await c.loadInitial();
      c.draft = 'test';
      await c.send();
      final answer = c.messages.last;
      expect(answer.content, '已生成的正文');
      expect(answer.interrupted, isTrue);
      expect(answer.segments.last['type'], 'error');
      expect(answer.segments.last['content'], contains('503'));
      final restored = ChatMessage(answer.toJson());
      expect(restored.segments.last['content'], contains('503'));
      c.dispose();
    },
  );
  test('catalog context labels use integer units', () {
    expect(formatContextWindow(1050000), '1M');
    expect(formatContextWindow(131072), '128K');
    expect(formatContextWindow(128000), '128K');
    expect(formatContextWindow(32768), '32K');
    expect(metadataForModel('gpt-6-sol')?['contextWindowTokens'], 1050000);
    for (final id in [
      'gpt-6-sol-高',
      'gpt-6-sol-中',
      'gpt-6-sol-低',
      'gpt-6-luna-高',
    ]) {
      expect(metadataForModel(id)?['contextWindowTokens'], 1050000);
    }
    for (final id in [
      'qwen3.8-flash',
      'qwen3.8-max-0902',
      'XiaomiMiMo/MiMo-V2.5',
    ]) {
      expect(metadataForModel(id)?['contextWindowTokens'], 1000000);
    }
    expect(metadataForModel('deepseek-flash')?['contextWindowTokens'], 1048576);
    expect(
      metadataForModel('gemini-3.7-flash')?['contextWindowTokens'],
      1048576,
    );
    expect(
      metadataForModel('qwen3.8-max-preview')?['contextWindowTokens'],
      isNull,
    );
    expect(metadataForModel('gemini-3.8-flash')?['maxOutputTokens'], 65536);
  });
}
