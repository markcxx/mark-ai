import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/app_dialog.dart';
import '../../../shared/widgets/ui_icon.dart';
import '../../../shared/widgets/account_avatar_image.dart';
import '../../../shared/models/chat.dart';
import '../application/workspace_controller.dart';
import 'file_manager.dart';
import 'profile_dialog.dart';

class UserAccountMenu extends StatefulWidget {
  final WorkspaceController controller;
  final VoidCallback onSettings, onCloseSidebar;
  const UserAccountMenu({
    super.key,
    required this.controller,
    required this.onSettings,
    required this.onCloseSidebar,
  });
  @override
  State<UserAccountMenu> createState() => _UserAccountMenuState();
}

class _UserAccountMenuState extends State<UserAccountMenu> {
  final anchor = GlobalKey();
  bool open = false;
  WorkspaceController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    final account = c.accountKey;
    c.api
        .request('GET', '/api/profile')
        .then((data) {
          if (!mounted || c.accountKey != account) return;
          final profile = jsonMap(data['user']);
          if (profile.isNotEmpty) {
            setState(() => c.user = {...c.user, ...profile});
          }
        })
        .catchError((_) {
          /* Existing account identity remains usable offline. */
        });
  }

  String get name => (c.user['fullName'] as String?)?.isNotEmpty == true
      ? c.user['fullName'] as String
      : (c.user['name'] as String?)?.isNotEmpty == true
      ? c.user['name'] as String
      : (c.user['email'] as String?)?.split('@').first ?? 'MarkAI 用户';
  Widget identity({bool menu = false}) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          fontSize: 14,
          height: 20 / 14,
          fontWeight: FontWeight.w600,
        ),
      ),
      if (menu) const SizedBox(height: 2),
      Text(
        c.user['email'] as String? ?? '',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          fontSize: 12,
          height: 16 / 12,
          color: Color(0xff9ca3af),
        ),
      ),
    ],
  );
  Future<void> toggle() async {
    if (open) return;
    final box = anchor.currentContext!.findRenderObject() as RenderBox;
    final position = box.localToGlobal(Offset.zero);
    setState(() => open = true);
    final result = await showGeneralDialog<String>(
      context: context,
      barrierDismissible: true,
      barrierLabel: '关闭账号菜单',
      barrierColor: Colors.transparent,
      transitionDuration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 180),
      transitionBuilder: (_, animation, _, child) => FadeTransition(
        opacity: animation,
        child: SlideTransition(
          position: Tween(begin: const Offset(0, .01), end: Offset.zero)
              .animate(
                CurvedAnimation(
                  parent: animation,
                  curve: const Cubic(.22, 1, .36, 1),
                ),
              ),
          child: child,
        ),
      ),
      pageBuilder: (context, _, _) {
        final dark = Theme.of(context).brightness == Brightness.dark;
        return Stack(
          children: [
            Positioned(
              left: position.dx,
              width: box.size.width,
              bottom: MediaQuery.sizeOf(context).height - position.dy + 10,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x2e0f172a),
                      blurRadius: 55,
                      offset: Offset(0, 18),
                    ),
                  ],
                ),
                child: Material(
                  color: dark
                      ? const Color(0xf2171717)
                      : const Color(0xf2ffffff),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                    side: BorderSide(
                      color: dark
                          ? const Color(0x1affffff)
                          : const Color(0x0f000000),
                    ),
                  ),
                  elevation: 0,
                  child: Padding(
                    padding: const EdgeInsets.all(7),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          child: identity(menu: true),
                        ),
                        const Divider(height: 1),
                        const SizedBox(height: 4),
                        for (final item in [
                          ('files', LucideIcons.folderOpen, '文件管理'),
                          ('profile', LucideIcons.circleUserRound, '个人资料'),
                          ('settings', LucideIcons.settings, '设置'),
                          ('logout', LucideIcons.logOut, '退出登录'),
                        ]) ...[
                          if (item.$1 == 'logout')
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 4),
                              child: Divider(height: 1),
                            ),
                          InkWell(
                            onTap: () => Navigator.pop(context, item.$1),
                            borderRadius: BorderRadius.circular(6),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              child: Row(
                                children: [
                                  UiIcon(
                                    item.$2,
                                    size: 17,
                                    color: item.$1 == 'logout'
                                        ? const Color(0xffdc2626)
                                        : const Color(0xff9ca3af),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    item.$3,
                                    style: TextStyle(
                                      fontSize: 14,
                                      height: 20 / 14,
                                      color: item.$1 == 'logout'
                                          ? const Color(0xffdc2626)
                                          : dark
                                          ? const Color(0xffe5e7eb)
                                          : const Color(0xff374151),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
    if (!mounted) return;
    setState(() => open = false);
    switch (result) {
      case 'files':
        await showFileManager(context, c);
      case 'profile':
        await showAppDialog(context, (_) => ProfileDialog(controller: c));
      case 'settings':
        widget.onSettings();
      case 'logout':
        widget.onCloseSidebar();
        try {
          await c.logout();
        } catch (error) {
          c.report(error);
        }
    }
  }

  @override
  Widget build(BuildContext context) => Semantics(
    expanded: open,
    button: true,
    child: InkWell(
      key: anchor,
      borderRadius: BorderRadius.circular(8),
      onTap: toggle,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xff8b5cf6),
                    Color(0xff3b82f6),
                    Color(0xff22d3ee),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Colors.black
                        : Colors.white,
                    spreadRadius: 2,
                  ),
                  const BoxShadow(
                    color: Color(0x0d000000),
                    blurRadius: 2,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: AccountAvatarImage(
                api: c.api,
                url:
                    c.user['avatar'] as String? ??
                    c.user['image'] as String? ??
                    '',
                size: 40,
                fallback: Text(
                  name.characters.take(2).toString().toUpperCase(),
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: identity()),
            const SizedBox(width: 12),
            AnimatedRotation(
              turns: open ? 0 : .5,
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 200),
              child: const UiIcon(
                LucideIcons.chevronUp,
                size: 16,
                color: Color(0xff9ca3af),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
