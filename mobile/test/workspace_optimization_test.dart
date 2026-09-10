import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/core/network/api_client.dart';
import 'package:markai_mobile/features/chat/application/workspace_controller.dart';
import 'package:markai_mobile/shared/models/chat.dart';

import 'support/fake_workspace.dart';

class ControlledApi extends FakeApi {
  ControlledApi(super.store);
  Completer<void>? saveGate, readGate;
  final events = StreamController<Json>();
  bool controlledStream = false;
  Json? titleResponse;
  String? rejectedMessage;
  @override
  Future<Json> request(
    String method,
    String path, {
    dynamic body,
    CancelToken? cancel,
  }) async {
    if (method == 'PUT' && path.endsWith('/messages')) {
      await saveGate?.future;
      if (rejectedMessage != null &&
          jsonList(body['messages']).last['content'] == rejectedMessage) {
        throw ApiFailure('保存失败，请重试');
      }
    }
    if (method == 'GET' && path == '/api/sessions/s0') await readGate?.future;
    final result = await super.request(
      method,
      path,
      body: body,
      cancel: cancel,
    );
    return path.endsWith('/title') ? titleResponse ?? result : result;
  }

  @override
  Stream<Json> chat(Json body, CancelToken cancel) async* {
    if (!controlledStream) {
      yield* super.chat(body, cancel);
      return;
    }
    requests.add({'path': '/api/chat', 'body': body});
    yield* events.stream;
  }
}

class SlowStore extends MemoryStore {
  Completer<void>? gate;
  int pending = 0, maxPending = 0;
  @override
  Future<void> write(String key, Json value) async {
    if (key.startsWith('recovery:') && gate != null) {
      pending++;
      if (pending > maxPending) maxPending = pending;
      await gate!.future;
      pending--;
    }
    await super.write(key, value);
  }
}

Future<void> until(bool Function() condition) async {
  for (var i = 0; i < 1000; i++) {
    if (condition()) return;
    await Future<void>.delayed(const Duration(milliseconds: 1));
  }
  fail('Timed out waiting for test operation');
}

void main() {
  late SlowStore store;
  late ControlledApi api;
  late WorkspaceController c;
  setUp(() async {
    store = SlowStore();
    api = ControlledApi(store);
    c = WorkspaceController(api, store);
    await c.loadInitial();
  });
  tearDown(() {
    c.dispose();
  });

  test('queued send preserves newer draft, attachments and quote', () async {
    api.holdStream = true;
    c.draft = 'first';
    final sending = c.send();
    await until(() => api.requests.any((r) => r['path'] == '/api/chat'));
    c.setDraft('queued second');
    await c.send();
    c.setDraft('unsent third');
    c.attachments = [
      {'id': 'third-file', 'name': 'third.txt'},
    ];
    c.quote = {'content': 'third quote'};
    api.holdStream = false;
    await c.stop();
    await sending;
    expect(c.draft, 'unsent third');
    expect(c.attachments.single['id'], 'third-file');
    expect(c.quote!['content'], 'third quote');
    expect(c.messages.where((m) => m.isUser).map((m) => m.content), [
      'first',
      'queued second',
    ]);
    expect((await store.read('draft:${c.accountKey}'))['text'], 'unsent third');
  });

  test(
    'failed queued save can retry while preserving the newer draft',
    () async {
      api.holdStream = true;
      c.draft = 'first';
      final sending = c.send();
      await until(() => api.requests.any((r) => r['path'] == '/api/chat'));
      c.setDraft('queued second');
      await c.send();
      c.setDraft('unsent third');
      api.rejectedMessage = 'queued second';
      api.holdStream = false;
      final failure = expectLater(sending, throwsA(isA<ApiFailure>()));
      await c.stop();
      await failure;
      expect(c.draft, 'unsent third');
      expect(c.queued!['content'], 'queued second');
      api.rejectedMessage = null;
      await c.send();
      expect(c.messages.where((m) => m.isUser).map((m) => m.content), [
        'first',
        'queued second',
      ]);
      expect(c.draft, 'unsent third');
      expect(c.queued, isNull);
    },
  );

  for (final action in ['edit', 'delete', 'variant']) {
    test(
      '$action completion never replaces a newly opened conversation',
      () async {
        c.draft = 'first';
        await c.send();
        final target = c.messages.last;
        api.saveGate = Completer<void>();
        final saving = switch (action) {
          'edit' => c.updateMessage(target, 'edited'),
          'delete' => c.deleteMessages({target.id}),
          _ => c.selectVariant(target, {
            ...target.toJson(),
            'id': 'variant',
            'content': 'variant content',
          }),
        };
        await Future<void>.delayed(Duration.zero);
        await c.openSession(null);
        api.saveGate!.complete();
        await saving;
        expect(c.activeSessionId, isNull);
        expect(c.messages, isEmpty);
        final saved = api.messages['s0']!;
        if (action == 'delete') {
          expect(saved, hasLength(1));
        } else {
          expect(
            saved.last['content'],
            action == 'edit' ? 'edited' : 'variant content',
          );
        }
      },
    );
  }

  test(
    'reopening a session waits for its pending mutation before fetching',
    () async {
      c.draft = 'first';
      await c.send();
      api.saveGate = Completer<void>();
      final saving = c.updateMessage(c.messages.first, 'edited');
      await c.openSession(null);
      final reopening = c.openSession('s0');
      await Future<void>.delayed(Duration.zero);
      api.saveGate!.complete();
      await saving;
      await reopening;
      expect(c.messages.first.content, 'edited');
    },
  );

  test(
    'automatic naming does not block navigation or subsequent generation',
    () async {
      api.titleGate = Completer<void>();
      c.draft = 'first';
      await c.send();
      expect(c.generating, isFalse);
      expect(c.namingSessions, contains('s0'));
      api.titleResponse = {
        'session': {...api.sessions['s0']!, 'title': '自动生成的标题'},
      };
      await c.openSession(null);
      expect(c.activeSessionId, isNull);
      await c.openSession('s0');
      c.draft = 'second';
      await c.send();
      final revision = c.activeSession!.revision;
      api.titleGate!.complete();
      await c.waitForSessionNaming('s0');
      expect(c.activeSession!.revision, revision);
      expect(c.activeSession!.title, '自动生成的标题');
    },
  );

  test(
    'session tools begin loading without waiting for message response',
    () async {
      c.draft = 'first';
      await c.send();
      api.readGate = Completer<void>();
      final opening = c.openSession('s0');
      await until(
        () => api.requests.any((r) => r['path'] == '/api/sessions/s0/tools'),
      );
      expect(c.loadingSession, isTrue);
      api.readGate!.complete();
      await opening;
      expect(c.messages, hasLength(2));
    },
  );

  test(
    'stream text bypasses shell notifications and slow checkpoints',
    () async {
      api.controlledStream = true;
      c.settings['general']['responseAnimation'] = 'none';
      c.draft = 'first';
      final sending = c.send();
      await until(() => api.requests.any((r) => r['path'] == '/api/chat'));
      var shellNotifications = 0, streamNotifications = 0;
      c.addListener(() => shellNotifications++);
      c.streamingRevision.addListener(() => streamNotifications++);
      store.gate = Completer<void>();
      await Future<void>.delayed(const Duration(milliseconds: 1050));
      api.events.add({'type': 'content', 'text': 'one'});
      await until(() => store.pending == 1);
      await Future<void>.delayed(const Duration(milliseconds: 40));
      api.events.add({'type': 'content', 'text': 'two'});
      await until(() => c.messages.last.content == 'onetwo');
      expect(shellNotifications, 0);
      expect(streamNotifications, greaterThanOrEqualTo(2));
      expect(store.maxPending, 1);
      store.gate!.complete();
      await api.events.close();
      await sending;
      expect(api.messages['s0']!.last['content'], 'onetwo');
      expect(await store.read(c.recoveryKey), isEmpty);
    },
  );
}
