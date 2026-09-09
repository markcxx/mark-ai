import 'auth_icon.dart';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../shared/widgets/agent_avatar.dart';
import '../../shared/widgets/common.dart';
import '../chat/application/workspace_controller.dart';
import 'connection_screen.dart';

/// Native counterpart of components/guest/GuestChatApp.tsx.
class GuestScreen extends StatefulWidget {
  final WorkspaceController controller;
  const GuestScreen({super.key, required this.controller});
  @override
  State<GuestScreen> createState() => _GuestScreenState();
}

class _GuestScreenState extends State<GuestScreen> {
  late final draft = TextEditingController(text: widget.controller.draft);
  final focus = FocusNode();
  @override
  void dispose() {
    draft.dispose();
    focus.dispose();
    super.dispose();
  }

  void login() {
    focus.unfocus();
    showLogin(context, widget.controller);
  }

  Widget icon(String label, IconData icon, {VoidCallback? action}) =>
      IconButton(
        tooltip: label,
        onPressed: action ?? login,
        icon: AuthIcon(
          icon,
          size: label == '添加附件' || label == '切换主题' ? 20 : 18,
        ),
        style: IconButton.styleFrom(
          minimumSize: Size(
            label == '切换主题'
                ? 40
                : label == '联网搜索' || label == '选择模型'
                ? 38
                : 44,
            44,
          ),
          padding: EdgeInsets.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      );

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final muted = dark ? const Color(0xff9ca3af) : const Color(0xff6b7280);
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            SizedBox(
              height: 56,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    const Brand(size: 30),
                    const SizedBox(width: 8),
                    const Text(
                      'MarkAI',
                      style: TextStyle(
                        letterSpacing: 0,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    icon(
                      '切换主题',
                      dark ? LucideIcons.sun : LucideIcons.moon,
                      action: () => widget.controller.setSetting(
                        'themeMode',
                        dark ? 'light' : 'dark',
                      ),
                    ),
                    const SizedBox(width: 4),
                    TextButton(
                      onPressed: login,
                      style: TextButton.styleFrom(
                        minimumSize: const Size(0, 44),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AuthIcon(LucideIcons.logIn, size: 17),
                          SizedBox(width: 8),
                          Text(
                            '登录',
                            style: TextStyle(
                              letterSpacing: 0,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: LayoutBuilder(
                builder: (context, box) => SingleChildScrollView(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: box.maxHeight),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                      child: SizedBox(
                        height: (box.maxHeight - 24).clamp(
                          280,
                          double.infinity,
                        ),
                        child: Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 760),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const SizedBox(
                                      width: 64,
                                      height: 64,
                                      child: Center(
                                        child: OverflowBox(
                                          minWidth: 72,
                                          maxWidth: 72,
                                          minHeight: 72,
                                          maxHeight: 72,
                                          child: AgentAvatar(size: 72),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Flexible(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'MARKAI',
                                            style: TextStyle(
                                              letterSpacing: 0,
                                              fontSize: 24,
                                              height: 1.33,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                          Text(
                                            '先问点什么，准备发送时再登录。',
                                            style: TextStyle(
                                              letterSpacing: 0,
                                              fontSize: 15,
                                              height: 1.5,
                                              color: muted,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 24),
                                ListenableBuilder(
                                  listenable: focus,
                                  builder: (context, _) => Container(
                                    decoration: BoxDecoration(
                                      color: dark
                                          ? const Color(0xff191919)
                                          : Colors.white,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                        color: focus.hasFocus
                                            ? const Color(0xff9ca3af)
                                            : Theme.of(context)
                                                  .colorScheme
                                                  .outline,
                                      ),
                                      boxShadow: const [
                                        BoxShadow(
                                          color: Color(0x0f000000),
                                          offset: Offset(0, 12),
                                          blurRadius: 32,
                                        ),
                                      ],
                                    ),
                                    child: Column(
                                      children: [
                                        ConstrainedBox(
                                          constraints: BoxConstraints(
                                            minHeight: 96,
                                            maxHeight:
                                                (MediaQuery.sizeOf(context)
                                                            .height *
                                                        .36)
                                                    .clamp(96, 200),
                                          ),
                                          child: TextField(
                                            controller: draft,
                                            focusNode: focus,
                                            minLines: 2,
                                            maxLines: null,
                                            keyboardType:
                                                TextInputType.multiline,
                                            textInputAction:
                                                TextInputAction.send,
                                            onSubmitted: (_) => login(),
                                            style: const TextStyle(
                                              letterSpacing: 0,
                                              fontSize: 16,
                                              height: 1.5,
                                            ),
                                            onChanged: (value) {
                                              widget.controller.setDraft(value);
                                              setState(() {});
                                            },
                                            decoration: InputDecoration(
                                              hintText: '尽管问，带图也行...',
                                              hintStyle: TextStyle(
                                                letterSpacing: 0,
                                                color: dark
                                                    ? const Color(0xff6b7280)
                                                    : const Color(0xff9ca3af),
                                              ),
                                              filled: false,
                                              contentPadding:
                                                  const EdgeInsets.all(16),
                                              border: InputBorder.none,
                                              enabledBorder: InputBorder.none,
                                              focusedBorder: InputBorder.none,
                                            ),
                                          ),
                                        ),
                                        // Preserve the inline textarea baseline gap in GuestChatApp.
                                        const SizedBox(height: 5),
                                        Padding(
                                          padding: const EdgeInsets.fromLTRB(
                                            10,
                                            0,
                                            10,
                                            10,
                                          ),
                                          child: IconTheme(
                                            data: IconThemeData(color: muted),
                                            child: Row(
                                              children: [
                                                icon(
                                                  '添加附件',
                                                  LucideIcons.paperclip,
                                                ),
                                                const SizedBox(width: 4),
                                                icon('联网搜索', LucideIcons.globe),
                                                const Spacer(),
                                                icon(
                                                  '选择模型',
                                                  LucideIcons.slidersHorizontal,
                                                ),
                                                const SizedBox(width: 4),
                                                IconButton(
                                                  tooltip: '发送消息',
                                                  onPressed:
                                                      draft.text.trim().isEmpty
                                                      ? null
                                                      : login,
                                                  style: IconButton.styleFrom(
                                                    minimumSize: const Size(
                                                      44,
                                                      44,
                                                    ),
                                                    padding: EdgeInsets.zero,
                                                    tapTargetSize:
                                                        MaterialTapTargetSize
                                                            .shrinkWrap,
                                                    fixedSize: const Size(
                                                      44,
                                                      44,
                                                    ),
                                                    backgroundColor: dark
                                                        ? Colors.white
                                                        : const Color(
                                                            0xff030712,
                                                          ),
                                                    foregroundColor: dark
                                                        ? const Color(
                                                            0xff030712,
                                                          )
                                                        : Colors.white,
                                                    disabledBackgroundColor:
                                                        dark
                                                        ? const Color(
                                                            0xff374151,
                                                          )
                                                        : const Color(
                                                            0xffd1d5db,
                                                          ),
                                                    disabledForegroundColor:
                                                        muted,
                                                  ),
                                                  icon: const AuthIcon(
                                                    LucideIcons.sendHorizontal,
                                                    size: 18,
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
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
