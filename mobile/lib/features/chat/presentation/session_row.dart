import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/app_menu.dart';
import '../application/workspace_controller.dart';

class SessionRow extends StatefulWidget {
  final WorkspaceController controller;
  final ChatSession session;
  final VoidCallback onSelect;
  final bool selectionMode, selected, enabled;
  const SessionRow({
    super.key,
    required this.controller,
    required this.session,
    required this.onSelect,
    this.selectionMode = false,
    this.selected = false,
    this.enabled = true,
  });
  @override
  State<SessionRow> createState() => _SessionRowState();
}

class _SessionRowState extends State<SessionRow> {
  final title = TextEditingController();
  final focus = FocusNode();
  bool editing = false, busy = false;
  WorkspaceController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    focus.addListener(() {
      if (!focus.hasFocus && editing) save();
    });
  }

  @override
  void dispose() {
    title.dispose();
    focus.dispose();
    super.dispose();
  }

  Future<void> run(Future<void> Function() action) async {
    try {
      await action();
    } catch (error) {
      c.report(error);
    }
  }

  void edit() {
    title.text = widget.session.title;
    title.selection = TextSelection(
      baseOffset: 0,
      extentOffset: title.text.length,
    );
    setState(() => editing = true);
    focus.requestFocus();
  }

  void save() {
    if (!editing) return;
    setState(() => editing = false);
    final value = title.text.trim();
    if (value.isNotEmpty && value != widget.session.title) {
      run(() => c.rename(widget.session, value));
    }
  }

  Future<void> action(String value) => run(() async {
    switch (value) {
      case 'rename':
        edit();
      case 'auto':
        setState(() => busy = true);
        try {
          await c.smartRename(sessionId: widget.session.id);
        } finally {
          if (mounted) setState(() => busy = false);
        }
      case 'favorite':
        await c.favorite(widget.session);
      case 'id':
        await Clipboard.setData(ClipboardData(text: widget.session.id));
      case 'delete':
        if (await confirmAction(
          context,
          '删除这个会话？',
          '“${widget.session.title}” 会被永久删除，此操作无法撤销。',
        )) {
          await c.deleteSession(widget.session);
        }
    }
  });
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final active = c.activeSessionId == widget.session.id;
    return AppMenuButton(
      width: 180,
      radius: 8,
      items: () => [
        AppMenuItem(
          '自动命名',
          icon: LucideIcons.wandSparkles,
          onPressed: () => action('auto'),
        ),
        AppMenuItem(
          '重命名',
          icon: LucideIcons.pencilLine,
          onPressed: () => action('rename'),
        ),
        AppMenuItem(
          widget.session.favorite ? '取消收藏' : '收藏',
          icon: LucideIcons.star,
          onPressed: () => action('favorite'),
        ),
        AppMenuItem(
          '复制 ID',
          icon: LucideIcons.copy,
          onPressed: () => action('id'),
        ),
        const AppMenuItem.divider(),
        AppMenuItem(
          '删除',
          icon: LucideIcons.trash2,
          danger: true,
          onPressed: () => action('delete'),
        ),
      ],
      builder: (toggle) => Semantics(
        checked: widget.selectionMode ? widget.selected : null,
        child: Material(
          color: active
              ? (dark ? const Color(0xff1f2937) : const Color(0xffeceef0))
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          child: InkWell(
            onTap: editing || !widget.enabled ? null : widget.onSelect,
            onLongPress:
                editing || widget.selectionMode || !widget.enabled || busy
                ? null
                : toggle,
            borderRadius: BorderRadius.circular(8),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: MediaQuery.sizeOf(context).width < 768 ? 44 : 36,
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Row(
                  children: [
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: widget.selectionMode ? 1 : 0),
                      duration:
                          c.general['reduceMotion'] == true ||
                              MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 240),
                      curve: Curves.easeOutCubic,
                      builder: (context, value, child) => ClipRect(
                        child: Align(
                          alignment: Alignment.centerLeft,
                          widthFactor: value,
                          child: Opacity(
                            opacity: value,
                            child: Transform.scale(
                              scale: .75 + .25 * value,
                              child: child,
                            ),
                          ),
                        ),
                      ),
                      child: SizedBox(
                        width: 36,
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Icon(
                            widget.selected
                                ? Icons.check_circle
                                : Icons.circle_outlined,
                            size: 22,
                            color: widget.selected
                                ? Theme.of(context).colorScheme.primary
                                : Colors.grey,
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: editing
                          ? Focus(
                              onKeyEvent: (_, event) {
                                if (event is KeyDownEvent &&
                                    event.logicalKey ==
                                        LogicalKeyboardKey.escape) {
                                  setState(() => editing = false);
                                  focus.unfocus();
                                  return KeyEventResult.handled;
                                }
                                return KeyEventResult.ignored;
                              },
                              child: SizedBox(
                                height: 28,
                                child: TextField(
                                  controller: title,
                                  focusNode: focus,
                                  autofocus: true,
                                  onSubmitted: (_) => save(),
                                  style: const TextStyle(
                                    fontSize: 14,
                                    height: 20 / 14,
                                  ),
                                  decoration: const InputDecoration(
                                    isDense: true,
                                    contentPadding: EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 3,
                                    ),
                                  ),
                                ),
                              ),
                            )
                          : Text(
                              c.namingSessions.contains(widget.session.id)
                                  ? '...'
                                  : widget.session.title.isEmpty
                                  ? '新对话'
                                  : widget.session.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 14,
                                height: 20 / 14,
                                color: dark
                                    ? const Color(0xffd1d5db)
                                    : const Color(0xff374151),
                              ),
                            ),
                    ),
                    const SizedBox(width: 8),
                    if (widget.session.favorite && !widget.selectionMode) ...[
                      const Tooltip(
                        message: '已收藏',
                        child: Icon(
                          Icons.star_rounded,
                          size: 20,
                          color: Color(0xffeab308),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    if (busy ||
                        c.namingSessions.contains(widget.session.id) ||
                        (c.generating && active))
                      SizedBox(
                        width: 28,
                        height: 28,
                        child: Center(
                          child: SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              value: c.general['reduceMotion'] == true
                                  ? .75
                                  : null,
                              color: const Color(0xff374151),
                              backgroundColor: const Color(0xffd1d5db),
                              semanticsLabel:
                                  c.namingSessions.contains(widget.session.id)
                                  ? '正在自动命名'
                                  : '正在生成回复',
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
