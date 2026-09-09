import 'package:markai_mobile/shared/widgets/ui_icon.dart';

import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/app_dialog.dart';
import '../../../shared/widgets/account_avatar_image.dart';
import '../../previews/file_service.dart';
import '../application/workspace_controller.dart';

class ProfileDialog extends StatefulWidget {
  final WorkspaceController controller;
  const ProfileDialog({super.key, required this.controller});
  @override
  State<ProfileDialog> createState() => _ProfileDialogState();
}

class _ProfileDialogState extends State<ProfileDialog> {
  final name = TextEditingController(), age = TextEditingController();
  final cancel = CancelToken();
  Json profile = {};
  PlatformFile? avatar;
  bool saving = false;
  String? error;
  WorkspaceController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    name.text = c.user['name'] as String? ?? '';
    load();
  }

  Future<void> load() async {
    try {
      final result = await c.api.request('GET', '/api/profile', cancel: cancel);
      if (!mounted) return;
      setState(() {
        profile = jsonMap(result['user']);
        name.text = profile['fullName'] as String? ?? name.text;
        age.text = profile['age']?.toString() ?? '';
      });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  Future<void> pick() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
    );
    if (mounted && result.isNotEmpty) setState(() => avatar = result.single);
  }

  Future<void> save() async {
    final years = int.tryParse(age.text);
    if (name.text.trim().length < 2) {
      setState(() => error = '昵称至少需要 2 个字符');
      return;
    }
    if (age.text.isNotEmpty && (years == null || years < 6 || years > 120)) {
      setState(() => error = '请输入 6～120 岁之间的有效年龄');
      return;
    }
    setState(() {
      saving = true;
      error = null;
    });
    try {
      if (avatar != null) {
        await FileService(c.api)
            .upload(avatar!, cancel, (_) {}, kind: 'avatar');
      }
      await c.api.request(
        'PATCH',
        '/api/profile',
        body: {'fullName': name.text.trim(), 'age': ?years},
        cancel: cancel,
      );
      final result = await c.api.request('GET', '/api/profile', cancel: cancel);
      final updated = jsonMap(result['user']);
      c.user = {...c.user, ...updated, 'name': updated['fullName']};
      c.message('个人资料已更新');
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  void dispose() {
    cancel.cancel();
    name.dispose();
    age.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final url =
        profile['avatar'] as String? ?? c.user['image'] as String? ?? '';
    return AppDialog(
      title: '个人资料',
      width: 448,
      closeDisabled: saving,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
            child: Column(
              children: [
                Tooltip(
                  message: '更换头像',
                  child: InkWell(
                    onTap: saving ? null : pick,
                    customBorder: const CircleBorder(),
                    child: Container(
                      width: 96,
                      height: 96,
                      clipBehavior: Clip.antiAlias,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Theme.of(context)
                            .colorScheme
                            .surfaceContainerHighest,
                        border: Border.all(
                          color: Theme.of(context).colorScheme.outline,
                        ),
                      ),
                      child: avatar?.path != null
                          ? Image.file(
                              File(avatar!.path!),
                              width: 96,
                              height: 96,
                              fit: BoxFit.cover,
                            )
                          : url.isNotEmpty
                          ? AccountAvatarImage(
                              api: c.api,
                              url: url,
                              size: 96,
                              fallback: const UiIcon(
                                LucideIcons.userRound,
                                size: 32,
                              ),
                            )
                          : Text(
                              name.text.characters
                                  .take(2)
                                  .toString()
                                  .toUpperCase(),
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: saving ? null : pick,
                  style: TextButton.styleFrom(
                    fixedSize: const Size(64, 24),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    foregroundColor: const Color(0xff2563eb),
                    textStyle: const TextStyle(
                      fontFamily: 'Noto Sans SC',
                      fontSize: 12,
                      height: 16 / 12,
                      letterSpacing: 0,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  child: const Text('更换头像'),
                ),
                const SizedBox(height: 24),
                AppField(
                  label: '昵称',
                  icon: LucideIcons.userRound,
                  controller: name,
                  enabled: !saving,
                ),
                const SizedBox(height: 16),
                AppField(
                  label: '邮箱',
                  icon: LucideIcons.mail,
                  value:
                      profile['email'] as String? ??
                      c.user['email'] as String? ??
                      '',
                ),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: AppField(
                        label: '年龄',
                        icon: LucideIcons.cakeSlice,
                        controller: age,
                        hint: '未设置',
                        enabled: !saving,
                        numeric: true,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: AppField(
                        label: '账户类型',
                        icon: LucideIcons.shieldCheck,
                        value: profile['role'] == 'admin' ? '管理员' : '普通用户',
                      ),
                    ),
                  ],
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Text(
                      error!,
                      style: const TextStyle(fontSize: 13, color: Colors.red),
                    ),
                  ),
              ],
            ),
          ),
          const Divider(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: saving ? null : () => Navigator.pop(context),
                  style: TextButton.styleFrom(
                    textStyle: const TextStyle(
                      fontFamily: 'Noto Sans SC',
                      fontSize: 14,
                      height: 20 / 14,
                      letterSpacing: 0,
                    ),
                    fixedSize: const Size(52, 36),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  child: const Text('取消'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: saving ? null : save,
                  style: FilledButton.styleFrom(
                    textStyle: const TextStyle(
                      fontFamily: 'Noto Sans SC',
                      fontSize: 14,
                      height: 20 / 14,
                      letterSpacing: 0,
                      fontWeight: FontWeight.w500,
                    ),
                    fixedSize: const Size(88, 36),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  child: Text(saving ? '保存中…' : '保存更改'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
