import 'export_dialog.dart';

import 'package:markai_mobile/shared/widgets/ui_icon.dart';

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/app_menu.dart';
import '../../../shared/widgets/agent_avatar.dart';

import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'workspace_sidebar.dart';
import 'welcome_caption.dart';
import '../../../shared/widgets/app_dialog.dart';
import 'share_dialog.dart';
import 'plugin_center.dart';
import 'tool_menu.dart';
import 'workspace_shell.dart';
import 'model_selector.dart';
import 'context_indicator.dart';
import '../../../shared/models/model_metadata.dart';
import '../../../shared/models/chat.dart';
import '../../auth/auth_screen.dart';
import '../../auth/guest_screen.dart';
import '../../previews/file_service.dart';
import '../../settings/settings_screen.dart';
import '../application/workspace_controller.dart';
import 'message_item.dart';

class ChatScreen extends StatefulWidget {
  final WorkspaceController controller;
  const ChatScreen({super.key, required this.controller});
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with WidgetsBindingObserver {
  bool sidebarOpen = false, toolMenuOpen = false, settingsOpen = false;
  void closeSidebar() => setState(() => sidebarOpen = false);
  final input = TextEditingController(), scroll = ScrollController();
  final composerFocus = FocusNode();
  final imagePicker = ImagePicker();
  bool pickingAttachment = false;
  final toolAnchor = GlobalKey(), titleAnchor = GlobalKey();
  final selected = <String>{};
  bool follow = true, uploading = false;
  double uploadProgress = 0;
  CancelToken? uploadCancel;
  Timer? searchDebounce;
  WorkspaceController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    c.addListener(changed);
    c.streamingRevision.addListener(changed);
    input.text = c.draft;
    WidgetsBinding.instance.addPostFrameCallback((_) => recoverPickedImages());
  }

  @override
  void dispose() {
    composerFocus.dispose();
    WidgetsBinding.instance.removeObserver(this);
    c.removeListener(changed);
    c.streamingRevision.removeListener(changed);
    input.dispose();
    scroll.dispose();
    searchDebounce?.cancel();
    uploadCancel?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused &&
        c.activeSession != null &&
        c.generating) {
      c
          .checkpoint(c.activeSessionId!, c.messages, c.activeSession!.revision)
          .catchError(c.report);
    }
  }

  void changed() {
    if (input.text != c.draft) {
      input.value = TextEditingValue(
        text: c.draft,
        selection: TextSelection.collapsed(offset: c.draft.length),
      );
    }
    if (follow && c.general['autoScroll'] != false) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && scroll.hasClients) {
          scroll.jumpTo(scroll.position.maxScrollExtent);
        }
      });
    }
  }

  Future<void> run(Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      c.report(e);
    }
  }

  Future<void> protected(Future<void> Function() action) async {
    if (c.guest) {
      await showLogin(context, c);
      return;
    }
    await run(action);
  }

  Future<void> sendMessage() async {
    composerFocus.unfocus();
    await protected(c.send);
  }

  Widget messageItem(ChatMessage message) => MessageItem(
    key: ValueKey(message.id),
    message: message,
    controller: c,
    onSelect: (m) => setState(() => selected.add(m.id)),
  );

  Future<void> recoverPickedImages() async {
    if (!mounted ||
        c.guest ||
        defaultTargetPlatform != TargetPlatform.android) {
      return;
    }
    try {
      final lost = await imagePicker.retrieveLostData();
      if (!mounted || lost.isEmpty) return;
      if (lost.files != null) {
        await uploadPicked(lost.files!);
      } else {
        c.message('未能恢复上次选择的图片，请重新选择', kind: 'error');
      }
    } on MissingPluginException {
      // Widget tests and hosts without the Android picker have no recovery channel.
    } catch (_) {
      if (mounted) c.message('恢复图片失败，请重新选择', kind: 'error');
    }
  }

  Future<void> attach(String source) async {
    if (uploading || pickingAttachment) return;
    composerFocus.unfocus();
    await protected(() async {
      if (c.attachments.length >= 4) throw ApiFailureForUi('最多添加 4 个附件');
      setState(() => pickingAttachment = true);
      try {
        final List<XFile> result;
        if (source == 'camera') {
          final file = await imagePicker.pickImage(source: ImageSource.camera);
          result = file == null ? [] : [file];
        } else if (source == 'images') {
          result = await imagePicker.pickMultiImage();
        } else {
          result = (await FilePicker.pickFiles())
              .map((file) => file.xFile)
              .toList();
        }
        if (!mounted || result.isEmpty) return;
        await uploadPicked(result);
      } on PlatformException {
        throw ApiFailureForUi('无法打开相机或文件选择器，请检查系统权限后重试');
      } finally {
        if (mounted) setState(() => pickingAttachment = false);
      }
    });
  }

  Future<void> uploadPicked(List<XFile> result) async {
    if (result.length + c.attachments.length > 4) {
      throw ApiFailureForUi('最多添加 4 个附件');
    }
    setState(() => uploading = true);
    uploadCancel = CancelToken();
    try {
      for (final file in result) {
        final attachment = await FileService(c.api)
            .uploadPath(file.path, file.name, uploadCancel!, (v) {
              if (mounted) setState(() => uploadProgress = v);
            });
        c.attachments = [...c.attachments, attachment];
        c.setDraft(c.draft);
      }
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  Future<void> modelMenu() async {
    await protected(() async {
      await showAppDialog(context, (_) => ModelSelector(controller: c));
    });
  }

  Future<void> toolMenu() async {
    await protected(() async {
      final box = toolAnchor.currentContext?.findRenderObject() as RenderBox?;
      if (box == null) return;
      setState(() => toolMenuOpen = true);
      try {
        await showToolMenu(
          context,
          c,
          box.localToGlobal(Offset.zero) & box.size,
        );
      } finally {
        if (mounted) setState(() => toolMenuOpen = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: c,
    builder: (context, _) {
      if (c.guest && !c.booting) return GuestScreen(controller: c);
      final scheme = Theme.of(context).colorScheme;
      return WorkspaceShell(
        open: sidebarOpen,
        reduceMotion: c.general['reduceMotion'] == true,
        sidebarWidth: (c.general['sidebarWidth'] as num?)?.toDouble() ?? 260,
        onClose: closeSidebar,
        onOpen: () {
          composerFocus.unfocus();
          setState(() => sidebarOpen = true);
        },
        sidebar: drawer(context),
        child: IndexedStack(
          index: settingsOpen ? 1 : 0,
          children: [
            Scaffold(
              appBar: AppBar(
                automaticallyImplyLeading: false,
                leadingWidth: sidebarOpen ? 8 : 56,
                leading: sidebarOpen
                    ? const SizedBox()
                    : ActionIcon(
                        '展开侧栏',
                        Icons.view_sidebar_outlined,
                        () => setState(() => sidebarOpen = !sidebarOpen),
                      ),
                titleSpacing: 8,
                title: Row(
                  key: titleAnchor,
                  children: [
                    Flexible(
                      child: Text(
                        c.namingSessions.contains(c.activeSessionId)
                            ? '...'
                            : c.activeSession?.title ?? '新对话',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 12),
                    AppMenuButton(
                      width: 224,
                      positionAnchor: titleAnchor,
                      horizontalOffset: -8,
                      topOffset: 44,
                      items: () => [
                        AppMenuItem(
                          '智能重命名',
                          icon: LucideIcons.sparkles,
                          onPressed: () => sessionAction('smart'),
                        ),
                        AppMenuItem(
                          '重命名',
                          icon: LucideIcons.pencilLine,
                          onPressed: () => sessionAction('rename'),
                        ),
                        AppMenuItem(
                          c.activeSession?.favorite == true ? '取消收藏' : '收藏',
                          icon: LucideIcons.star,
                          onPressed: () => sessionAction('favorite'),
                        ),
                        AppMenuItem(
                          '复制会话 ID',
                          icon: LucideIcons.copy,
                          onPressed: () => sessionAction('id'),
                        ),
                        AppMenuItem(
                          '全宽显示',
                          icon: c.general['wideChatMode'] == true
                              ? LucideIcons.shrink
                              : LucideIcons.expand,
                          checked: c.general['wideChatMode'] == true,
                          keepOpen: true,
                          onPressed: () => c.setSetting(
                            'wideChatMode',
                            c.general['wideChatMode'] != true,
                          ),
                        ),
                        const AppMenuItem.divider(),
                        AppMenuItem(
                          '删除会话',
                          icon: LucideIcons.trash2,
                          danger: true,
                          onPressed: () => sessionAction('delete'),
                        ),
                      ],
                      builder: (toggle) => ActionIcon(
                        '会话操作',
                        LucideIcons.ellipsisVertical,
                        toggle,
                        iconSize: 17,
                        buttonWidth: 40,
                        buttonHeight: 40,
                      ),
                    ),
                  ],
                ),
                actions: [
                  ActionIcon(
                    '切换主题',
                    Theme.of(context).brightness == Brightness.dark
                        ? Icons.light_mode_outlined
                        : Icons.dark_mode_outlined,
                    () => c.setSetting(
                      'themeMode',
                      Theme.of(context).brightness == Brightness.dark
                          ? 'light'
                          : 'dark',
                    ),
                    buttonWidth: 40,
                    buttonHeight: 40,
                  ),
                  const SizedBox(width: 4),
                  AppMenuButton(
                    width: 192,
                    alignRight: true,
                    topOffset: 44,
                    items: () => [
                      if (c.activeSession != null)
                        AppMenuItem(
                          '分享链接',
                          icon: LucideIcons.link2,
                          onPressed: () => sessionAction('share'),
                        ),
                      AppMenuItem(
                        '复制对话',
                        icon: LucideIcons.copy,
                        onPressed: () => sessionAction('copy'),
                      ),
                      AppMenuItem(
                        '导出 JSON',
                        icon: LucideIcons.fileJson,
                        onPressed: () => sessionAction('export'),
                      ),
                      AppMenuItem(
                        '导出图片',
                        icon: LucideIcons.imageDown,
                        onPressed: () => sessionAction('image'),
                      ),
                    ],
                    builder: (toggle) => ActionIcon(
                      '分享与导出',
                      LucideIcons.share2,
                      toggle,
                      iconSize: 20,
                      buttonWidth: 40,
                      buttonHeight: 40,
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
              ),
              body: SafeArea(
                top: false,
                child: c.booting || c.loadingSession
                    ? skeleton()
                    : Column(
                        children: [
                          Expanded(
                            child: c.messages.isEmpty
                                ? LayoutBuilder(
                                    builder: (context, box) => SingleChildScrollView(
                                      child: ConstrainedBox(
                                        constraints: BoxConstraints(
                                          minHeight: (box.maxHeight - 24).clamp(
                                            0,
                                            double.infinity,
                                          ),
                                        ),
                                        child: Center(
                                          child: Padding(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 16,
                                            ),
                                            child: ConstrainedBox(
                                              constraints: const BoxConstraints(
                                                maxWidth: 840,
                                              ),
                                              child: Column(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Row(
                                                    mainAxisAlignment:
                                                        MainAxisAlignment
                                                            .center,
                                                    children: [
                                                      const SizedBox(
                                                        width: 64,
                                                        height: 64,
                                                        child: OverflowBox(
                                                          maxWidth: 72,
                                                          maxHeight: 72,
                                                          child: AgentAvatar(
                                                            size: 72,
                                                          ),
                                                        ),
                                                      ),
                                                      const SizedBox(width: 12),
                                                      Flexible(
                                                        child: Column(
                                                          crossAxisAlignment:
                                                              CrossAxisAlignment
                                                                  .start,
                                                          children: [
                                                            const Text(
                                                              'MARKAI',
                                                              style: TextStyle(
                                                                fontFamily: 'Plus Jakarta Sans',
                                                                fontSize: 24,
                                                                height: 32 / 24,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w600,
                                                              ),
                                                            ),
                                                            const SizedBox(
                                                              height: 8,
                                                            ),
                                                            const WelcomeCaption(),
                                                          ],
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                  const SizedBox(height: 24),
                                                  composer(context),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  )
                                : NotificationListener<ScrollNotification>(
                                    onNotification: (event) {
                                      if (event is UserScrollNotification) {
                                        follow =
                                            scroll.position.extentAfter < 80;
                                      }
                                      return false;
                                    },
                                    child: ListView.builder(
                                      controller: scroll,
                                      padding: const EdgeInsets.only(
                                        bottom: 20,
                                      ),
                                      itemCount: c.messages.length,
                                      itemBuilder: (context, index) {
                                        final m = c.messages[index];
                                        return Center(
                                          child: AnimatedContainer(
                                            duration: Duration(
                                              milliseconds:
                                                  c.general['reduceMotion'] ==
                                                      true
                                                  ? 0
                                                  : 250,
                                            ),
                                            constraints: BoxConstraints(
                                              maxWidth:
                                                  c.general['wideChatMode'] ==
                                                      true
                                                  ? MediaQuery.sizeOf(context)
                                                        .width
                                                  : 840,
                                            ),
                                            child: Row(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                if (selected.isNotEmpty)
                                                  Padding(
                                                    padding:
                                                        const EdgeInsets.only(
                                                          top: 20,
                                                        ),
                                                    child: Checkbox(
                                                      value: selected.contains(
                                                        m.id,
                                                      ),
                                                      onChanged: (_) =>
                                                          setState(() {
                                                            selected.contains(
                                                                  m.id,
                                                                )
                                                                ? selected
                                                                      .remove(
                                                                        m.id,
                                                                      )
                                                                : selected.add(
                                                                    m.id,
                                                                  );
                                                          }),
                                                    ),
                                                  ),
                                                Expanded(
                                                  child: ListenableBuilder(
                                                    key: ValueKey(m.id),
                                                    listenable:
                                                        c.streamingRevision,
                                                    // Stable completed messages are reused on each stream tick.
                                                    child: m.streaming
                                                        ? null
                                                        : messageItem(m),
                                                    builder: (context, child) =>
                                                        child ?? messageItem(m),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                          ),
                          ListenableBuilder(
                            listenable: c.streamingRevision,
                            builder: (context, _) =>
                                !follow && c.messages.isNotEmpty
                                ? Align(
                                    alignment: Alignment.centerRight,
                                    child: ActionIcon(
                                      '回到底部',
                                      Icons.arrow_downward,
                                      () {
                                        follow = true;
                                        scroll.animateTo(
                                          scroll.position.maxScrollExtent,
                                          duration: const Duration(
                                            milliseconds: 200,
                                          ),
                                          curve: Curves.easeOut,
                                        );
                                      },
                                    ),
                                  )
                                : const SizedBox.shrink(),
                          ),
                          if (selected.isNotEmpty)
                            Container(
                              decoration: BoxDecoration(
                                border: Border(
                                  top: BorderSide(color: scheme.outline),
                                ),
                              ),
                              child: Row(
                                children: [
                                  TextButton(
                                    onPressed: () => setState(selected.clear),
                                    child: const Text('取消'),
                                  ),
                                  Expanded(
                                    child: Text('已选 ${selected.length} 条'),
                                  ),
                                  ActionIcon(
                                    '复制选中消息',
                                    Icons.copy,
                                    () => Clipboard.setData(
                                      ClipboardData(
                                        text: c.messages
                                            .where(
                                              (m) => selected.contains(m.id),
                                            )
                                            .map((m) => m.content)
                                            .join('\n\n'),
                                      ),
                                    ),
                                  ),
                                  ActionIcon(
                                    '删除选中消息',
                                    Icons.delete_outline,
                                    () async {
                                      if (await confirmAction(
                                        context,
                                        '删除消息',
                                        '确认删除选中的 ${selected.length} 条消息？',
                                      )) {
                                        await run(
                                          () => c.deleteMessages(selected),
                                        );
                                        setState(selected.clear);
                                      }
                                    },
                                  ),
                                ],
                              ),
                            )
                          else if (c.messages.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                              child: AnimatedContainer(
                                duration: Duration(
                                  milliseconds:
                                      c.general['reduceMotion'] == true
                                      ? 0
                                      : 250,
                                ),
                                constraints: BoxConstraints(
                                  maxWidth: c.general['wideChatMode'] == true
                                      ? MediaQuery.sizeOf(context).width
                                      : 840,
                                ),
                                child: composer(context),
                              ),
                            ),
                        ],
                      ),
              ),
            ),
            if (settingsOpen)
              SettingsScreen(
                controller: c,
                sidebarOpen: sidebarOpen,
                onBack: () => setState(() => settingsOpen = false),
                onOpenSidebar: () => setState(() => sidebarOpen = true),
              ),
          ],
        ),
      );
    },
  );
  Widget composer(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final hasDraft = c.draft.trim().isNotEmpty || c.attachments.isNotEmpty;
    final stopping = c.generating && !hasDraft;
    final sendDisabled =
        uploading ||
        c.model == null ||
        (!hasDraft && !c.generating) ||
        (c.generating && c.queued != null && hasDraft);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (c.queued != null)
          Row(
            children: [
              const Expanded(
                child: Text(
                  '1 条消息待发送',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ),
              ActionIcon('取消待发送', Icons.close, () {
                c.queued = null;
                c.setDraft(c.draft);
              }),
            ],
          ),
        Container(
          decoration: BoxDecoration(
            color: scheme.surface,
            border: Border.all(color: scheme.outline),
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: .035),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (c.quote != null)
                Padding(
                  padding: const EdgeInsets.only(left: 12),
                  child: Row(
                    children: [
                      const UiIcon(Icons.subdirectory_arrow_right, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          c.quote!['content'] as String,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.grey,
                          ),
                        ),
                      ),
                      ActionIcon('移除引用', Icons.close, () {
                        c.quote = null;
                        c.setDraft(c.draft);
                      }),
                    ],
                  ),
                ),
              if (c.attachments.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Wrap(
                    spacing: 4,
                    children: c.attachments
                        .map(
                          (file) => InputChip(
                            label: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 170),
                              child: Text(
                                file['name'] as String,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            onDeleted: () {
                              c.attachments = c.attachments
                                  .where((f) => f['id'] != file['id'])
                                  .toList();
                              c.setDraft(c.draft);
                            },
                          ),
                        )
                        .toList(),
                  ),
                ),
              if (uploading)
                Row(
                  children: [
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: LinearProgressIndicator(value: uploadProgress),
                      ),
                    ),
                    ActionIcon(
                      '取消上传',
                      Icons.close,
                      () => uploadCancel?.cancel(),
                    ),
                  ],
                ),
              Focus(
                onKeyEvent: (_, event) {
                  if (event is! KeyDownEvent ||
                      event.logicalKey != LogicalKeyboardKey.enter ||
                      input.value.composing.isValid &&
                          !input.value.composing.isCollapsed) {
                    return KeyEventResult.ignored;
                  }
                  final keyboard = HardwareKeyboard.instance;
                  final send = c.general['sendShortcut'] == 'mod-enter'
                      ? keyboard.isControlPressed || keyboard.isMetaPressed
                      : !keyboard.isShiftPressed;
                  if (!send) return KeyEventResult.ignored;
                  if (!uploading && c.model != null) sendMessage();
                  return KeyEventResult.handled;
                },
                child: TextField(
                  enabled: c.model != null,
                  controller: input,
                  focusNode: composerFocus,
                  onTapOutside: (_) => composerFocus.unfocus(),
                  minLines: 1,
                  maxLines: 6,
                  style: const TextStyle(
                    fontSize: 16,
                    height: 1.5,
                    letterSpacing: 0,
                  ),
                  onChanged: c.setDraft,
                  keyboardType: TextInputType.multiline,
                  decoration: InputDecoration(
                    hintText: c.model == null
                        ? '正在加载可用模型列表……'
                        : isImageGenerationModel(c.model!.id)
                        ? '描述想生成的画面，或上传图片继续修改...'
                        : '尽管问，带图也行...',
                    hintStyle: const TextStyle(
                      color: Color(0xff9ca3af),
                      fontSize: 16,
                      fontWeight: FontWeight.w400,
                    ),
                    constraints: const BoxConstraints(minHeight: 56),
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 4, 10, 10),
                child: Row(
                  children: [
                    AppMenuButton(
                      width: 160,
                      radius: 8,
                      items: () => [
                        AppMenuItem(
                          '图片',
                          icon: LucideIcons.image,
                          onPressed: () => attach('images'),
                        ),
                        AppMenuItem(
                          '文件',
                          icon: LucideIcons.file,
                          onPressed: () => attach('files'),
                        ),
                        AppMenuItem(
                          '相机',
                          icon: LucideIcons.camera,
                          onPressed: () => attach('camera'),
                        ),
                      ],
                      builder: (toggle) => ActionIcon(
                        '添加附件',
                        Icons.attach_file,
                        uploading || pickingAttachment ? null : toggle,
                        iconSize: 20,
                        color: const Color(0xff9ca3af),
                      ),
                    ),
                    const SizedBox(width: 4),
                    if (!c.guest)
                      KeyedSubtree(
                        key: toolAnchor,
                        child: Tooltip(
                          message: '当前会话工具',
                          child: Material(
                            color: toolMenuOpen
                                ? (Theme.of(context).brightness ==
                                          Brightness.dark
                                      ? const Color(0xff1f2937)
                                      : const Color(0xfff3f4f6))
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(8),
                              onTap:
                                  c.generating ||
                                      isImageGenerationModel(c.model?.id ?? '')
                                  ? null
                                  : toolMenu,
                              child: SizedBox(
                                height: 44,
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const UiIcon(
                                        LucideIcons.wrench,
                                        size: 18,
                                        color: Color(0xff9ca3af),
                                      ),
                                      if (c.enabledTools.isNotEmpty) ...[
                                        const SizedBox(width: 4),
                                        Text(
                                          '${c.enabledTools.length}',
                                          style: const TextStyle(fontSize: 12),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(width: 4),
                    ActionIcon(
                      c.webSearch ? '关闭联网搜索' : '开启联网搜索',
                      c.webSearch ? LucideIcons.globe : LucideIcons.globeOff,
                      c.generating || isImageGenerationModel(c.model?.id ?? '')
                          ? null
                          : () => protected(() async {
                              c.webSearch = !c.webSearch;
                              c.setDraft(c.draft);
                            }),
                      buttonWidth: 34,
                      color: c.webSearch
                          ? scheme.primary
                          : const Color(0xff9ca3af),
                    ),
                    const Spacer(),
                    if (c.messages.isNotEmpty)
                      ListenableBuilder(
                        listenable: c.streamingRevision,
                        builder: (context, _) =>
                            ContextIndicator(controller: c),
                      ),
                    Tooltip(
                      message: c.model?.id ?? '选择模型',
                      child: TextButton(
                        style: TextButton.styleFrom(
                          minimumSize: Size.zero,
                          fixedSize: const Size.fromHeight(44),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                        ),
                        onPressed: c.generating ? null : modelMenu,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            ModelBrand(
                              model: c.model?.id ?? '',
                              provider: c.model?.provider ?? '',
                            ),
                            if (MediaQuery.sizeOf(context).width >= 640)
                              ConstrainedBox(
                                constraints: const BoxConstraints(
                                  maxWidth: 140,
                                ),
                                child: Text(
                                  c.model?.label ?? '选择模型',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            const SizedBox(width: 8),
                            const UiIcon(
                              LucideIcons.chevronRight,
                              size: 14,
                              color: Color(0xff9ca3af),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 2),
                    IconButton.filled(
                      tooltip: c.generating && !hasDraft
                          ? '停止生成'
                          : c.generating
                          ? '加入待发送'
                          : '发送消息',
                      onPressed: sendDisabled ? null : sendMessage,
                      constraints: const BoxConstraints.tightFor(
                        width: 44,
                        height: 44,
                      ),
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        disabledBackgroundColor: Colors.transparent,
                        disabledForegroundColor:
                            Theme.of(context).brightness == Brightness.dark
                            ? const Color(0xff9ca3af)
                            : const Color(0xff6b7280),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        padding: EdgeInsets.zero,
                        foregroundColor: scheme.onPrimary,
                        minimumSize: const Size(44, 44),
                      ),
                      icon: Container(
                        key: const ValueKey('chat-send-surface'),
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: sendDisabled
                              ? (Theme.of(context).brightness == Brightness.dark
                                    ? const Color(0xff374151)
                                    : const Color(0xffd1d5db))
                              : stopping
                              ? const Color(0xffef4444)
                              : scheme.primary,
                        ),
                        child: stopping
                            ? Stack(
                                alignment: Alignment.center,
                                children: [
                                  SizedBox(
                                    width: 28,
                                    height: 28,
                                    child: CircularProgressIndicator(
                                      value: c.general['reduceMotion'] == true
                                          ? .75
                                          : null,
                                      strokeWidth: 2,
                                      color: Colors.white,
                                      backgroundColor: Colors.white30,
                                    ),
                                  ),
                                  const Icon(
                                    Icons.square,
                                    size: 11,
                                    color: Colors.white,
                                  ),
                                ],
                              )
                            : const Center(
                                child: UiIcon(
                                  LucideIcons.sendHorizontal,
                                  size: 17,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget drawer(BuildContext context) => WorkspaceSidebar(
    controller: c,
    onSelectConversation: () => setState(() => settingsOpen = false),
    onClose: closeSidebar,
    onFocusComposer: () {
      closeSidebar();
      setState(() => settingsOpen = false);
      composerFocus.unfocus();
    },
    onTools: () {
      closeSidebar();
      showPluginCenter(context, c);
    },
    onSettings: () {
      composerFocus.unfocus();
      closeSidebar();
      setState(() => settingsOpen = true);
    },
  );
  Widget skeleton() => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final width in [120.0, 260.0, 220.0])
          Container(
            margin: const EdgeInsets.only(top: 18),
            width: width,
            height: 16,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(6),
            ),
          ),
      ],
    ),
  );
  void sessionAction(String value) => run(() async {
    final s = c.activeSession;
    if (s == null) return;
    switch (value) {
      case 'share':
        await showAppDialog(
          context,
          (_) => ShareDialog(controller: c, sessionId: s.id),
        );
      case 'smart':
        await c.smartRename();
      case 'rename':
        final title = await editText(context, '重命名', s.title);
        if (title != null && title.isNotEmpty) await c.rename(s, title);
      case 'favorite':
        await c.favorite(s);
      case 'id':
        await Clipboard.setData(ClipboardData(text: s.id));
      case 'copy':
        await Clipboard.setData(
          ClipboardData(text: c.messages.map((m) => m.content).join('\n\n')),
        );
      case 'export':
        await showAppDialog(
          context,
          (_) => ExportDialog(controller: c, session: s, initialMode: 'json'),
        );
      case 'image':
        await showAppDialog(
          context,
          (_) => ExportDialog(controller: c, session: s),
        );
      case 'delete':
        if (await confirmAction(context, '删除会话', '会话及其专属文件将被删除。')) {
          await c.deleteSession(s);
        }
    }
  });
}

class ApiFailureForUi implements Exception {
  final String text;
  ApiFailureForUi(this.text);
  @override
  String toString() => text;
}
