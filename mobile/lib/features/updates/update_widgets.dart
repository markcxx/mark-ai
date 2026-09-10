import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/storage/local_store.dart';
import '../../shared/widgets/app_dialog.dart';
import '../../shared/widgets/app_select.dart';
import '../../shared/widgets/ui_icon.dart';
import 'update_service.dart';

class UpdateScope extends InheritedWidget {
  final Future<void> Function() check;
  final bool checking;
  final String version;
  const UpdateScope({
    super.key,
    required super.child,
    required this.check,
    required this.checking,
    required this.version,
  });
  static UpdateScope? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<UpdateScope>();
  @override
  bool updateShouldNotify(UpdateScope oldWidget) =>
      checking != oldWidget.checking || version != oldWidget.version;
}

class UpdateHost extends StatefulWidget {
  final Widget child;
  final GlobalKey<NavigatorState> navigator;
  final LocalStore local;
  final bool enabled;
  final bool ready;
  final UpdateService? service;
  const UpdateHost({
    super.key,
    required this.child,
    required this.navigator,
    required this.local,
    required this.enabled,
    this.ready = true,
    this.service,
  });
  @override
  State<UpdateHost> createState() => _UpdateHostState();
}

class _UpdateHostState extends State<UpdateHost> with WidgetsBindingObserver {
  late final service = widget.service ?? UpdateService();
  bool checking = false, showing = false;
  String version = '';
  Timer? reminder, retry;
  int retries = 0;
  bool backgrounded = false;
  AndroidUpdate? pendingUpdate;
  final remindedVersions = <String>{};
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (widget.enabled &&
        !kIsWeb &&
        defaultTargetPlatform == TargetPlatform.android) {
      WidgetsBinding.instance.addPostFrameCallback((_) => initialize());
    }
  }

  @override
  void dispose() {
    reminder?.cancel();
    retry?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  bool get automaticEnabled =>
      widget.enabled &&
      !kIsWeb &&
      defaultTargetPlatform == TargetPlatform.android;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Android also sends inactive/resumed for notification shade and permission
    // dialogs. Only a real background visit starts a new reminder opportunity.
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      backgrounded = true;
      retry?.cancel();
    } else if (state == AppLifecycleState.resumed && backgrounded) {
      backgrounded = false;
      retries = 0;
      remindedVersions.clear();
      if (automaticEnabled) unawaited(check(manual: false));
    }
  }

  void retryAutomaticCheck() {
    if (!automaticEnabled || backgrounded || retries >= 3) return;
    retry?.cancel();
    retry = Timer(Duration(seconds: 4 * (1 << retries++)), () {
      if (mounted) unawaited(check(manual: false));
    });
  }

  void queueReminder(AndroidUpdate update) {
    if (remindedVersions.contains(update.versionName)) return;
    pendingUpdate = update;
    reminder?.cancel();
    void tryShow() {
      final navigator = widget.navigator.currentState;
      final context = navigator?.overlay?.context;
      if (!mounted ||
          !widget.ready ||
          showing ||
          checking ||
          navigator == null ||
          navigator.canPop() ||
          context == null ||
          !context.mounted ||
          (WidgetsBinding.instance.lifecycleState != null &&
              WidgetsBinding.instance.lifecycleState !=
                  AppLifecycleState.resumed)) {
        return;
      }
      final available = pendingUpdate;
      if (available == null) return;
      reminder?.cancel();
      pendingUpdate = null;
      showing = true;
      remindedVersions.add(available.versionName);
      showAppDialog(
        context,
        (_) => UpdateDialog(service: service, update: available),
      ).whenComplete(() => showing = false);
    }

    tryShow();
    if (pendingUpdate != null) {
      reminder = Timer.periodic(
        const Duration(milliseconds: 500),
        (_) => tryShow(),
      );
    }
  }

  Future<void> initialize() async {
    try {
      await service.cleanCache();
    } catch (_) {
      /* Cache cleanup failure must not suppress the update check. */
    }
    await check(manual: false);
  }

  Future<void> check({bool manual = true}) async {
    if (checking || showing || !mounted) return;
    retry?.cancel();
    setState(() => checking = true);
    AndroidUpdate? available;
    String? message;
    try {
      final info = await service.info();
      if (!mounted) return;
      setState(() => version = '${info['versionName']}');
      if (info['debug'] == true) {
        if (manual) message = '当前为调试版本，请使用正式安装包检查更新。';
      } else {
        final update = await service.check();
        retries = 0;
        if (update != null &&
            compareUpdateVersions(
                  update.versionName,
                  info['versionName'] as String,
                ) >
                0 &&
            update.versionCode > (info['versionCode'] as int)) {
          if (update.minSdk > (info['sdk'] as int)) {
            if (manual) message = '新版本需要更新的 Android 系统，当前版本仍可继续使用。';
          } else {
            available = update;
          }
        } else if (manual) {
          message = '当前已是最新版本。';
        }
      }
    } catch (_) {
      if (manual) {
        message = '暂时无法检查更新，请检查网络后重试。';
      } else if (mounted) {
        retryAutomaticCheck();
      }
    } finally {
      if (mounted) setState(() => checking = false);
    }
    if (!mounted) return;
    if (!manual && available != null) {
      queueReminder(available);
      return;
    }
    if (manual) {
      reminder?.cancel();
      pendingUpdate = null;
    }
    final dialogContext = widget.navigator.currentState?.overlay?.context;
    if (dialogContext == null || !dialogContext.mounted) return;
    showing = true;
    try {
      if (available != null) {
        remindedVersions.add(available.versionName);
        await showAppDialog(
          dialogContext,
          (_) => UpdateDialog(service: service, update: available!),
        );
      } else if (message != null) {
        await showAppDialog(
          dialogContext,
          (context) => AppDialog(
            title: '检查更新',
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (message == '当前已是最新版本。') ...[
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: UiIcon(LucideIcons.circleCheck, size: 28),
                    ),
                    const SizedBox(height: 16),
                  ],
                  Text(
                    message!,
                    style: const TextStyle(fontSize: 14, height: 1.6),
                  ),
                  if (message == '当前已是最新版本。' && version.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      'MarkAI $version',
                      style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('我知道了'),
                  ),
                ],
              ),
            ),
          ),
        );
      }
    } finally {
      showing = false;
    }
  }

  @override
  Widget build(BuildContext context) => UpdateScope(
    check: check,
    checking: checking,
    version: version,
    child: widget.child,
  );
}

class UpdateSettings extends StatelessWidget {
  const UpdateSettings({super.key});
  @override
  Widget build(BuildContext context) {
    final scope = UpdateScope.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'MarkAI',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            scope?.version.isNotEmpty == true
                ? '当前版本 ${scope!.version}'
                : 'Android 应用更新',
          ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: scope == null || scope.checking ? null : scope.check,
            child: Text(scope?.checking == true ? '正在检查…' : '检查更新'),
          ),
        ],
      ),
    );
  }
}

class UpdateDialog extends StatefulWidget {
  final UpdateService service;
  final AndroidUpdate update;
  const UpdateDialog({super.key, required this.service, required this.update});
  @override
  State<UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<UpdateDialog>
    with WidgetsBindingObserver {
  CancelToken? token;
  File? downloaded;
  double progress = 0;
  bool busy = false, awaitingPermission = false;
  String? message;
  late String channelId = widget.update.downloads.first.id;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    token?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && awaitingPermission && !busy) {
      resumeInstall();
    }
  }

  Future<void> resumeInstall() async {
    try {
      if (await widget.service.canInstall() && mounted) {
        awaitingPermission = false;
        await run();
      }
    } catch (_) {
      /* Keep the explicit retry button available. */
    }
  }

  Future<void> run() async {
    if (busy) return;
    setState(() {
      busy = true;
      message = null;
    });
    try {
      if (downloaded == null) {
        token = CancelToken();
        downloaded = await widget.service.download(widget.update, token!, (
          received,
          total,
        ) {
          if (mounted) {
            setState(() => progress = (received / total).clamp(0, 1));
          }
        }, channelId: channelId);
      }
      if (!mounted) return;
      if (!await widget.service.canInstall()) {
        if (!mounted) return;
        setState(() => message = '请允许 MarkAI 安装更新，授权返回后将继续安装。');
        awaitingPermission = true;
        await widget.service.requestPermission();
      } else {
        if (!mounted) return;
        await widget.service.install(downloaded!, widget.update);
        if (mounted) setState(() => message = '请在系统界面确认安装；如果已取消，可以再次点击安装。');
      }
    } on PlatformException catch (error) {
      if (error.code == 'INVALID_APK') downloaded = null;
      if (mounted) setState(() => message = error.message ?? '无法安装，请重试。');
    } catch (error) {
      if (mounted) {
        setState(
          () => message = error is FormatException
              ? error.message
              : '下载失败，请检查网络后重试。',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AppDialog(
    title: '发现新版本 ${widget.update.versionName}',
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.update.notes),
          const SizedBox(height: 12),
          Text(
            '安装包 ${(widget.update.size / 1024 / 1024).toStringAsFixed(1)} MB',
          ),
          if (widget.update.downloads.length > 1) ...[
            const SizedBox(height: 16),
            const Text('下载渠道'),
            const SizedBox(height: 8),
            AppSelect<String>(
              value: channelId,
              options: {for (final d in widget.update.downloads) d.id: d.label},
              onChanged: busy || downloaded != null
                  ? null
                  : (value) => setState(() {
                      channelId = value;
                      progress = 0;
                      message = null;
                    }),
              label: '选择下载渠道',
              width: double.infinity,
              height: 40,
            ),
          ],
          if (busy && downloaded == null) ...[
            const SizedBox(height: 16),
            LinearProgressIndicator(value: progress),
            const SizedBox(height: 8),
            Text(
              progress == 1 ? '正在校验安装包…' : '正在下载 ${(progress * 100).round()}%',
            ),
          ],
          if (message != null) ...[const SizedBox(height: 12), Text(message!)],
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(busy ? '取消下载' : '稍后再说'),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: busy ? null : run,
                child: Text(
                  busy
                      ? '处理中…'
                      : downloaded == null
                      ? '下载更新'
                      : '继续安装',
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}
