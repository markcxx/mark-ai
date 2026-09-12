import 'dart:async';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/app_endpoint.dart';
import '../../../core/storage/local_store.dart';
import '../../../shared/models/chat.dart';
import 'message_accumulator.dart';
import 'smooth_text_buffer.dart';
import '../../settings/default_settings.dart';

String newId() =>
    '${DateTime.now().microsecondsSinceEpoch}-${Random.secure().nextInt(1 << 32)}';

class WorkspaceController extends ChangeNotifier {
  final ApiClient api;
  final LocalStore local;
  WorkspaceController(this.api, this.local);
  bool booting = false,
      connected = false,
      guest = false,
      loadingSession = false;
  bool generating = false, webSearch = false;
  bool startupFailed = false;
  String? error, notice, activeSessionId, nextCursor;
  String noticeKind = 'blank';
  String? noticeId;
  String settingsSaveState = 'idle';
  String draft = '', search = '';
  Json? quote, queued;
  Json user = {},
      settings = {
        'general': {'themeMode': 'system'},
      };
  List<Json> attachments = [], tools = [];
  List<String> enabledTools = [];
  List<ModelRef> models = [];
  Map<String, String> providerNames = {};
  ModelRef? model;
  List<ChatSession> sessions = [];
  List<ChatMessage> messages = [];
  final Map<String, ChatSession> _sessionById = {};
  CancelToken? _generationCancel, _loadCancel;
  Future<void>? _generation;
  Completer<void>? _operation;
  bool _stopRequested = false;
  bool _disposed = false;
  int _navigation = 0, _searchRequest = 0;
  Timer? _draftTimer, _settingsTimer;
  Future<void> _localWrites = Future.value();
  final Map<String, Future<void>> _saves = {};
  final Set<String> translating = {};
  final Set<String> namingSessions = {};
  // Text/tool/usage updates do not affect the shell, history or settings.
  final streamingRevision = ValueNotifier<int>(0);

  void _notifyStreaming() {
    if (!_disposed) streamingRevision.value++;
  }

  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  final Map<String, Future<void>> _namingTasks = {};
  Future<void> waitForSessionNaming(String id) async {
    await _namingTasks[id];
  }

  String get accountKey =>
      '${api.baseUrl}:${user['id'] ?? (guest ? 'guest' : 'local')}';
  String get recoveryKey => 'recovery:$accountKey';
  ChatSession? get activeSession => _sessionById[activeSessionId];
  Future<void> waitForSessionSave(String id) async {
    await _saves[id];
  }

  Json get general => {
    ...jsonMap(defaultSettings['general']),
    ...jsonMap(settings['general']),
  };
  void report(Object e) {
    if (_disposed) return;
    error = e.toString();
    notifyListeners();
  }

  void message(String text, {String kind = 'blank', String? id}) {
    if (_disposed) return;
    notice = text;
    noticeKind = kind;
    noticeId = id;
    notifyListeners();
  }

  Future<void> start([String? address]) async {
    if (booting) return;
    booting = true;
    startupFailed = false;
    connected = false;
    notifyListeners();
    try {
      final url = resolveAppEndpoint(address);
      await api.configure(url);
      final info = await api.request('GET', '/api/public/mobile-config');
      if (info['cloudMode'] is! bool || info['protocolVersion'] != 1) {
        throw ApiFailure('服务端尚未支持安卓客户端，请先更新 MarkAI 后端');
      }
      guest = info['cloudMode'] == true;
      if (guest) {
        final session = await api.request('GET', '/api/auth/get-session');
        user = jsonMap(session['user']);
        guest = user.isEmpty;
      }
      if (guest) {
        final preferences = await local.read('guest-settings:${api.baseUrl}');
        settings = {
          ...settings,
          'general': {...general, ...preferences},
        };
      }
      draft = (await local.read('draft:$accountKey'))['text'] as String? ?? '';
      if (!guest) await loadInitial();
      connected = true;
    } catch (_) {
      // Startup feedback must not expose endpoints or raw transport errors.
      startupFailed = true;
    } finally {
      booting = false;
      notifyListeners();
    }
  }

  Future<void> loadInitial() async {
    // Both settle before releasing startup UI, including on failure.
    await Future.wait([
      (() async {
        final data = await api.request('GET', '/api/models');
        providerNames = jsonMap(data['providerNames'])
            .map((key, value) => MapEntry(key, value.toString()));
        models = jsonList(data['models']).map(ModelRef.fromJson).toList();
        final selected = jsonMap(data['selectedModel']);
        model =
            models
                .where(
                  (m) =>
                      m.id == selected['id'] &&
                      m.provider == selected['provider'],
                )
                .firstOrNull ??
            models.firstOrNull;
      })(),
      loadSessions(),
      (() async {
        final data = await api.request('GET', '/api/settings');
        settings = jsonMap(data['settings']);
        webSearch = general['defaultWebSearch'] == true;
      })(),
      (() async {
        tools = jsonList((await api.request('GET', '/api/tools'))['tools']);
      })(),
    ], eagerError: false);
    final recovery = await local.read(recoveryKey);
    if (recovery.isNotEmpty) message('有尚未保存的消息，可在设置中恢复或导出');
  }

  Future<void> login(String email, String password) async {
    await api.request(
      'POST',
      '/api/auth/sign-in/email',
      body: {'email': email.trim(), 'password': password},
    );
    final session = await api.request('GET', '/api/auth/get-session');
    user = jsonMap(session['user']);
    if (user.isEmpty) throw ApiFailure('登录未完成，请检查邮箱验证状态');
    _draftTimer?.cancel();
    guest = false;
    booting = true;
    notifyListeners();
    try {
      await loadInitial();
      await local.write('draft:$accountKey', {'text': draft});
      await local.remove('draft:${api.baseUrl}:guest');
    } finally {
      booting = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _settingsTimer?.cancel();
    _draftTimer?.cancel();
    await stop();
    await api.request('POST', '/api/auth/sign-out', body: {});
    await api.clearLogin();
    user = {};
    messages = [];
    sessions = [];
    _sessionById.clear();
    model = null;
    models = [];
    activeSessionId = null;
    guest = true;
    attachments = [];
    quote = null;
    draft = '';
    notifyListeners();
  }

  void setDraft(String value) {
    draft = value;
    _draftTimer?.cancel();
    final key = 'draft:$accountKey';
    _draftTimer = Timer(const Duration(milliseconds: 250), () {
      local.write(key, {'text': value}).catchError(report);
    });
    notifyListeners();
  }

  Future<void> loadSessions({String? query, bool more = false}) async {
    final request = ++_searchRequest;
    if (query != null) search = query;
    final q = Uri(
      queryParameters: {
        'limit': '30',
        if (search.isNotEmpty) 'q': search,
        if (more && nextCursor != null) 'cursor': nextCursor!,
      },
    ).query;
    final data = await api.request('GET', '/api/sessions?$q');
    if (request != _searchRequest) return;
    final rows = jsonList(data['sessions']).map(ChatSession.new).toList();
    sessions = more
        ? [
            ...sessions,
            ...rows.where((s) => !sessions.any((old) => old.id == s.id)),
          ]
        : rows;
    for (final s in rows) {
      _sessionById[s.id] = s;
    }
    nextCursor = data['nextCursor'] as String?;
    notifyListeners();
  }

  Future<void> openSession(String? id) async {
    final request = ++_navigation;
    _loadCancel?.cancel();
    final cancel = CancelToken();
    _loadCancel = cancel;
    queued = null;
    await stop();
    if (request != _navigation) return;
    if (id == null) {
      activeSessionId = null;
      messages = [];
      enabledTools = [];
      loadingSession = false;
      notifyListeners();
      return;
    }
    loadingSession = true;
    notifyListeners();
    try {
      await waitForSessionSave(id).catchError((_) {});
      if (request != _navigation) return;
      final results = await Future.wait([
        api.request('GET', '/api/sessions/$id', cancel: cancel),
        api.request('GET', '/api/sessions/$id/tools', cancel: cancel),
      ]);
      final result = results[0], toolResult = results[1];
      if (request != _navigation) return;
      final session = ChatSession(jsonMap(result['session']));
      _sessionById[id] = session;
      activeSessionId = id;
      messages = jsonList(result['messages']).map(ChatMessage.new).toList();
      enabledTools = (toolResult['toolIds'] as List? ?? []).cast<String>();
      model =
          models
              .where(
                (m) =>
                    m.id == session.data['model'] &&
                    m.provider == session.data['provider'],
              )
              .firstOrNull ??
          model;
    } on DioException catch (e) {
      if (!CancelToken.isCancel(e)) rethrow;
    } finally {
      if (request == _navigation) {
        loadingSession = false;
        notifyListeners();
      }
    }
  }

  Future<void> selectModel(ModelRef value) async {
    await api.request('PATCH', '/api/models', body: value.toJson());
    model = value;
    notifyListeners();
  }

  Future<ChatSession> ensureSession({String? initialMessage}) async {
    if (activeSession != null) return activeSession!;
    final result = await api.request(
      'POST',
      '/api/sessions',
      body: {
        'initialMessage': initialMessage ?? draft,
        'model': model?.id,
        'provider': model?.provider,
      },
    );
    final session = ChatSession(jsonMap(result['session']));
    activeSessionId = session.id;
    _sessionById[session.id] = session;
    sessions.insert(0, session);
    if (enabledTools.isNotEmpty) {
      await api.request(
        'PUT',
        '/api/sessions/${session.id}/tools',
        body: {'toolIds': enabledTools},
      );
    }
    return session;
  }

  Future<void> checkpoint(
    String sessionId,
    List<ChatMessage> values,
    int revision,
  ) {
    return _writeCheckpoint(
      sessionId,
      values.map((m) => m.toJson()).toList(),
      revision,
    );
  }

  // The caller owns this detached snapshot; do not serialize/copy it again.
  Future<void> _writeCheckpoint(
    String sessionId,
    List<Json> messages,
    int revision,
  ) {
    final key = recoveryKey;
    final snapshot = {
      'sessionId': sessionId,
      'revision': revision,
      'messages': messages,
    };
    final task = _localWrites.then((_) => local.write(key, snapshot));
    _localWrites = task.catchError(report);
    return task;
  }

  Future<void> persist(String id, List<ChatMessage> values) {
    final snapshot = values.map((m) => m.toJson()).toList();
    final task = (_saves[id] ?? Future<void>.value()).catchError((_) {}).then((
      _,
    ) async {
      final beforeSave = _sessionById[id]!;
      final revision = beforeSave.revision;
      await _writeCheckpoint(id, snapshot, revision);
      final data = await api.request(
        'PUT',
        '/api/sessions/$id/messages',
        body: {'messages': snapshot, 'revision': revision},
      );
      final returned = ChatSession(jsonMap(data['session']));
      final current = _sessionById[id]!;
      final session = ChatSession({
        ...returned.data,
        if (current.title != beforeSave.title) 'title': current.title,
        'updatedAt': max(current.updatedAt, returned.updatedAt),
      });
      _sessionById[id] = session;
      sessions = sessions.map((s) => s.id == id ? session : s).toList();
      await _localWrites;
      final recovery = await local.read(recoveryKey);
      if (recovery['sessionId'] == id && recovery['revision'] == revision) {
        await local.remove(recoveryKey);
      }
    });
    _saves[id] = task;
    return task;
  }

  Future<void> send() {
    // A failed queued save can be retried without taking over a newer draft.
    if (!generating && queued != null) {
      final pending = queued;
      queued = null;
      return _send(pending: pending);
    }
    return _send();
  }

  Future<void> _send({Json? pending}) async {
    if (guest) throw ApiFailure('请先登录');
    if (pending == null && draft.trim().isEmpty && attachments.isEmpty) {
      if (generating) await stop();
      return;
    }
    if (generating) {
      if (queued != null) throw ApiFailure('已有一条待发送消息');
      queued = {'content': draft, 'attachments': attachments, 'quote': quote};
      attachments = [];
      quote = null;
      setDraft('');
      return;
    }
    if (model == null || loadingSession) throw ApiFailure('请先选择可用模型');
    generating = true;
    _stopRequested = false;
    _operation = Completer<void>();
    final oldDraft = pending?['content'] as String? ?? draft;
    final oldAttachments = pending == null
        ? attachments
        : jsonList(pending['attachments']);
    final oldQuote = pending == null ? quote : pending['quote'] as Json?;
    final previousMessages = messages;
    final selectedModel = model!;
    final userMessage = ChatMessage({
      'id': newId(),
      'role': 'user',
      'content': oldDraft.trim(),
      'createdAt': DateTime.now().millisecondsSinceEpoch,
      'attachments': oldAttachments,
      'segments': [
        if (oldQuote != null) {'type': 'quote', ...oldQuote},
      ],
    });
    final next = [...messages.map((m) => m.copy()), userMessage];
    messages = next;
    if (pending == null) {
      _draftTimer?.cancel();
      draft = '';
      attachments = [];
      quote = null;
    }
    notifyListeners();
    var userSaved = false;
    try {
      final createdSession = activeSession == null;
      final session = await ensureSession(initialMessage: oldDraft);
      await persist(session.id, next);
      userSaved = true;
      if (draft.isEmpty) {
        await local.remove('draft:$accountKey');
      } else {
        await local.write('draft:$accountKey', {'text': draft});
      }
      if (!_stopRequested) {
        _generation = generate(session.id, next, selectedModel);
        await _generation;
        if (createdSession) {
          _nameInBackground(session.id);
        }
      }
    } catch (e) {
      if (!userSaved) {
        messages = previousMessages;
        if (pending != null &&
            (draft.isNotEmpty || attachments.isNotEmpty || quote != null)) {
          // Keep both the failed queued send and any newer composer draft.
          queued = pending;
        } else {
          if (draft.isEmpty) setDraft(oldDraft);
          if (attachments.isEmpty) attachments = oldAttachments;
          quote ??= oldQuote;
        }
      }
      rethrow;
    } finally {
      generating = false;
      _generation = null;
      _operation?.complete();
      _operation = null;
      notifyListeners();
    }
    final nextPending = queued;
    queued = null;
    if (nextPending != null) {
      await _send(pending: nextPending);
    }
  }

  void _nameInBackground(String id) {
    final task = smartRename(sessionId: id).catchError((Object _) {
      message('自动命名失败，可在会话菜单中重试', kind: 'error');
    });
    _namingTasks[id] = task;
    unawaited(
      task.whenComplete(() {
        if (identical(_namingTasks[id], task)) _namingTasks.remove(id);
      }),
    );
  }

  Future<void> generate(
    String sessionId,
    List<ChatMessage> history,
    ModelRef selected, {
    ChatMessage? replacement,
    String initial = '',
    List<ChatMessage>? promptHistory,
    List<ChatMessage> tail = const [],
  }) async {
    final cancel = CancelToken();
    _generationCancel = cancel;
    final assistant =
        replacement ??
        ChatMessage({
          'id': newId(),
          'role': 'model',
          'createdAt': DateTime.now().millisecondsSinceEpoch,
        });
    for (final key in [
      'generationDuration',
      'inputTokens',
      'outputTokens',
      'totalTokens',
      'reasoning',
      'reasoningDuration',
      'tokenUsageSource',
      'webSearch',
      'interrupted',
    ]) {
      assistant.data.remove(key);
    }
    assistant.data.addAll({
      'content': initial,
      'segments': [
        if (initial.isNotEmpty) {'type': 'content', 'content': initial},
      ],
      'isStreaming': true,
      'model': selected.id,
      'provider': selected.provider,
    });
    final target = [...history, assistant, ...tail];
    if (activeSessionId == sessionId) {
      messages = target;
      notifyListeners();
    }
    final accumulator = MessageAccumulator(assistant);
    final smooth =
        general['responseAnimation'] == 'smooth' &&
        general['reduceMotion'] != true;
    void commit(String type, String text) {
      accumulator.add({'type': type, 'text': text});
      if (activeSessionId == sessionId) _notifyStreaming();
    }

    final contentBuffer = SmoothTextBuffer((text) => commit('content', text));
    final reasoningBuffer = SmoothTextBuffer(
      (text) => commit('reasoning', text),
    );
    var interrupted = false;
    final tick = Stopwatch()..start();
    int lastPaint = 0, lastSave = 0;
    Future<void>? pendingCheckpoint;
    Object? checkpointError;
    try {
      await for (final event in api.chat({
        'messages': (promptHistory ?? history)
            .map((m) => m.toPrompt())
            .toList(),
        'model': selected.id,
        'provider': selected.provider,
        'sessionId': sessionId,
        'webSearchEnabled': webSearch,
      }, cancel)) {
        if (checkpointError != null) throw checkpointError!;
        if (smooth && event['type'] == 'content') {
          reasoningBuffer.flush();
          contentBuffer.push(event['text'] as String? ?? '');
        } else if (smooth && event['type'] == 'reasoning') {
          contentBuffer.flush();
          reasoningBuffer.push(event['text'] as String? ?? '');
        } else {
          contentBuffer.flush();
          reasoningBuffer.flush();
          accumulator.add(event);
        }
        if (tick.elapsedMilliseconds - lastPaint >= 32 &&
            activeSessionId == sessionId) {
          lastPaint = tick.elapsedMilliseconds;
          _notifyStreaming();
        }
        if (tick.elapsedMilliseconds - lastSave >= 1000 &&
            pendingCheckpoint == null) {
          lastSave = tick.elapsedMilliseconds;
          // Keep at most one periodic write in flight. Slow local storage must
          // not stall incoming text or accumulate a queue of full histories.
          pendingCheckpoint =
              checkpoint(sessionId, target, _sessionById[sessionId]!.revision)
                  .catchError((Object error) {
                    checkpointError = error;
                  })
                  .whenComplete(() => pendingCheckpoint = null);
        }
      }
      await reasoningBuffer.finish();
      await contentBuffer.finish();
      await pendingCheckpoint;
      if (checkpointError != null) throw checkpointError!;
    } catch (e) {
      interrupted = true;
      if (e is! DioException || !CancelToken.isCancel(e)) report(e);
    } finally {
      contentBuffer.flush();
      reasoningBuffer.flush();
      accumulator.finish(interrupted: interrupted);
      if (assistant.variants.isNotEmpty) {
        final current = assistant.toJson()
          ..remove('variants')
          ..remove('role')
          ..remove('attachments');
        current['id'] = newId();
        assistant.data['activeVariantId'] = current['id'];
        assistant.data['variants'] = [...assistant.variants, current];
      }
      await pendingCheckpoint;
      await persist(sessionId, target);
      if (identical(_generationCancel, cancel)) _generationCancel = null;
      if (activeSessionId == sessionId) notifyListeners();
    }
  }

  Future<void> stop() async {
    _stopRequested = true;
    _generationCancel?.cancel();
    try {
      await _operation?.future;
    } catch (e) {
      report(e);
    }
  }

  Future<void> regenerate(
    ChatMessage target, {
    bool continueMessage = false,
    bool preserve = false,
  }) async {
    if (generating || model == null || activeSessionId == null) return;
    final index = messages.indexWhere((m) => m.id == target.id);
    if (index < 0) return;
    final replacement = target.copy();
    if (preserve) {
      final old = target.toJson()
        ..remove('variants')
        ..remove('role')
        ..remove('attachments');
      replacement.data['variants'] = target.variants.isEmpty
          ? [old]
          : target.variants;
    } else {
      replacement.data.remove('variants');
      replacement.data.remove('activeVariantId');
    }
    generating = true;
    _stopRequested = false;
    _operation = Completer<void>();
    notifyListeners();
    try {
      _generation = generate(
        activeSessionId!,
        messages.take(index).map((m) => m.copy()).toList(),
        model!,
        replacement: replacement,
        tail: messages.skip(index + 1).map((m) => m.copy()).toList(),
        initial: continueMessage && target.content.isNotEmpty
            ? '${target.content.trimRight()}\n\n'
            : '',
        promptHistory: continueMessage
            ? [
                ...messages.take(index + 1).map((m) => m.copy()),
                ChatMessage({
                  'id': newId(),
                  'role': 'user',
                  'content': '请从上次中断的位置继续，不要重复已经输出过的内容。',
                }),
              ]
            : null,
      );
      await _generation;
    } finally {
      generating = false;
      _generation = null;
      _operation?.complete();
      _operation = null;
      notifyListeners();
    }
  }

  Future<void> updateMessage(ChatMessage target, String text) async {
    if (generating || activeSessionId == null) return;
    final id = activeSessionId!, navigation = _navigation;
    final next = messages.map((m) {
      final c = m.copy();
      if (c.id == target.id) {
        c.content = text;
        c.segments = [
          ...c.segments.where(
            (s) => s['type'] != 'content' && s['type'] != 'translation',
          ),
          {'type': 'content', 'content': text},
        ];
      }
      return c;
    }).toList();
    await persist(id, next);
    if (_disposed || activeSessionId != id || _navigation != navigation) return;
    messages = next;
    notifyListeners();
  }

  Future<void> deleteMessages(Set<String> ids) async {
    if (generating || activeSessionId == null) return;
    final id = activeSessionId!, navigation = _navigation;
    final next = messages.where((m) => !ids.contains(m.id)).toList();
    await persist(id, next);
    if (_disposed || activeSessionId != id || _navigation != navigation) return;
    messages = next;
    notifyListeners();
  }

  Future<void> selectVariant(ChatMessage target, Json variant) async {
    if (generating || activeSessionId == null) return;
    final id = activeSessionId!, navigation = _navigation;
    final next = messages
        .map(
          (m) => m.id == target.id
              ? ChatMessage({
                  'role': m.role,
                  'attachments': m.attachments,
                  ...variant,
                  'id': m.id,
                  'variants': m.variants,
                  'activeVariantId': variant['id'],
                })
              : m,
        )
        .toList();
    await persist(id, next);
    if (_disposed || activeSessionId != id || _navigation != navigation) return;
    messages = next;
    notifyListeners();
  }

  Future<void> rename(ChatSession session, String title) async {
    await api.request(
      'PATCH',
      '/api/sessions/${session.id}',
      body: {'title': title},
    );
    await loadSessions();
  }

  Future<void> smartRename({String? sessionId}) async {
    final target = sessionId ?? activeSessionId;
    if (_disposed || target == null || !namingSessions.add(target)) return;
    final account = accountKey;
    notifyListeners();
    try {
      final source = target == activeSessionId
          ? messages.map((m) => m.toJson()).toList()
          : jsonList(
              (await api.request('GET', '/api/sessions/$target'))['messages'],
            );
      if (source.isEmpty) throw ApiFailure('没有可命名的消息');
      final result = await api.request(
        'POST',
        '/api/sessions/$target/title',
        body: {'messages': source},
      );
      final data = jsonMap(result['session']);
      if (data['id'] != target) throw ApiFailure('自动命名失败，请重试');
      final updated = ChatSession(data);
      if (!_disposed &&
          accountKey == account &&
          _sessionById.containsKey(target)) {
        // A title request may finish after a newer message revision was saved.
        final current = _sessionById[target]!;
        final merged = ChatSession({
          ...current.data,
          'title': updated.title,
          'updatedAt': max(current.updatedAt, updated.updatedAt),
        });
        _sessionById[target] = merged;
        sessions = sessions.map((s) => s.id == target ? merged : s).toList();
      }
    } finally {
      namingSessions.remove(target);
      if (!_disposed) notifyListeners();
    }
  }

  Future<void> favorite(ChatSession s, {bool refresh = true}) async {
    await api.request(
      'PATCH',
      '/api/sessions/${s.id}',
      body: {'favorite': !s.favorite},
    );
    if (refresh) {
      await loadSessions();
    } else {
      final current = _sessionById[s.id] ?? s;
      final updated = ChatSession({...current.data, 'favorite': !s.favorite});
      _sessionById[s.id] = updated;
      sessions = sessions
          .map((item) => item.id == s.id ? updated : item)
          .toList();
      if (!_disposed) notifyListeners();
    }
  }

  Future<void> deleteSession(ChatSession s, {bool refresh = true}) async {
    if (s.id == activeSessionId) await openSession(null);
    await api.request('DELETE', '/api/sessions/${s.id}');
    _sessionById.remove(s.id);
    if (refresh) {
      await loadSessions();
    } else {
      sessions = sessions.where((item) => item.id != s.id).toList();
      if (!_disposed) notifyListeners();
    }
  }

  Future<void> translate(ChatMessage target, String language) async {
    final id = activeSessionId!;
    if (translating.contains(target.id)) return;
    translating.add(target.id);
    final toastId = 'translation-${target.id}';
    message('正在生成译文…', kind: 'loading', id: toastId);
    try {
      final key = general['translationModelKey'] as String? ?? '__system__';
      var selected =
          models
              .where(
                (m) =>
                    m.id == target.data['model'] &&
                    m.provider == target.data['provider'],
              )
              .firstOrNull ??
          model;
      if (selected == null) throw ApiFailure('请先配置可用模型');
      if (key.isNotEmpty && key != '__system__') {
        selected =
            models.where((m) => m.key == key).firstOrNull ??
            (throw ApiFailure('翻译模型不可用，请修改设置'));
      }
      final result = await api.request(
        'POST',
        '/api/translate',
        body: {
          'content': target.content,
          'targetLanguage': language,
          'useSystemModel': key == '__system__',
          'fallbackModel': selected.id,
          'fallbackProvider': selected.provider,
          'model': selected.id,
          'provider': selected.provider,
        },
      );
      // Fetch the latest revision so an intervening navigation or save is not overwritten.
      final latest = await api.request('GET', '/api/sessions/$id');
      _sessionById[id] = ChatSession(jsonMap(latest['session']));
      final next = jsonList(latest['messages']).map(ChatMessage.new).toList();
      final match = next.where((m) => m.id == target.id).firstOrNull;
      if (match == null || match.content != target.content) {
        throw ApiFailure('消息已更改，请重新翻译');
      }
      match.segments = [
        ...match.segments.where((s) => s['type'] != 'translation'),
        {
          'type': 'translation',
          'content': result['translation'],
          'language': result['language'],
        },
      ];
      await persist(id, next);
      if (activeSessionId == id) messages = next;
      message('译文已生成', kind: 'success', id: toastId);
    } catch (error) {
      message(error.toString(), kind: 'error', id: toastId);
    } finally {
      translating.remove(target.id);
      notifyListeners();
    }
  }

  Future<void> setTool(String id, bool enabled) async {
    if (generating) return;
    final tool = tools.firstWhere((t) => t['id'] == id);
    if (enabled && tool['installed'] != true) {
      await api.request('POST', '/api/tools/$id');
      tool['installed'] = true;
    }
    final next = {...enabledTools};
    if (enabled) {
      next.add(id);
    } else {
      next.remove(id);
    }
    if (activeSessionId != null) {
      await api.request(
        'PUT',
        '/api/sessions/$activeSessionId/tools',
        body: {'toolIds': next.toList()},
      );
    }
    enabledTools = next.toList();
    notifyListeners();
  }

  void setSetting(String key, dynamic value) {
    setSectionSetting('general', key, value);
  }

  void setSectionSetting(String section, String key, dynamic value) {
    settings = {
      ...settings,
      section: {
        ...jsonMap(defaultSettings[section]),
        ...jsonMap(settings[section]),
        key: value,
      },
    };
    settingsSaveState = 'saved';
    notifyListeners();
    _settingsTimer?.cancel();
    if (guest) {
      local.write('guest-settings:${api.baseUrl}', general).catchError(report);
      return;
    }
    final current = cloneJson(settings);
    _settingsTimer = Timer(
      const Duration(milliseconds: 400),
      () => api.request('PATCH', '/api/settings', body: current).catchError((
        Object e,
      ) {
        settingsSaveState = 'error';
        report(e);
        return <String, dynamic>{};
      }),
    );
  }

  Future<void> resetSettings() async {
    _settingsTimer?.cancel();
    settings = cloneJson(defaultSettings);
    settingsSaveState = 'saving';
    notifyListeners();
    try {
      await api.request('PATCH', '/api/settings', body: settings);
      settingsSaveState = 'saved';
    } catch (e) {
      settingsSaveState = 'error';
      report(e);
    }
    notifyListeners();
  }

  Future<void> recover() async {
    final data = await local.read(recoveryKey);
    if (data.isEmpty) {
      message('没有待恢复消息');
      return;
    }
    final id = data['sessionId'] as String;
    final latest = await api.request('GET', '/api/sessions/$id');
    final session = ChatSession(jsonMap(latest['session']));
    if (session.revision != data['revision']) {
      throw ApiFailure('服务端会话已更新，请先导出恢复副本，避免覆盖其他设备的消息');
    }
    _sessionById[id] = session;
    final recovered = jsonList(data['messages']).map(ChatMessage.new).toList();
    for (final m in recovered.where((m) => m.streaming)) {
      m.data.addAll({'isStreaming': false, 'interrupted': true});
    }
    await persist(id, recovered);
    await openSession(id);
  }

  @override
  void dispose() {
    _disposed = true;
    _draftTimer?.cancel();
    _settingsTimer?.cancel();
    _generationCancel?.cancel();
    _loadCancel?.cancel();
    streamingRevision.dispose();
    super.dispose();
  }
}
