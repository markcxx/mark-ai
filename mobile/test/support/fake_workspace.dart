import 'dart:async';

import 'package:dio/dio.dart';
import 'package:markai_mobile/core/network/api_client.dart';
import 'package:markai_mobile/core/storage/local_store.dart';
import 'package:markai_mobile/features/chat/application/workspace_controller.dart';
import 'package:markai_mobile/shared/models/chat.dart';

class MemoryStore implements LocalStore {
  final Map<String, Json> values = {};
  @override
  Future<Json> read(String key) async => cloneJson(values[key] ?? {});
  @override
  Future<void> write(String key, Json value) async {
    values[key] = cloneJson(value);
  }

  @override
  Future<void> remove(String key) async {
    values.remove(key);
  }
}

class FakeApi extends ApiClient {
  final Map<String, Json> sessions = {};
  final Map<String, List<Json>> messages = {};
  final List<Json> requests = [];
  Completer<void>? createGate;
  Completer<void>? titleGate;
  bool failTitle = false;
  bool failCreate = false, conflict = false, holdStream = false;
  FakeApi(super.store) {
    baseUrl = 'https://test.markai.invalid';
  }
  @override
  Future<Json> request(
    String method,
    String path, {
    dynamic body,
    CancelToken? cancel,
  }) async {
    requests.add({'method': method, 'path': path, 'body': body});
    if (path == '/api/models') {
      return {
        'models': [
          {'id': '测试模型', 'provider': 'test'},
        ],
      };
    }
    if (path == '/api/settings') {
      return {
        'settings': {
          'general': {
            'themeMode': 'light',
            'showMessageStats': true,
            'autoScroll': true,
          },
        },
      };
    }
    if (path == '/api/tools') return {'tools': []};
    if (path.startsWith('/api/sessions?')) {
      return {'sessions': sessions.values.toList()};
    }
    if (path == '/api/sessions' && method == 'POST') {
      await createGate?.future;
      if (failCreate) throw ApiFailure('创建失败');
      final id = 's${sessions.length}';
      sessions[id] = {'id': id, 'title': '新的对话', 'revision': 0, 'updatedAt': 0};
      messages[id] = [];
      return {'session': sessions[id]};
    }
    final parts = path.split('/');
    if (parts.length >= 4 && parts[2] == 'sessions') {
      final id = parts[3];
      if (parts.length == 5 && parts[4] == 'title' && method == 'POST') {
        await titleGate?.future;
        if (failTitle) throw ApiFailure('自动命名失败');
        sessions[id]!['title'] = '自动生成的标题';
        return {'session': cloneJson(sessions[id]!)};
      }
      if (parts.length == 5 && parts[4] == 'tools') return {'toolIds': []};
      if (method == 'GET') {
        return {'session': sessions[id], 'messages': messages[id]};
      }
      if (method == 'PUT') {
        if (conflict || body['revision'] != sessions[id]!['revision']) {
          throw ApiFailure('会话已在其他位置更新', 409);
        }
        messages[id] = jsonList(body['messages']);
        sessions[id]!['revision'] = (sessions[id]!['revision'] as int) + 1;
        return {'session': sessions[id], 'messages': messages[id]};
      }
    }
    return {};
  }

  @override
  Stream<Json> chat(Json body, CancelToken cancel) async* {
    requests.add({'path': '/api/chat', 'body': body});
    yield {'type': 'reasoning', 'text': '我会先检查当前条件。'};
    yield {
      'type': 'content',
      'text': '你好！这是 **MarkAI** 的回复。\n\n- 支持流式输出\n- 保留会话历史',
    };
    if (holdStream) {
      await cancel.whenCancel;
      throw DioException(
        requestOptions: RequestOptions(),
        type: DioExceptionType.cancel,
      );
    }
    yield {'type': 'usage', 'totalTokens': 42, 'tokenUsageSource': 'provider'};
  }
}

Future<WorkspaceController> fixtureWorkspace() async {
  final store = MemoryStore(), api = FakeApi(MemoryStore());
  final controller = WorkspaceController(api, store)..connected = true;
  await controller.loadInitial();
  return controller;
}
