import 'dart:async';
import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../shared/widgets/common.dart';
import '../../shared/widgets/ui_icon.dart';
import '../../shared/widgets/app_select.dart';
import '../../shared/widgets/app_toast.dart';
import '../../shared/widgets/app_dialog.dart';
import '../chat/presentation/tool_call_block.dart' show ToolSpinner;

String? artifactKind(String language) =>
    switch (language.trim().toLowerCase()) {
      'echarts' || 'echart' || 'chart' => 'echarts',
      'mermaid' => 'mermaid',
      'markmap' || 'mindmap' => 'markmap',
      _ => null,
    };

class ArtifactCard extends StatefulWidget {
  final String kind, source;
  final bool fullscreen;
  const ArtifactCard({
    super.key,
    required this.kind,
    required this.source,
    this.fullscreen = false,
  });
  @override
  State<ArtifactCard> createState() => ArtifactCardState();
}

class ArtifactCaptureScope extends InheritedWidget {
  final Set<ArtifactCardState> cards;
  final bool capturing;
  const ArtifactCaptureScope({
    super.key,
    required this.cards,
    required this.capturing,
    required super.child,
  });
  @override
  bool updateShouldNotify(ArtifactCaptureScope oldWidget) =>
      capturing != oldWidget.capturing;
}

class ArtifactCardState extends State<ArtifactCard> {
  static Future<String>? _runtime;
  late final WebViewController web;
  bool open = true,
      ready = false,
      loaded = false,
      exporting = false,
      copied = false;
  String? error;
  String theme = 'auto', title = '';
  Map<String, String> themes = {'auto': '跟随界面', 'light': '明亮', 'dark': '深色'};
  bool? lastDark;
  Timer? refresh, copyTimer;
  int exportId = 0;
  Completer<Uint8List>? pendingExport;
  Set<ArtifactCardState>? captureCards;
  Uint8List? captureImage;
  bool capturing = false;
  String get label => switch (widget.kind) {
    'echarts' => '图表',
    'mermaid' => '流程图',
    _ => '脑图',
  };
  @override
  void initState() {
    super.initState();
    title = switch (widget.kind) {
      'echarts' => '数据图表',
      'mermaid' => 'Mermaid 流程图',
      _ => 'Markmap 脑图',
    };
    web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (_) => NavigationDecision.prevent,
          onPageFinished: (_) {
            loaded = true;
            render();
          },
          onWebResourceError: (e) {
            if (e.isForMainFrame == true && mounted) {
              setState(() => error = '预览加载失败，请重试');
            }
          },
        ),
      )
      ..addJavaScriptChannel(
        'MarkAIArtifactStatus',
        onMessageReceived: (message) {
          if (!mounted) return;
          try {
            final data = jsonDecode(message.message) as Map;
            if (data['type'] == 'ready') {
              setState(() {
                ready = true;
                error = null;
                title = data['title'] as String? ?? title;
                final options = data['themes'] as List? ?? [];
                if (options.isNotEmpty) {
                  themes = {
                    for (final option in options)
                      option['value'] as String: option['label'] as String,
                  };
                }
              });
            }
            if (data['type'] == 'error') {
              setState(() {
                ready = false;
                error = data['message'] as String? ?? '$label暂时无法展示';
              });
            }
            if (data['type'] == 'export' &&
                data['id'] == exportId &&
                pendingExport?.isCompleted == false) {
              final uri = data['data'] as String? ?? '';
              if (!RegExp(r'^data:image/(png|svg\+xml);base64,')
                      .hasMatch(uri) ||
                  uri.length > 48000000) {
                throw const FormatException('导出数据无效或过大');
              }
              pendingExport!.complete(
                base64Decode(uri.substring(uri.indexOf(',') + 1)),
              );
            }
            if (data['type'] == 'export-error' &&
                data['id'] == exportId &&
                pendingExport?.isCompleted == false) {
              pendingExport!.completeError(StateError('图片导出失败，请重试'));
            }
          } catch (e) {
            if (pendingExport?.isCompleted == false) {
              pendingExport!.completeError(e);
            }
          }
        },
      );
    load();
  }

  Future<void> load() async {
    try {
      final runtime = await (_runtime ??= rootBundle.loadString(
        'assets/web/artifact-runtime.js',
      ));
      if (!mounted) return;
      await web.loadHtmlString(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; connect-src \'none\'; frame-src \'none\'; form-action \'none\'"><style>html,body,#view{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:sans-serif}a{pointer-events:none}</style></head><body><div id="view"></div><script>${runtime.replaceAll('</script', r'<\/script')}</script></body></html>',
      );
    } catch (_) {
      if (mounted) setState(() => error = '预览资源加载失败，请重试');
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final scope = context
        .dependOnInheritedWidgetOfExactType<ArtifactCaptureScope>();
    captureCards?.remove(this);
    captureCards = scope?.cards;
    captureCards?.add(this);
    capturing = scope?.capturing == true;
    final dark = Theme.of(context).brightness == Brightness.dark;
    if (lastDark != dark) {
      lastDark = dark;
      if (loaded) render();
    }
  }

  @override
  void didUpdateWidget(covariant ArtifactCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.source != widget.source || oldWidget.kind != widget.kind) {
      refresh?.cancel();
      refresh = Timer(const Duration(milliseconds: 160), render);
    }
  }

  Future<void> render() async {
    if (!loaded || !mounted) return;
    setState(() {
      ready = false;
      error = null;
    });
    try {
      await web.runJavaScript(
        'window.MarkAIArtifact.render(${jsonEncode(widget.kind)},${jsonEncode(widget.source)},{dark:${lastDark == true},theme:${jsonEncode(theme)}});',
      );
    } catch (_) {
      if (mounted) setState(() => error = '$label暂时无法展示');
    }
  }

  Future<void> command(String action) => web.runJavaScript(
    'window.MarkAIArtifact.command(${jsonEncode(action)});',
  );
  Future<Uint8List> exportBytes(String format) async {
    if (!ready) throw StateError('请等待预览完成');
    if (pendingExport != null) throw StateError('正在导出，请稍候');
    final id = ++exportId;
    final task = Completer<Uint8List>();
    pendingExport = task;
    try {
      await web.runJavaScript(
        '(async()=>{try{const data=await window.MarkAIArtifact.exportImage(${jsonEncode(format)});MarkAIArtifactStatus.postMessage(JSON.stringify({type:"export",id:$id,data}));}catch(e){MarkAIArtifactStatus.postMessage(JSON.stringify({type:"export-error",id:$id}));}})();',
      );
      return await task.future.timeout(const Duration(seconds: 30));
    } finally {
      if (identical(pendingExport, task)) pendingExport = null;
    }
  }

  Future<void> download(String format) async {
    setState(() => exporting = true);
    try {
      final bytes = await exportBytes(format);
      final path = await FilePicker.saveFile(
        fileName: '${title.replaceAll(RegExp(r'[/\\:*?"<>|]'), '-')}.$format',
        mimeType: format == 'svg' ? 'image/svg+xml' : 'image/png',
        bytes: bytes,
      );
      if (mounted && path != null) {
        AppToastHost.show(context, '已导出', kind: 'success');
      }
    } catch (_) {
      if (mounted) AppToastHost.show(context, '导出失败，请重试', kind: 'error');
    } finally {
      if (mounted) setState(() => exporting = false);
    }
  }

  Future<void> copy() async {
    await Clipboard.setData(ClipboardData(text: widget.source.trim()));
    if (!mounted) return;
    setState(() => copied = true);
    copyTimer?.cancel();
    copyTimer = Timer(const Duration(milliseconds: 1600), () {
      if (mounted) setState(() => copied = false);
    });
  }

  void expand() => showAppDialog(
    context,
    (_) => AppDialog(
      title: title,
      width: 1152,
      height: MediaQuery.sizeOf(context).height * .9,
      scrollBody: false,
      child: ArtifactCard(
        kind: widget.kind,
        source: widget.source,
        fullscreen: true,
      ),
    ),
  );
  @override
  void dispose() {
    captureCards?.remove(this);
    refresh?.cancel();
    copyTimer?.cancel();
    if (pendingExport?.isCompleted == false) {
      pendingExport!.completeError(StateError('预览已关闭'));
    }
    super.dispose();
  }

  Widget action(String label, IconData icon, VoidCallback? tap) => ActionIcon(
    label,
    icon,
    tap,
    compact: true,
    buttonWidth: 32,
    buttonHeight: 32,
    iconSize: 15,
  );
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final surface = dark ? const Color(0xff171717) : Colors.white;
    final height = widget.fullscreen
        ? MediaQuery.sizeOf(context).height -
              MediaQuery.paddingOf(context).vertical -
              180
        : MediaQuery.sizeOf(context).width < 640
        ? 340.0
        : 380.0;
    final preview = Stack(
      children: [
        Positioned.fill(
          child: capturing && captureImage != null
              ? Image.memory(captureImage!, fit: BoxFit.contain)
              : WebViewWidget(
                  controller: web,
                  gestureRecognizers: {
                    Factory<OneSequenceGestureRecognizer>(
                      () => EagerGestureRecognizer(),
                    ),
                  },
                ),
        ),
        if (!ready && error == null)
          Positioned.fill(
            child: ColoredBox(
              color: surface.withValues(alpha: .85),
              child: const Center(
                child: ToolSpinner(size: 21, color: Color(0xff9ca3af)),
              ),
            ),
          ),
        if (error != null)
          Positioned.fill(
            child: ColoredBox(
              color: surface,
              child: Align(
                alignment: Alignment.topLeft,
                child: _ArtifactError(label: label),
              ),
            ),
          ),
        if (widget.fullscreen && ready)
          Positioned(
            top: 12,
            right: 12,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 4,
              children: [
                if (widget.kind != 'echarts')
                  action(
                    '下载$label SVG',
                    LucideIcons.download,
                    exporting ? null : () => download('svg'),
                  ),
                action(
                  '下载$label PNG',
                  LucideIcons.imageDown,
                  exporting ? null : () => download('png'),
                ),
              ],
            ),
          ),
        if (ready && widget.kind != 'echarts')
          Positioned(
            right: 12,
            bottom: 12,
            child: Material(
              color: surface.withValues(alpha: .9),
              borderRadius: BorderRadius.circular(8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  action('缩小', LucideIcons.zoomOut, () => command('zoomOut')),
                  action('放大', LucideIcons.zoomIn, () => command('zoomIn')),
                  action('适应画布', LucideIcons.scan, () => command('fit')),
                  if (widget.kind == 'markmap') ...[
                    action(
                      '全部展开',
                      LucideIcons.listTree,
                      () => command('expand'),
                    ),
                    action(
                      '全部收起',
                      LucideIcons.listCollapse,
                      () => command('collapse'),
                    ),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
    if (widget.fullscreen) return SizedBox.expand(child: preview);
    return Container(
      margin: widget.fullscreen
          ? EdgeInsets.zero
          : const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: dark ? const Color(0x1affffff) : const Color(0xffe5e7eb),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0d000000),
            offset: Offset(0, 1),
            blurRadius: 2,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            constraints: const BoxConstraints(minHeight: 48),
            decoration: BoxDecoration(
              border: open
                  ? Border(
                      bottom: BorderSide(
                        color: dark
                            ? const Color(0x14ffffff)
                            : const Color(0xfff3f4f6),
                      ),
                    )
                  : null,
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final actions = Row(
                  spacing: 4,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (widget.kind == 'echarts' && error == null)
                      AppSelect<String>(
                        value: theme,
                        options: themes,
                        label: '图表主题',
                        width: 112,
                        height: 28,
                        onChanged: (value) {
                          setState(() => theme = value);
                          render();
                        },
                      ),
                    if (!widget.fullscreen)
                      action(
                        '放大查看$label',
                        LucideIcons.maximize2,
                        ready ? expand : null,
                      ),
                    if (widget.kind != 'echarts')
                      action(
                        '下载$label SVG',
                        LucideIcons.download,
                        ready && !exporting ? () => download('svg') : null,
                      ),
                    action(
                      '下载$label PNG',
                      widget.kind == 'echarts'
                          ? LucideIcons.download
                          : LucideIcons.imageDown,
                      ready && !exporting ? () => download('png') : null,
                    ),
                    action(
                      copied ? '源码已复制' : '复制$label源码',
                      copied ? LucideIcons.check : LucideIcons.copy,
                      copy,
                    ),
                  ],
                );
                final heading = InkWell(
                  onTap: () => setState(() => open = !open),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        UiIcon(
                          widget.kind == 'echarts'
                              ? LucideIcons.chartNoAxesCombined
                              : widget.kind == 'mermaid'
                              ? LucideIcons.gitBranch
                              : LucideIcons.network,
                          size: 17,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14,
                              height: 20 / 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        UiIcon(
                          open
                              ? LucideIcons.chevronDown
                              : LucideIcons.chevronRight,
                          size: 15,
                          color: const Color(0xff9ca3af),
                        ),
                      ],
                    ),
                  ),
                );
                final actionWidth = widget.kind == 'echarts' ? 220 : 140;
                return constraints.maxWidth >= actionWidth + 148
                    ? Row(
                        children: [
                          Expanded(child: heading),
                          const SizedBox(width: 8),
                          actions,
                        ],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          heading,
                          Align(
                            alignment: Alignment.centerRight,
                            child: actions,
                          ),
                        ],
                      );
              },
            ),
          ),
          if (open && error != null && widget.kind == 'echarts')
            _ArtifactError(label: label),
          if (open && !(error != null && widget.kind == 'echarts'))
            SizedBox(height: height, child: preview),
        ],
      ),
    );
  }
}

class _ArtifactError extends StatelessWidget {
  final String label;
  const _ArtifactError({required this.label});
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      constraints: const BoxConstraints(minHeight: 112),
      color: dark ? const Color(0x06ffffff) : const Color(0xb3f9fafb),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: dark ? const Color(0x1af59e0b) : const Color(0xfffffbeb),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: UiIcon(
                LucideIcons.circleAlert,
                size: 17,
                color: dark ? const Color(0xfffcd34d) : const Color(0xffd97706),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$label暂时无法展示',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: dark
                          ? const Color(0xffe5e7eb)
                          : const Color(0xff1f2937),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '模型返回的内容可能不完整。请重新生成此回复，或复制源码后检查格式。',
                    style: TextStyle(
                      fontSize: 12,
                      height: 20 / 12,
                      color: dark
                          ? const Color(0xff9ca3af)
                          : const Color(0xff6b7280),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
