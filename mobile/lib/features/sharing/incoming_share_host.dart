import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../shared/widgets/app_dialog.dart';
import '../auth/auth_screen.dart';
import '../chat/application/workspace_controller.dart';
import '../previews/file_service.dart';
import 'incoming_shares.dart';

class IncomingShareHost extends StatefulWidget {
  final IncomingShareInbox inbox;
  final WorkspaceController controller;
  final GlobalKey<NavigatorState> navigator;
  final Widget child;
  const IncomingShareHost({
    super.key,
    required this.inbox,
    required this.controller,
    required this.navigator,
    required this.child,
  });
  @override
  State<IncomingShareHost> createState() => _IncomingShareHostState();
}

class _IncomingShareHostState extends State<IncomingShareHost> {
  bool showing = false;
  Future<void> review() async {
    if (showing || widget.navigator.currentContext == null) return;
    showing = true;
    try {
      final c = widget.controller;
      if (c.guest) {
        await widget.navigator.currentState!.push<void>(
          MaterialPageRoute(builder: (_) => AuthScreen(controller: c)),
        );
      }
      if (!mounted || c.guest || widget.inbox.items.isEmpty) return;
      final share = widget.inbox.items.first;
      await showAppDialog<void>(
        widget.navigator.currentContext!,
        (_) => _ShareReview(
          inbox: widget.inbox,
          controller: c,
          share: share,
        ),
      );
    } finally {
      showing = false;
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([widget.inbox, widget.controller]),
    builder: (context, _) {
      final pending = widget.inbox.items;
      final visible =
          widget.controller.connected &&
          (pending.isNotEmpty || widget.inbox.error != null);
      return Column(
        children: [
          if (visible)
            Material(
              color: Theme.of(context).colorScheme.surface,
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 4,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.inbox.error ??
                              (widget.controller.guest
                                  ? '已收到分享，登录后可添加'
                                  : '收到 ${pending.length} 项分享，确认后添加到输入框'),
                          style: const TextStyle(fontSize: 13),
                        ),
                      ),
                      TextButton(
                        onPressed: widget.inbox.error != null
                            ? widget.inbox.refresh
                            : review,
                        child: Text(
                          widget.inbox.error != null
                              ? '重试'
                              : widget.controller.guest
                              ? '登录'
                              : '查看',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          Expanded(
            child: visible
                ? MediaQuery.removePadding(
                    context: context,
                    removeTop: true,
                    child: widget.child,
                  )
                : widget.child,
          ),
        ],
      );
    },
  );
}

class _ShareReview extends StatefulWidget {
  final IncomingShare share;
  final IncomingShareInbox inbox;
  final WorkspaceController controller;
  const _ShareReview({
    required this.share,
    required this.inbox,
    required this.controller,
  });
  @override
  State<_ShareReview> createState() => _ShareReviewState();
}

class _ShareReviewState extends State<_ShareReview> {
  bool busy = false;
  String? error;
  final cancel = CancelToken();
  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }

  Future<void> apply() async {
    final c = widget.controller, share = widget.share;
    if (c.guest || c.generating) {
      setState(() => error = '请先登录并等待当前回答完成');
      return;
    }
    if (c.attachments.length + share.files.length > 4) {
      setState(() => error = '合计最多 4 个附件，请先整理输入框中的附件');
      return;
    }
    final account = c.accountKey, session = c.activeSessionId;
    final uploaded = <Map<String, dynamic>>[];
    setState(() {
      busy = true;
      error = null;
    });
    var applied = false;
    try {
      for (final file in share.files) {
        uploaded.add(
          await FileService(c.api)
              .uploadPath(file.path, file.name, cancel, (_) {}),
        );
      }
      if (!mounted ||
          c.accountKey != account ||
          c.activeSessionId != session ||
          c.guest ||
          c.generating) {
        throw StateError('会话已变化，请重新确认分享内容');
      }
      // Remove the local queue item before modifying the draft so retries cannot
      // append the same text or attachment twice. No generation is triggered.
      await widget.inbox.remove(share);
      if (!mounted || c.accountKey != account || c.activeSessionId != session) {
        // Keep uploaded content recoverable without writing it to another account.
        throw StateError('会话已变化，请从来源应用重新分享');
      }
      c.attachments = [...c.attachments, ...uploaded];
      c.setDraft([c.draft, share.text].where((s) => s.isNotEmpty).join('\n\n'));
      applied = true;
      if (mounted) Navigator.pop(context);
      c.message('已添加到输入框，请确认后发送');
    } catch (e) {
      if (mounted) {
        setState(
          () => error = e is StateError ? e.message.toString() : '添加分享内容失败，请重试',
        );
      }
    } finally {
      if (!applied && c.accountKey == account) {
        for (final file in uploaded) {
          await c.api
              .request('DELETE', '/api/files/${file['id']}')
              .catchError((_) => <String, dynamic>{});
        }
      }
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AppDialog(
    title: '接收分享',
    closeDisabled: busy,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            '添加到当前输入框，保留已有草稿。附件会在确认后上传，内容不会自动发送。',
            style: TextStyle(fontSize: 13),
          ),
          const SizedBox(height: 16),
          if (widget.share.error.isNotEmpty) Text(widget.share.error),
          if (widget.share.text.isNotEmpty)
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 180),
              child: SingleChildScrollView(
                child: SelectableText(widget.share.text),
              ),
            ),
          for (final file in widget.share.files)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text(
                file.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            children: [
              TextButton(
                onPressed: busy
                    ? null
                    : () async {
                        try {
                          await widget.inbox.remove(widget.share);
                          if (context.mounted) Navigator.pop(context);
                        } catch (_) {
                          if (mounted) setState(() => error = '无法移除，请重试');
                        }
                      },
                child: const Text('丢弃'),
              ),
              FilledButton(
                onPressed: busy || widget.share.error.isNotEmpty ? null : apply,
                child: Text(busy ? '正在添加…' : '添加到当前输入框'),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}
