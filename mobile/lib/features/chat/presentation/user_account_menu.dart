import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/ui_icon.dart';
import '../../../shared/widgets/account_avatar_image.dart';
import '../../../shared/models/chat.dart';
import '../application/workspace_controller.dart';

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
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    child: InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: widget.onSettings,
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
            const UiIcon(
              LucideIcons.chevronRight,
              size: 16,
              color: Color(0xff9ca3af),
            ),
          ],
        ),
      ),
    ),
  );
}
