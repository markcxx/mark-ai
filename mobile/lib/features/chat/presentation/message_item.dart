import 'package:markai_mobile/shared/widgets/ui_icon.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/app_menu.dart';
import '../../previews/file_service.dart';
import '../../previews/generated_image.dart';
import 'speech_action.dart';
import '../application/speech_playback.dart';
import '../../../shared/widgets/app_toast.dart';
import '../../../shared/widgets/agent_avatar.dart';
import '../../../shared/widgets/selected_listenable_builder.dart';

import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'thinking_panel.dart';
import 'message_markdown.dart';
import 'translation_panel.dart';
import 'message_sources.dart';
import 'tool_call_block.dart';
import '../../previews/file_preview.dart';
import '../application/workspace_controller.dart';

class MessageItem extends StatefulWidget {
  final ChatMessage message;
  final WorkspaceController controller;
  final void Function(ChatMessage) onSelect;
  const MessageItem({
    super.key,
    required this.message,
    required this.controller,
    required this.onSelect,
  });
  @override
  State<MessageItem> createState() => _MessageItemState();
}

class _MessageItemState extends State<MessageItem> {
  ChatMessage get message => widget.message;
  WorkspaceController get controller => widget.controller;
  void Function(ChatMessage) get onSelect => widget.onSelect;
  bool editing = false, savingEdit = false, collapsed = false;
  bool actionsTapped = false, actionsHovered = false;
  Offset? pointerStart;
  late final SpeechPlayback speech;
  AppToastHostState? toastHost;
  String get speechToastId => 'speech-${message.id}';
  @override
  void initState() {
    super.initState();
    speech = SpeechPlayback(
      api: controller.api,
      onError: (error) {
        if (toastHost?.mounted == true) {
          toastHost!.show(
            error.toString(),
            kind: 'error',
            duration: const Duration(seconds: 4),
          );
        } else {
          controller.report(error);
        }
      },
      onLoading: () =>
          toastHost?.show('正在生成语音…', kind: 'loading', id: speechToastId),
      onPlaybackStart: () => toastHost?.dismiss(speechToastId),
      onStop: () => toastHost?.dismiss(speechToastId),
    )..addListener(speechChanged);
  }

  void speechChanged() {
    if (mounted) setState(() {});
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    toastHost = context.findAncestorStateOfType<AppToastHostState>();
  }

  Future<void> copyMessage() async {
    try {
      await Clipboard.setData(ClipboardData(text: message.content));
      controller.message('消息已复制', kind: 'success');
    } catch (error) {
      controller.message('复制失败，请重试', kind: 'error');
    }
  }

  final editController = TextEditingController();
  @override
  void dispose() {
    speech.removeListener(speechChanged);
    speech.dispose();
    final host = toastHost, id = speechToastId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (host?.mounted == true) host!.dismiss(id);
    });
    editController.dispose();
    super.dispose();
  }

  void startEdit() {
    editController.text = message.content;
    setState(() => editing = true);
  }

  Future<void> saveEdit() async {
    if (savingEdit) return;
    setState(() => savingEdit = true);
    try {
      await controller.updateMessage(message, editController.text);
      if (mounted) setState(() => editing = false);
    } catch (e) {
      controller.report(e);
    } finally {
      if (mounted) setState(() => savingEdit = false);
    }
  }

  Future<void> delete() async {
    if (await confirmAction(context, '删除消息', '确认删除这条消息？')) {
      await run(() => controller.deleteMessages({message.id}));
    }
  }

  Widget editor(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surface,
      border: Border.all(color: Theme.of(context).colorScheme.outline),
      borderRadius: BorderRadius.circular(12),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0f000000),
          offset: Offset(0, 8),
          blurRadius: 24,
        ),
      ],
    ),
    child: Column(
      children: [
        SizedBox(
          height: 180,
          child: TextField(
            controller: editController,
            autofocus: true,
            expands: true,
            minLines: null,
            maxLines: null,
            textAlignVertical: TextAlignVertical.top,
            style: TextStyle(
              fontSize: (controller.general['chatFontSize'] as num).toDouble(),
              height: 1.625,
            ),
            decoration: const InputDecoration(
              labelText: '编辑消息内容',
              floatingLabelBehavior: FloatingLabelBehavior.never,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            TextButton(
              onPressed: savingEdit
                  ? null
                  : () => setState(() => editing = false),
              child: const Text('取消'),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: savingEdit ? null : saveEdit,
              child: Text(savingEdit ? '保存中...' : '保存'),
            ),
          ],
        ),
      ],
    ),
  );
  String? relativeTime() {
    final time = message.data['createdAt'] as num?;
    if (time == null || time == 0) return null;
    final diff = DateTime.now().millisecondsSinceEpoch - time;
    if (diff < 10000) return '刚刚';
    if (diff < 60000) return '${diff ~/ 1000} 秒前';
    if (diff < 3600000) return '${diff ~/ 60000} 分钟前';
    if (diff < 86400000) return '${diff ~/ 3600000} 小时前';
    if (diff < 2592000000) return '${diff ~/ 86400000} 天前';
    final date = DateTime.fromMillisecondsSinceEpoch(time.toInt());
    return '${date.year}/${date.month.toString().padLeft(2, '0')}/${date.day.toString().padLeft(2, '0')}';
  }

  Widget timestamp() => SelectedListenableBuilder(
    listenable: controller.streamingRevision,
    select: relativeTime,
    builder: (context, value) => Text(
      value ?? '',
      style: const TextStyle(
        fontSize: 12,
        height: 16 / 12,
        color: Color(0xff9ca3af),
      ),
    ),
  );

  Future<void> run(Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      controller.report(e);
    }
  }

  Widget markdown(
    BuildContext context,
    String text, {
    bool reasoning = false,
    double? fontSize,
  }) => MessageMarkdown(
    message: message,
    controller: controller,
    text: text,
    reasoning: reasoning,
    fontSize: fontSize,
  );
  @override
  Widget build(BuildContext context) {
    final c = controller, m = message;
    final contentSegments = m.segments.where((s) => s['type'] == 'content');
    final showActions = actionsTapped || actionsHovered || editing;
    return TapRegion(
      onTapOutside: (_) {
        if (actionsTapped) setState(() => actionsTapped = false);
      },
      child: Listener(
        onPointerDown: (event) => pointerStart = event.position,
        onPointerUp: (event) {
          if (pointerStart != null &&
              (event.position - pointerStart!).distance < 12 &&
              !actionsTapped) {
            setState(() => actionsTapped = true);
          }
          pointerStart = null;
        },
        onPointerCancel: (_) => pointerStart = null,
        child: MouseRegion(
          onEnter: (_) => setState(() => actionsHovered = true),
          onExit: (_) => setState(() => actionsHovered = false),
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              12,
              controller.messages.indexWhere((item) => item.id == message.id) <=
                      0
                  ? 16
                  : switch (controller.general['density']) {
                      'compact' => 20,
                      'spacious' => 40,
                      _ => 32,
                    },
              12,
              0,
            ),
            child: Column(
              crossAxisAlignment: m.isUser
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                if (!m.isUser)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        const AgentAvatar(size: 36),
                        const SizedBox(width: 10),
                        Flexible(
                          child: Text(
                            m.data['model'] as String? ?? 'MarkAI',
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: 'Plus Jakarta Sans',
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0,
                            ),
                          ),
                        ),
                        if (relativeTime() != null) ...[
                          const SizedBox(width: 8),
                          Visibility(
                            visible: showActions,
                            maintainSize: true,
                            maintainAnimation: true,
                            maintainState: true,
                            child: timestamp(),
                          ),
                        ],
                      ],
                    ),
                  ),
                if (m.isUser && relativeTime() != null)
                  Visibility(
                    visible: showActions,
                    maintainSize: true,
                    maintainAnimation: true,
                    maintainState: true,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 8, right: 4),
                      child: timestamp(),
                    ),
                  ),
                if (m.attachments.isNotEmpty)
                  Wrap(
                    spacing: 6,
                    children: m.attachments
                        .map(
                          (f) => ActionChip(
                            avatar: const UiIcon(
                              Icons.insert_drive_file_outlined,
                              size: 16,
                            ),
                            label: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 200),
                              child: Text(
                                f['name'] as String? ?? '附件',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            onPressed: () =>
                                run(() => FileService(c.api).shareFile(f)),
                          ),
                        )
                        .toList(),
                  ),
                if (editing)
                  Padding(
                    padding: EdgeInsets.only(left: m.isUser ? 0 : 40),
                    child: editor(context),
                  )
                else if (m.isUser)
                  Container(
                    constraints: BoxConstraints(
                      maxWidth: MediaQuery.sizeOf(context).width * .92 - 32,
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Theme.of(context).brightness == Brightness.dark
                          ? const Color(0xff1f2023)
                          : const Color(0xfff3f4f5),
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(16),
                        topRight: Radius.circular(4),
                        bottomLeft: Radius.circular(16),
                        bottomRight: Radius.circular(16),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final s in m.segments.where(
                          (s) => s['type'] == 'quote',
                        ))
                          Text(
                            s['content'] as String? ?? '',
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.grey,
                            ),
                          ),
                        SelectableText(
                          collapsed ? '消息已收起' : m.content,
                          style: TextStyle(
                            fontSize: (c.general['chatFontSize'] as num)
                                .toDouble(),
                            height: 1.5,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  )
                else if (collapsed)
                  const Padding(
                    padding: EdgeInsets.only(left: 40),
                    child: Text(
                      '消息已收起',
                      style: TextStyle(fontSize: 14, color: Color(0xff9ca3af)),
                    ),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.only(left: 40),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (!m.segments.any((s) => s['type'] == 'thinking'))
                          ThinkingPanel(
                            content: m.data['reasoning'] as String? ?? '',
                            display:
                                c.general['thinkingDisplay'] as String? ??
                                'auto',
                            active: m.data['isReasoning'] == true,
                            duration: m.data['reasoningDuration'] as num? ?? 0,
                            child: markdown(
                              context,
                              m.data['reasoning'] as String? ?? '',
                              reasoning: true,
                            ),
                          ),
                        for (final segment in m.segments.where(
                          (s) => s['type'] != 'translation',
                        ))
                          segmentWidget(context, segment),
                        if (contentSegments.isEmpty && m.content.isNotEmpty)
                          markdown(context, m.content),
                        for (final segment in m.segments.where(
                          (s) => s['type'] == 'translation',
                        ))
                          segmentWidget(context, segment),
                        MessageAudioPlayer(playback: speech),
                        if (!m.streaming)
                          MessageSources(citations: collectMessageCitations(m)),
                        if (m.streaming &&
                            m.content.isEmpty &&
                            m.segments.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Text(
                              '正在思考…',
                              style: TextStyle(color: Colors.grey),
                            ),
                          ),
                      ],
                    ),
                  ),
                if (m.isUser)
                  for (final segment in m.segments.where(
                    (s) => s['type'] == 'translation',
                  ))
                    segmentWidget(context, segment),
                if (m.interrupted)
                  Row(
                    children: [
                      const Text(
                        '回复已中断',
                        style: TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                      TextButton(
                        onPressed: c.generating
                            ? null
                            : () => run(
                                () => c.regenerate(m, continueMessage: true),
                              ),
                        child: const Text('继续'),
                      ),
                    ],
                  ),
                if (!m.streaming)
                  IgnorePointer(
                    ignoring: !showActions,
                    child: ExcludeFocus(
                      excluding: !showActions,
                      child: ExcludeSemantics(
                        excluding: !showActions,
                        child: AnimatedOpacity(
                          opacity: showActions ? 1 : 0,
                          duration: MediaQuery.disableAnimationsOf(context)
                              ? Duration.zero
                              : const Duration(milliseconds: 150),
                          child: Padding(
                            padding: EdgeInsets.only(
                              left: m.isUser ? 0 : 40,
                              top: 8,
                              right: m.isUser ? 4 : 0,
                            ),
                            child: Wrap(
                              spacing: 4,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                if (m.isUser)
                                  MessageAction(
                                    '编辑',
                                    LucideIcons.pencil,
                                    c.generating ? null : startEdit,
                                  ),
                                MessageAction(
                                  '复制',
                                  Icons.copy_outlined,
                                  copyMessage,
                                ),

                                if (!m.isUser)
                                  MessageAction(
                                    '重新生成',
                                    Icons.refresh,
                                    c.generating
                                        ? null
                                        : () => run(
                                            () => c.regenerate(
                                              m,
                                              preserve:
                                                  c.general['overwriteRegeneratedResponse'] !=
                                                  true,
                                            ),
                                          ),
                                  ),
                                if (m.variants.length > 1) ...[
                                  MessageAction(
                                    '上一个版本',
                                    Icons.chevron_left,
                                    c.generating ? null : () => variant(-1),
                                  ),
                                  Text(
                                    '${variantIndex() + 1}/${m.variants.length}',
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                  MessageAction(
                                    '下一个版本',
                                    Icons.chevron_right,
                                    c.generating ? null : () => variant(1),
                                  ),
                                ],
                                if (!m.isUser && m.content.isNotEmpty)
                                  MessageAction(
                                    '编辑',
                                    LucideIcons.pencil,
                                    c.generating ? null : startEdit,
                                  ),
                                MessageAction(
                                  '删除',
                                  LucideIcons.trash2,
                                  c.generating ? null : delete,
                                ),
                                SpeechAction(
                                  playback: speech,
                                  onPressed: () => speech.toggle(
                                    m.content,
                                    jsonMap(c.settings['speech'])['voice']
                                            as String? ??
                                        '__system__',
                                  ),
                                  builder:
                                      (
                                        speechLabel,
                                        speechIcon,
                                        speechTap,
                                      ) => AppMenuButton(
                                        floating: true,
                                        alignRight: m.isUser,
                                        builder: (toggle) => MessageAction(
                                          '更多',
                                          LucideIcons.ellipsis,
                                          toggle,
                                        ),
                                        items: () => [
                                          if (m.isUser ||
                                              m.content.trim().isNotEmpty)
                                            AppMenuItem(
                                              '编辑',
                                              icon: LucideIcons.pencil,
                                              onPressed: startEdit,
                                            ),
                                          AppMenuItem(
                                            '复制',
                                            icon: LucideIcons.copy,
                                            onPressed: copyMessage,
                                          ),
                                          AppMenuItem(
                                            '创建子话题',
                                            icon: LucideIcons.messageSquarePlus,
                                            onPressed: () =>
                                                c.message('该功能暂未接入'),
                                          ),
                                          AppMenuItem(
                                            collapsed ? '展开消息' : '收起消息',
                                            icon: LucideIcons.minimize2,
                                            onPressed: () => setState(
                                              () => collapsed = !collapsed,
                                            ),
                                          ),
                                          if (!m.isUser &&
                                              m.content.trim().isNotEmpty)
                                            AppMenuItem(
                                              speechLabel,
                                              icon: speechIcon,
                                              onPressed: speechTap,
                                            ),
                                          if (m.content.trim().isNotEmpty)
                                            AppMenuItem(
                                              c.translating.contains(m.id)
                                                  ? '翻译中…'
                                                  : '翻译',
                                              icon: LucideIcons.languages,
                                              submenu: [
                                                for (final language in const {
                                                  'zh-CN': '简体中文',
                                                  'zh-TW': '繁体中文',
                                                  'en': 'English',
                                                  'ja': '日本語',
                                                  'ko': '한국어',
                                                  'fr': 'Français',
                                                  'de': 'Deutsch',
                                                  'es': 'Español',
                                                  'ru': 'Русский',
                                                }.entries)
                                                  AppMenuItem(
                                                    language.value,
                                                    onPressed: () {
                                                      if (!c.translating
                                                          .contains(m.id)) {
                                                        run(
                                                          () => c.translate(
                                                            m,
                                                            language.key,
                                                          ),
                                                        );
                                                      }
                                                    },
                                                  ),
                                              ],
                                            ),
                                          AppMenuItem(
                                            '分享',
                                            icon: LucideIcons.share2,
                                            onPressed: () =>
                                                c.message('该功能暂未接入'),
                                          ),
                                          AppMenuItem(
                                            '多选',
                                            icon: LucideIcons.squareCheck,
                                            onPressed: () => onSelect(m),
                                          ),
                                          AppMenuItem(
                                            '重新生成',
                                            icon: LucideIcons.rotateCw,
                                            onPressed: () => run(
                                              () => c.regenerate(
                                                m,
                                                preserve:
                                                    c.general['overwriteRegeneratedResponse'] !=
                                                    true,
                                              ),
                                            ),
                                          ),
                                          AppMenuItem(
                                            '删除',
                                            icon: LucideIcons.trash2,
                                            danger: true,
                                            onPressed: delete,
                                          ),
                                        ],
                                      ),
                                ),
                                if (!m.isUser &&
                                    c.general['showMessageStats'] != false &&
                                    m.data['totalTokens'] != null)
                                  Text(
                                    '${m.data['totalTokens'] ?? 0} tokens',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  int variantIndex() => message.variants
      .indexWhere((v) => v['id'] == message.data['activeVariantId'])
      .clamp(0, message.variants.length - 1);
  void variant(int step) {
    final variants = message.variants;
    final index = (variantIndex() + step).clamp(0, variants.length - 1);
    run(() => controller.selectVariant(message, variants[index]));
  }

  Widget segmentWidget(BuildContext context, Json s) {
    switch (s['type']) {
      case 'content':
        return markdown(context, s['content'] as String? ?? '');
      case 'thinking':
        return ThinkingPanel(
          content: s['content'] as String? ?? '',
          display: controller.general['thinkingDisplay'] as String? ?? 'auto',
          active: s['isActive'] == true,
          duration: s['duration'] as num? ?? 0,
          child: markdown(
            context,
            s['content'] as String? ?? '',
            reasoning: true,
          ),
        );
      case 'translation':
        return TranslationPanel(
          language: s['language'] as String? ?? '',
          child: markdown(context, s['content'] as String? ?? ''),
        );
      case 'tool':
        return ToolCallBlock(data: jsonMap(s['webSearch']));
      case 'generated-file':
        final file = jsonMap(s['generatedFile']);
        return ToolCallBlock(
          data: file,
          generatedFile: true,
          toolLabel:
              controller.tools
                      .where((t) => t['id'] == file['toolId'])
                      .firstOrNull?['name']
                  as String?,
          download: (f) => run(() => FileService(controller.api).saveFile(f)),
          preview: supportsNativeFilePreview(jsonMap(file['file']))
              ? (f) => showFilePreview(context, controller.api, f)
              : null,
        );
      case 'generated-image':
        final file = jsonMap(jsonMap(s['generatedImage'])['file']);
        return GeneratedImage(file: file, api: controller.api);
      case 'context-boundary':
        return const Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              Expanded(child: Divider()),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  '上下文分界',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ),
              Expanded(child: Divider()),
            ],
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}
