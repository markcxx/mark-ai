import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/ui_icon.dart';

const workspaceCommands = [
  ('new', '开启新话题', '新建 对话 会话 new chat', LucideIcons.messageSquarePlus),
  ('search', '搜索会话', '历史 会话 消息 内容 查找 search', LucideIcons.search),
  ('focus', '聚焦消息输入框', '输入 聚焦 提问 composer', LucideIcons.search),
  ('sidebar', '切换侧栏', '侧栏 历史 展开 收起 sidebar', LucideIcons.panelLeft),
  ('web', '切换联网搜索', '联网 搜索 web search', LucideIcons.globe),
  ('wide', '切换全宽显示', '宽屏 全宽 wide', LucideIcons.expand),
  ('plugins', '打开插件中心', '插件 工具 skill plugin', LucideIcons.puzzle),
  ('files', '打开文件管理', '文件 附件 file', LucideIcons.fileText),
  ('settings', '打开设置', '设置 偏好 settings', LucideIcons.settings),
];

class CommandCenter extends StatefulWidget {
  const CommandCenter({super.key});
  @override
  State<CommandCenter> createState() => _CommandCenterState();
}

class _CommandCenterState extends State<CommandCenter> {
  String query = '';
  int selected = 0;
  List<(String, String, String, IconData)> get commands => workspaceCommands
      .where(
        (entry) => '${entry.$2} ${entry.$3}'.toLowerCase().contains(
          query.trim().toLowerCase(),
        ),
      )
      .toList();
  void choose() {
    if (commands.isNotEmpty) {
      Navigator.pop(
        context,
        commands[selected.clamp(0, commands.length - 1)].$1,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context),
        dark = Theme.of(context).brightness == Brightness.dark;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          12,
          math.max(media.size.height * .1, 56),
          12,
          media.viewInsets.bottom + 12,
        ),
        child: Align(
          alignment: Alignment.topCenter,
          child: Container(
            constraints: const BoxConstraints(maxWidth: 576),
            decoration: BoxDecoration(
              color: dark ? const Color(0xff191919) : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Theme.of(context).colorScheme.outline),
            ),
            clipBehavior: Clip.antiAlias,
            child: Material(
              color: Colors.transparent,
              child: Focus(
                onKeyEvent: (_, event) {
                  if (event is! KeyDownEvent || commands.isEmpty) {
                    return KeyEventResult.ignored;
                  }
                  if (event.logicalKey == LogicalKeyboardKey.arrowDown ||
                      event.logicalKey == LogicalKeyboardKey.arrowUp) {
                    setState(
                      () => selected =
                          (selected +
                                  (event.logicalKey ==
                                          LogicalKeyboardKey.arrowDown
                                      ? 1
                                      : -1))
                              .clamp(0, commands.length - 1),
                    );
                    return KeyEventResult.handled;
                  }
                  return KeyEventResult.ignored;
                },
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      height: 52,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          const UiIcon(
                            LucideIcons.search,
                            size: 18,
                            color: Color(0xff9ca3af),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextField(
                              autofocus: true,
                              onChanged: (value) => setState(() {
                                query = value;
                                selected = 0;
                              }),
                              onSubmitted: (_) => choose(),
                              style: const TextStyle(
                                fontSize: 15,
                                letterSpacing: 0,
                              ),
                              decoration: const InputDecoration(
                                hintText: '输入命令或功能名称',
                                hintStyle: TextStyle(color: Color(0xff9ca3af)),
                                border: InputBorder.none,
                                enabledBorder: InputBorder.none,
                                focusedBorder: InputBorder.none,
                                filled: false,
                              ),
                            ),
                          ),
                          const Text(
                            'ESC',
                            style: TextStyle(
                              fontSize: 11,
                              color: Color(0xff9ca3af),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(),
                    Flexible(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(8),
                        child: Column(
                          children: [
                            for (var i = 0; i < commands.length; i++)
                              Material(
                                color: i == selected
                                    ? Theme.of(context)
                                          .colorScheme
                                          .surfaceContainerHighest
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                                child: InkWell(
                                  onTap: () =>
                                      Navigator.pop(context, commands[i].$1),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 0,
                                    ),
                                    child: SizedBox(
                                      height: 44,
                                      child: Row(
                                        children: [
                                          UiIcon(
                                            commands[i].$4,
                                            size: 17,
                                            color: const Color(0xff9ca3af),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Text(
                                              commands[i].$2,
                                              style: const TextStyle(
                                                fontSize: 14,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            if (commands.isEmpty)
                              const Padding(
                                padding: EdgeInsets.all(24),
                                child: Text(
                                  '没有匹配的命令',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: Color(0xff9ca3af),
                                  ),
                                ),
                              ),
                          ],
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
