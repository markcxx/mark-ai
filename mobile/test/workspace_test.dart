import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/core/network/api_client.dart';
import 'package:markai_mobile/features/chat/application/workspace_controller.dart';

import 'support/fake_workspace.dart';

void main() {
  late MemoryStore store;
  late FakeApi api;
  late WorkspaceController c;
  setUp(() async {
    store = MemoryStore();
    api = FakeApi(store);
    c = WorkspaceController(api, store);
    await c.loadInitial();
  });
  tearDown(() => c.dispose());
  test(
    'send immediately shows message and clears composer before network',
    () async {
      api.createGate = Completer<void>();
      c.draft = '立即显示';
      final sending = c.send();
      expect(c.generating, isTrue);
      expect(c.draft, isEmpty);
      expect(c.messages.single.content, '立即显示');
      expect(api.requests.last['body']['initialMessage'], '立即显示');
      c.setDraft('保存过程中输入的新草稿');
      api.createGate!.complete();
      await sending;
      expect(c.draft, '保存过程中输入的新草稿');
    },
  );
  test(
    'first reply names once after persistence and exposes pending state',
    () async {
      api.titleGate = Completer<void>();
      c.draft = 'first';
      final sending = c.send();
      for (var i = 0; i < 100 && c.namingSessions.isEmpty; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 1));
      }
      final id = c.activeSessionId!;
      expect(c.namingSessions, contains(id));
      expect(api.messages[id]!.last['role'], 'model');
      api.titleGate!.complete();
      await sending;
      await c.waitForSessionNaming(id);
      expect(c.namingSessions, isEmpty);
      expect(c.activeSession!.title, '自动生成的标题');
      c.draft = 'second';
      await c.send();
      expect(
        api.requests.where((r) => r['path'] == '/api/sessions/$id/title'),
        hasLength(1),
      );
    },
  );
  test('failed manual naming keeps title and clears loading state', () async {
    c.draft = 'first';
    await c.send();
    await c.waitForSessionNaming(c.activeSessionId!);
    final title = c.activeSession!.title;
    api.failTitle = true;
    await expectLater(c.smartRename(), throwsA(isA<ApiFailure>()));
    expect(c.activeSession!.title, title);
    expect(c.namingSessions, isEmpty);
  });
  test(
    'sidebar automatic naming reads the target without switching conversations',
    () async {
      c.draft = 'first';
      await c.send();
      final first = c.activeSessionId!;
      await c.openSession(null);
      c.draft = 'second';
      await c.send();
      final active = c.activeSessionId;
      await c.smartRename(sessionId: first);
      expect(c.activeSessionId, active);
      expect(c.messages.first.content, 'second');
      final request = api.requests.lastWhere(
        (r) => r['path'] == '/api/sessions/$first/title',
      );
      expect(request['body']['messages'].first['content'], 'first');
    },
  );
  test('regeneration retains downstream messages', () async {
    c.draft = 'first';
    await c.send();
    final target = c.messages.last;
    c.draft = 'second';
    await c.send();
    final later = c.messages.last.id;
    await c.regenerate(target, preserve: true);
    expect(c.messages.length, 4);
    expect(c.messages.last.id, later);
    expect(c.messages[1].variants.length, 2);
  });
  test('failed session creation restores draft and attachments', () async {
    api.failCreate = true;
    c.draft = '保留我';
    c.attachments = [
      {'id': 'file', 'name': 'a.txt'},
    ];
    await expectLater(c.send(), throwsA(isA<ApiFailure>()));
    expect(c.draft, '保留我');
    expect(c.attachments.single['id'], 'file');
    expect(c.generating, false);
    expect(c.messages, isEmpty);
  });
  test(
    'switch while creating waits, saves user, does not launch old stream',
    () async {
      api.createGate = Completer<void>();
      c.draft = 'hello';
      final sending = c.send();
      final navigation = c.openSession(null);
      api.createGate!.complete();
      await sending;
      await navigation;
      expect(c.activeSessionId, isNull);
      expect(c.messages, isEmpty);
      expect(api.requests.where((r) => r['path'] == '/api/chat'), isEmpty);
      expect(api.messages['s0']!.single['content'], 'hello');
    },
  );
  test(
    'navigation aborts streaming and persists interrupted original session',
    () async {
      api.holdStream = true;
      c.draft = 'hello';
      final sending = c.send();
      while (!api.requests.any((r) => r['path'] == '/api/chat')) {
        await Future<void>.delayed(Duration.zero);
      }
      await c.openSession(null);
      await sending;
      expect(c.messages, isEmpty);
      expect(c.activeSessionId, isNull);
      expect(api.messages['s0']!.last['interrupted'], true);
    },
  );
  test('revision conflict keeps recovery copy without blind retry', () async {
    c.draft = 'first';
    await c.send();
    api.conflict = true;
    final original = api.messages['s0']!.first['content'];
    await expectLater(
      c.updateMessage(c.messages.first, 'changed'),
      throwsA(isA<ApiFailure>()),
    );
    expect(api.messages['s0']!.first['content'], original);
    expect((await store.read(c.recoveryKey))['messages'], isNotEmpty);
  });
  test(
    'continue includes original output and explicit continuation instruction',
    () async {
      c.draft = 'hello';
      await c.send();
      final original = c.messages.last;
      await c.regenerate(original, continueMessage: true);
      final body = api.requests.lastWhere(
        (r) => r['path'] == '/api/chat',
      )['body'];
      expect(body['messages'].last['content'], '请从上次中断的位置继续，不要重复已经输出过的内容。');
      expect(c.messages.length, 2);
      expect(c.messages.last.content, startsWith(original.content));
    },
  );
}
