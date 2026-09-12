import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../shared/widgets/common.dart';
import '../../shared/widgets/swipe_back_route.dart';
import '../../shared/widgets/ui_icon.dart';
import '../chat/application/workspace_controller.dart';
import '../chat/presentation/file_manager.dart';
import '../chat/presentation/profile_dialog.dart';
import 'settings_screen.dart';

class SettingsHome extends StatelessWidget {
  const SettingsHome({super.key, required this.controller});
  final WorkspaceController controller;

  Future<void> open(BuildContext context, Widget page) =>
      Navigator.of(context).push(
        SwipeBackRoute<void>(
          reduceMotion:
              controller.general['reduceMotion'] == true ||
              MediaQuery.disableAnimationsOf(context),
          builder: (_) => page,
        ),
      );

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    Widget entry(
      String title,
      IconData icon,
      VoidCallback onTap, {
      bool danger = false,
    }) => ListTile(
      key: ValueKey('settings-category-$title'),
      minTileHeight: 60,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18),
      leading: UiIcon(icon, size: 22, color: danger ? Colors.red : null),
      title: Text(
        title,
        style: TextStyle(fontSize: 16, color: danger ? Colors.red : null),
      ),
      trailing: danger
          ? null
          : const UiIcon(
              LucideIcons.chevronRight,
              size: 18,
              color: Color(0xff9ca3af),
            ),
      onTap: onTap,
    );
    Widget group(String? title, List<Widget> entries) => Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Text(
                title,
                style: const TextStyle(fontSize: 13, color: Color(0xff9ca3af)),
              ),
            ),
          Material(
            color: dark ? const Color(0xff191919) : Colors.white,
            borderRadius: BorderRadius.circular(16),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (var i = 0; i < entries.length; i++) ...[
                  if (i > 0)
                    Divider(
                      height: 1,
                      indent: 58,
                      endIndent: 16,
                      color: dark
                          ? const Color(0x14ffffff)
                          : const Color(0xffeeeeee),
                    ),
                  entries[i],
                ],
              ],
            ),
          ),
        ],
      ),
    );
    Widget category(String title, IconData icon) => entry(
      title,
      icon,
      () =>
          open(context, SettingsScreen(controller: controller, section: title)),
    );
    return Scaffold(
      backgroundColor: dark ? const Color(0xff0e0f11) : const Color(0xfff8f8f8),
      appBar: AppBar(
        backgroundColor: dark
            ? const Color(0xff0e0f11)
            : const Color(0xfff8f8f8),
        leading: ActionIcon(
          '返回',
          LucideIcons.chevronLeft,
          () => Navigator.maybePop(context),
        ),
        title: const Text('设置'),
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          key: const ValueKey('settings-home-scroll'),
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
          children: [
            group('账户', [
              entry(
                '个人资料',
                LucideIcons.userRound,
                () => open(
                  context,
                  ProfileDialog(controller: controller, fullPage: true),
                ),
              ),
              entry(
                '文件管理',
                LucideIcons.folderOpen,
                () => open(context, FileManager(controller: controller)),
              ),
            ]),
            group('应用', [
              category('外观', LucideIcons.sun),
              category('对话', LucideIcons.messageSquareText),
              category('语音', LucideIcons.volume2),
              category('AI 提供商', LucideIcons.network),
            ]),
            group('关于', [category('应用更新', LucideIcons.download)]),
            group(null, [
              entry('退出登录', LucideIcons.logOut, () async {
                if (!await confirmAction(context, '退出登录？', '退出后可以重新登录以继续使用。')) {
                  return;
                }
                try {
                  await controller.logout();
                  if (context.mounted) {
                    Navigator.of(context).popUntil((route) => route.isFirst);
                  }
                } catch (error) {
                  controller.report(error);
                }
              }, danger: true),
            ]),
          ],
        ),
      ),
    );
  }
}
