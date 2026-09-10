import 'package:markai_mobile/shared/widgets/ui_icon.dart';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/common.dart';
import 'user_account_menu.dart';
import 'file_manager.dart';
import 'command_center.dart';
import 'session_search.dart';
import 'session_row.dart';
import '../application/workspace_controller.dart';

/// Native counterpart of Sidebar, SessionRow and UserAccountMenu.
class WorkspaceSidebar extends StatefulWidget {
  final WorkspaceController controller;
  final VoidCallback onSettings, onTools, onFocusComposer;
  final VoidCallback? onClose;
  final VoidCallback? onSelectConversation;
  const WorkspaceSidebar({
    super.key,
    required this.controller,
    required this.onSettings,
    required this.onTools,
    required this.onFocusComposer,
    this.onClose,
    this.onSelectConversation,
  });
  @override
  State<WorkspaceSidebar> createState() => _WorkspaceSidebarState();
}

class _WorkspaceSidebarState extends State<WorkspaceSidebar> {
  final collapsed = <String>{};
  bool loadingMore = false;
  Future<void> loadMore() async {
    if (loadingMore || c.nextCursor == null) return;
    loadingMore = true;
    try {
      await run(() => c.loadSessions(more: true));
    } finally {
      loadingMore = false;
    }
  }

  WorkspaceController get c => widget.controller;
  Future<void> run(Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      c.report(e);
    }
  }

  void close() {
    if (widget.onClose != null) {
      widget.onClose!();
    } else {
      Navigator.pop(context);
    }
  }

  void select(String? id) {
    widget.onSelectConversation?.call();
    close();
    run(() => c.openSession(id));
  }

  String group(ChatSession session) {
    final now = DateTime.now();
    final days =
        (DateTime(now.year, now.month, now.day).millisecondsSinceEpoch -
            session.updatedAt) /
        Duration.millisecondsPerDay;
    return days <= 0
        ? '今天'
        : days <= 1
        ? '昨天'
        : days <= 7
        ? '近 7 天'
        : days <= 30
        ? '近 30 天'
        : '更早';
  }

  Future<void> search({bool commands = false}) async {
    if (commands) {
      final command = await showGeneralDialog<String>(
        context: context,
        barrierDismissible: true,
        barrierLabel: '关闭命令中心',
        barrierColor: const Color(0x40000000),
        pageBuilder: (_, _, _) => const CommandCenter(),
      );
      if (!mounted || command == null) return;
      switch (command) {
        case 'new':
          select(null);
        case 'search':
          await search();
        case 'focus':
          widget.onFocusComposer();
        case 'sidebar':
          close();
        case 'web':
          c.webSearch = !c.webSearch;
          c.setSetting('defaultWebSearch', c.webSearch);
          c.setDraft(c.draft);
        case 'wide':
          c.setSetting('wideChatMode', c.general['wideChatMode'] != true);
        case 'plugins':
          widget.onTools();
        case 'files':
          await showFileManager(context, c);
        case 'settings':
          widget.onSettings();
      }
      return;
    }
    final result = await showGeneralDialog<String>(
      context: context,
      barrierDismissible: true,
      barrierLabel: '关闭搜索',
      barrierColor: Colors.transparent,
      pageBuilder: (_, _, _) => SessionSearch(controller: c),
    );
    if (!mounted || result == null) return;
    if (result == '@new') {
      select(null);
    } else if (result == '@settings') {
      widget.onSettings();
    } else {
      select(result);
    }
  }

  Widget label(String text) => Padding(
    padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 12,
        height: 16 / 12,
        fontFamily: 'Noto Sans SC',
        color: Color(0xff9ca3af),
        fontWeight: FontWeight.w600,
      ),
    ),
  );
  Widget row(
    IconData icon,
    String text,
    VoidCallback tap, {
    Color? background,
    Widget? trailing,
    double height = 44,
    double fontSize = 14,
    double iconSize = 18,
    double horizontalPadding = 12,
    double gap = 8,
    Color? foreground,
  }) => Material(
    color: background ?? Colors.transparent,
    borderRadius: BorderRadius.circular(8),
    child: InkWell(
      onTap: tap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        constraints: BoxConstraints(minHeight: height),
        padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
        child: Row(
          children: [
            UiIcon(icon, size: iconSize, color: foreground),
            SizedBox(width: gap),
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  fontSize: fontSize,
                  height: fontSize == 12 ? 16 / 12 : 20 / 14,
                  letterSpacing: 0,
                  color: foreground,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            ?trailing,
          ],
        ),
      ),
    ),
  );
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final width = ((c.general['sidebarWidth'] as num?)?.toDouble() ?? 260)
        .clamp(200, MediaQuery.sizeOf(context).width * .86);
    return Drawer(
      width: width.toDouble(),
      elevation: 0,
      backgroundColor: dark ? Colors.black : const Color(0xfff8f8f8),
      shape: const RoundedRectangleBorder(),
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 24),
              child: Row(
                children: [
                  const Brand(size: 32),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'MarkAI',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0,
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 40,
                    child: ActionIcon(
                      '搜索会话',
                      LucideIcons.search,
                      () => search(),
                    ),
                  ),
                  const SizedBox(width: 4),
                  SizedBox(
                    width: 40,
                    child: ActionIcon(
                      '收起侧栏',
                      LucideIcons.panelLeftClose,
                      close,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  Material(
                    color: dark
                        ? const Color(0xff1f2937)
                        : const Color(0xfff3f4f5),
                    borderRadius: BorderRadius.circular(8),
                    child: InkWell(
                      onTap: () => select(null),
                      borderRadius: BorderRadius.circular(8),
                      child: const SizedBox(
                        height: 36,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            UiIcon(LucideIcons.plus, size: 20),
                            SizedBox(width: 8),
                            Text('开启新话题', style: TextStyle(fontSize: 14)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  row(
                    LucideIcons.search,
                    '命令中心',
                    () => search(commands: true),
                    iconSize: 17,
                    foreground: dark
                        ? const Color(0xff9ca3af)
                        : const Color(0xff6b7280),
                    height: 36,
                    trailing: Text(
                      switch (c.general['commandCenterShortcut']) {
                        'mod-shift-k' => 'Ctrl/Cmd ⇧K',
                        'mod-slash' => 'Ctrl/Cmd /',
                        _ => 'Ctrl/Cmd K',
                      },
                      style: const TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 11,
                        color: Color(0xff9ca3af),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  label('视图'),
                  row(
                    LucideIcons.puzzle,
                    '插件中心',
                    widget.onTools,
                    height: 36,
                    iconSize: 16,
                    foreground: dark
                        ? const Color(0xffd1d5db)
                        : const Color(0xff4b5563),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: NotificationListener<ScrollNotification>(
                onNotification: (event) {
                  if (event.metrics.extentAfter < 160 && c.nextCursor != null) {
                    loadMore();
                  }
                  return false;
                },
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                  children: [
                    const SizedBox(height: 16),
                    label('历史'),
                    if (c.sessions.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        child: Text(
                          '暂无历史对话',
                          style: TextStyle(
                            fontSize: 14,
                            color: Color(0xff9ca3af),
                          ),
                        ),
                      ),
                    for (final title in ['今天', '昨天', '近 7 天', '近 30 天', '更早'])
                      if (c.sessions.any((s) => group(s) == title)) ...[
                        row(
                          collapsed.contains(title)
                              ? LucideIcons.chevronRight
                              : LucideIcons.chevronDown,
                          title,
                          height: 28,
                          fontSize: 12,
                          iconSize: 13,
                          gap: 4,
                          horizontalPadding: 8,
                          foreground: const Color(0xff9ca3af),
                          () => setState(() {
                            collapsed.contains(title)
                                ? collapsed.remove(title)
                                : collapsed.add(title);
                          }),
                          trailing: Text(
                            '${c.sessions.where((s) => group(s) == title).length}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xff9ca3af),
                            ),
                          ),
                        ),
                        if (!collapsed.contains(title))
                          for (final s in c.sessions.where(
                            (s) => group(s) == title,
                          ))
                            Padding(
                              padding: const EdgeInsets.only(bottom: 4),
                              child: SessionRow(
                                key: ValueKey(s.id),
                                controller: c,
                                session: s,
                                onSelect: () => select(s.id),
                              ),
                            ),
                      ],
                  ],
                ),
              ),
            ),
            const Divider(),
            Padding(
              padding: const EdgeInsets.all(12),
              child: UserAccountMenu(
                controller: c,
                onSettings: widget.onSettings,
                onCloseSidebar: close,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
