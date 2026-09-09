import 'dart:convert';

import 'package:flutter/material.dart';

import '../../shared/widgets/app_toast.dart';

import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:file_picker/file_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../shared/widgets/common.dart';
import '../../shared/widgets/ui_icon.dart';
import '../chat/presentation/code_block.dart';

/// Generated HTML has no authenticated cookies or native bridge. No navigation
/// to application APIs is allowed from the artifact surface.
class PreviewScreen extends StatefulWidget {
  final String html;
  final String language;
  final String title;
  const PreviewScreen({
    super.key,
    required this.html,
    this.language = 'html',
    this.title = 'HTML 预览',
  });
  @override
  State<PreviewScreen> createState() => _PreviewScreenState();
}

class _PreviewScreenState extends State<PreviewScreen> {
  late final WebViewController web;
  String? error;
  bool sourceMode = false;
  @override
  void initState() {
    super.initState();
    web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) => NavigationDecision.prevent,
        ),
      );
    load();
  }

  Future<void> load() async {
    try {
      await web.loadHtmlString(
        '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: https:; connect-src \'none\'; frame-src \'none\'; form-action \'none\'"><style>body{font-family:sans-serif;margin:16px;overflow-wrap:anywhere}img{max-width:100%}</style>${widget.html}',
      );
    } catch (_) {
      if (mounted) setState(() => error = '预览加载失败，请返回后重试');
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Column(
        children: [
          Container(
            height: 49,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: Theme.of(context).colorScheme.outline,
                ),
              ),
            ),
            child: Row(
              children: [
                for (final tab in [
                  (false, LucideIcons.eye, '预览'),
                  (true, LucideIcons.codeXml, '源码'),
                ])
                  Tooltip(
                    message: tab.$3,
                    child: Material(
                      color: sourceMode == tab.$1
                          ? Theme.of(context)
                                .colorScheme
                                .surfaceContainerHighest
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(6),
                      child: InkWell(
                        onTap: () => setState(() => sourceMode = tab.$1),
                        child: SizedBox(
                          width: 32,
                          height: 28,
                          child: Center(child: UiIcon(tab.$2, size: 15)),
                        ),
                      ),
                    ),
                  ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    widget.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                ActionIcon(
                  '下载 HTML',
                  LucideIcons.download,
                  () async {
                    try {
                      await FilePicker.saveFile(
                        dialogTitle: '下载 HTML',
                        fileName: 'preview.html',
                        bytes: Uint8List.fromList(utf8.encode(widget.html)),
                      );
                    } catch (_) {
                      if (context.mounted) {
                        AppToastHost.show(context, '下载失败，请重试', kind: 'error');
                      }
                    }
                  },
                  compact: true,
                  buttonWidth: 32,
                ),
                const SizedBox(width: 4),
                ActionIcon(
                  '关闭预览',
                  LucideIcons.x,
                  () => Navigator.pop(context),
                  compact: true,
                  iconSize: 16,
                  buttonWidth: 32,
                ),
              ],
            ),
          ),
          Expanded(
            child: sourceMode
                ? SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: CodeBlock(
                      code: widget.html,
                      language: widget.language,
                      collapseLines: 8,
                    ),
                  )
                : error == null
                ? WebViewWidget(controller: web)
                : Center(child: Text(error!)),
          ),
        ],
      ),
    ),
  );
}
