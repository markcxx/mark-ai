import 'package:markai_mobile/shared/widgets/ui_icon.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/app_dialog.dart';
import '../../../shared/widgets/common.dart';
import '../application/workspace_controller.dart';

class ShareDialog extends StatefulWidget {
  final WorkspaceController controller;
  final String sessionId;
  const ShareDialog({
    super.key,
    required this.controller,
    required this.sessionId,
  });
  @override
  State<ShareDialog> createState() => _ShareDialogState();
}

class _ShareDialogState extends State<ShareDialog> {
  final cancel = CancelToken();
  int duration = 604800;
  Json? share;
  bool loading = true, pending = false;
  String error = '', feedback = '';
  WorkspaceController get c => widget.controller;
  String get endpoint =>
      '/api/sessions/${Uri.encodeComponent(widget.sessionId)}/share';
  @override
  void initState() {
    super.initState();
    load();
  }

  Json? read(Json result) {
    if (result['share'] == null &&
        (result.containsKey('share') || result['ok'] == true)) {
      return null;
    }
    final value = jsonMap(result['share']);
    if (!RegExp(r'^/share/[A-Za-z0-9_-]{43}$')
            .hasMatch(value['path'] as String? ?? '') ||
        DateTime.tryParse(value['expiresAt'] as String? ?? '') == null) {
      throw Exception('分享服务响应异常，请稍后重试');
    }
    return value;
  }

  Future<void> load() async {
    try {
      final result = await c.api.request('GET', endpoint, cancel: cancel);
      if (mounted) setState(() => share = read(result));
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> update(String method) async {
    setState(() {
      pending = true;
      error = '';
      feedback = '';
    });
    try {
      if (method == 'POST') await c.waitForSessionSave(widget.sessionId);
      final result = await c.api.request(
        method,
        endpoint,
        body: method == 'POST' ? {'duration': duration} : null,
        cancel: cancel,
      );
      if (mounted) {
        setState(() {
          share = read(result);
          feedback = method == 'DELETE' ? '链接已撤销' : '分享链接已生成';
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: c,
    builder: (context, _) => AppDialog(
      title: '分享会话',
      width: (MediaQuery.sizeOf(context).width * .92).clamp(0, 480).toDouble(),
      closeDisabled: pending,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              '生成当前已保存对话的只读快照，包含思考过程和附件。持有链接的人无需登录即可查看；后续消息不会自动加入。',
              style: TextStyle(
                fontSize: 14,
                height: 24 / 14,
                color: Color(0xff6b7280),
              ),
            ),
            const SizedBox(height: 16),
            const Text('有效期', style: TextStyle(fontSize: 14)),
            const SizedBox(height: 8),
            DropdownButtonFormField<int>(
              initialValue: duration,
              isExpanded: true,
              decoration: const InputDecoration(
                contentPadding: EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
              ),
              items: const [
                DropdownMenuItem(value: 3600, child: Text('1 小时')),
                DropdownMenuItem(value: 86400, child: Text('1 天')),
                DropdownMenuItem(value: 604800, child: Text('7 天')),
                DropdownMenuItem(value: 2592000, child: Text('30 天')),
              ],
              onChanged: pending || loading
                  ? null
                  : (value) => setState(() => duration = value!),
            ),
            const SizedBox(height: 16),
            if (loading)
              Container(
                height: 64,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            if (share != null) ...[
              const Text('分享链接', style: TextStyle(fontSize: 14)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: SelectableText(
                      '${c.api.baseUrl}${share!['path']}',
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                  ActionIcon('复制分享链接', LucideIcons.copy, () async {
                    await Clipboard.setData(
                      ClipboardData(text: '${c.api.baseUrl}${share!['path']}'),
                    );
                    if (mounted) setState(() => feedback = '链接已复制');
                  }),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '有效至 ${DateTime.parse(share!['expiresAt'] as String).toLocal()}',
                style: const TextStyle(fontSize: 12, color: Color(0xff6b7280)),
              ),
              const SizedBox(height: 8),
              const Text(
                '重新生成会更新快照，并使旧链接立即失效。',
                style: TextStyle(fontSize: 12, color: Color(0xff9ca3af)),
              ),
            ],
            if (c.generating)
              const Text(
                '请等待回复完成并保存后再生成快照。',
                style: TextStyle(fontSize: 14, color: Color(0xff6b7280)),
              ),
            if (error.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Text(
                  error,
                  style: const TextStyle(fontSize: 14, color: Colors.red),
                ),
              ),
            if (feedback.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Text(
                  feedback,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xff6b7280),
                  ),
                ),
              ),
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.end,
              spacing: 8,
              children: [
                if (share != null)
                  TextButton.icon(
                    onPressed: pending ? null : () => update('DELETE'),
                    icon: const UiIcon(LucideIcons.trash2, size: 15),
                    label: const Text('撤销链接'),
                    style: TextButton.styleFrom(foregroundColor: Colors.red),
                  ),
                FilledButton.icon(
                  onPressed: pending || loading || c.generating
                      ? null
                      : () => update('POST'),
                  icon: const UiIcon(LucideIcons.link2, size: 15),
                  label: Text(
                    pending
                        ? '处理中…'
                        : share != null
                        ? '重新生成'
                        : '生成链接',
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}
