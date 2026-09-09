import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/app_dialog.dart';
import '../../../shared/widgets/common.dart';
import '../../previews/artifact_card.dart';
import '../../previews/file_service.dart';
import '../application/workspace_controller.dart';
import 'message_markdown.dart';

class ExportDialog extends StatefulWidget {
  final WorkspaceController controller;
  final ChatSession session;
  final String initialMode;
  const ExportDialog({
    super.key,
    required this.controller,
    required this.session,
    this.initialMode = 'image',
  });
  @override
  State<ExportDialog> createState() => _ExportDialogState();
}

class _ExportDialogState extends State<ExportDialog> {
  final boundary = GlobalKey();
  final cards = <ArtifactCardState>{};
  final images = <String, Uint8List>{};
  late final List<ChatMessage> messages = widget.controller.messages
      .map((m) => m.copy()..data['isStreaming'] = false)
      .toList();
  late String mode = widget.initialMode;
  late final Future<void> imageLoad = loadImages();
  bool busy = false, capturing = false;
  String? imageError;
  Json get payload => {
    'app': 'MARKAI',
    'schemaVersion': 1,
    'exportedAt': DateTime.now().toUtc().toIso8601String(),
    'session': widget.session.data,
    'messages': messages.map((m) => m.toJson()).toList(),
  };
  String get filename =>
      widget.session.title.replaceAll(RegExp(r'[/\\:*?"<>|]'), '-');
  List<Json> generated(ChatMessage m) => m.segments
      .where((s) => s['type'] == 'generated-image')
      .map((s) => jsonMap(jsonMap(s['generatedImage'])['file']))
      .toList();
  Future<void> loadImages() async {
    try {
      for (final file in messages.expand(generated)) {
        images[file['id'] as String] = await FileService(widget.controller.api)
            .bytes(file);
      }
    } catch (_) {
      imageError = '生成图片加载失败，请关闭后重试';
    }
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    imageLoad;
  }

  Future<Uint8List> capture() async {
    await imageLoad;
    if (imageError != null) throw StateError(imageError!);
    final deadline = DateTime.now().add(const Duration(seconds: 30));
    while (cards.any((c) => !c.ready && c.error == null)) {
      if (DateTime.now().isAfter(deadline)) throw StateError('图表尚未加载完成，请稍后重试');
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    for (final card in cards.toList()) {
      if (card.error != null) throw StateError('图表加载失败，请检查消息内容');
      card.captureImage = await card.exportBytes('png');
      if (mounted) {
        await precacheImage(MemoryImage(card.captureImage!), context);
      }
    }
    for (final bytes in images.values) {
      if (mounted) await precacheImage(MemoryImage(bytes), context);
    }
    if (!mounted) throw StateError('导出已取消');
    setState(() => capturing = true);
    await WidgetsBinding.instance.endOfFrame;
    final render =
        boundary.currentContext!.findRenderObject() as RenderRepaintBoundary;
    // Bound the GPU texture and encoded bitmap while retaining every message.
    final ratio = math.min(
      2.0,
      8192 / math.max(render.size.height, render.size.width),
    );
    final image = await render.toImage(pixelRatio: ratio);
    try {
      return (await image.toByteData(format: ui.ImageByteFormat.png))!.buffer
          .asUint8List();
    } finally {
      image.dispose();
      if (mounted) setState(() => capturing = false);
    }
  }

  Future<void> download() async {
    setState(() => busy = true);
    try {
      final bytes = mode == 'json'
          ? Uint8List.fromList(
              utf8.encode(const JsonEncoder.withIndent('  ').convert(payload)),
            )
          : await capture();
      final result = await FilePicker.saveFile(
        fileName: 'MARKAI-$filename.${mode == 'json' ? 'json' : 'png'}',
        mimeType: mode == 'json' ? 'application/json' : 'image/png',
        bytes: bytes,
      );
      if (result != null) {
        widget.controller.message(
          mode == 'json' ? 'JSON 已导出' : '图片已导出',
          kind: 'success',
        );
      }
    } catch (error) {
      widget.controller.message(
        error.toString().replaceFirst('Bad state: ', ''),
        kind: 'error',
      );
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
          capturing = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return AppDialog(
      title: '导出会话',
      width: 1152,
      height: MediaQuery.sizeOf(context).height * .92,
      scrollBody: false,
      closeDisabled: busy,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                for (final entry in {
                  'image': '图片预览',
                  'json': 'JSON 预览',
                }.entries)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: mode == entry.key
                          ? FilledButton(
                              onPressed: busy
                                  ? null
                                  : () => setState(() => mode = entry.key),
                              child: Text(entry.value),
                            )
                          : TextButton(
                              onPressed: busy
                                  ? null
                                  : () => setState(() => mode = entry.key),
                              child: Text(entry.value),
                            ),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              child: mode == 'json'
                  ? Padding(
                      padding: const EdgeInsets.all(16),
                      child: SelectableText(
                        const JsonEncoder.withIndent('  ').convert(payload),
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                        ),
                      ),
                    )
                  : ArtifactCaptureScope(
                      cards: cards,
                      capturing: capturing,
                      child: Container(
                        color: dark
                            ? const Color(0xff0e0f11)
                            : const Color(0xfff1f5f9),
                        padding: const EdgeInsets.all(24),
                        child: RepaintBoundary(
                          key: boundary,
                          child: preview(context),
                        ),
                      ),
                    ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: busy ? null : download,
                child: Text(
                  busy
                      ? '正在导出…'
                      : mode == 'json'
                      ? '下载 JSON'
                      : '下载图片',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget preview(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final line = dark ? const Color(0x1affffff) : const Color(0xffe5e7eb);
    final visible = messages
        .where((m) => m.content.trim().isNotEmpty || generated(m).isNotEmpty)
        .toList();
    final muted = dark ? const Color(0xff9ca3af) : const Color(0xff6b7280);
    return Container(
      decoration: BoxDecoration(
        color: dark ? const Color(0xff111214) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: line)),
            ),
            child: Row(
              children: [
                const Brand(size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.session.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${visible.length} 条消息 · ${widget.session.data['model'] ?? 'MARKAI conversation'}',
                        style: TextStyle(fontSize: 12, color: muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (visible.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Text('暂无可导出的消息', textAlign: TextAlign.center),
                  ),
                for (var i = 0; i < visible.length; i++) ...[
                  if (i > 0) const SizedBox(height: 32),
                  exportMessage(context, visible[i]),
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: line)),
            ),
            child: Column(
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Brand(size: 24),
                    SizedBox(width: 8),
                    Text(
                      'MARKAI',
                      style: TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Generated by MARKAI',
                  style: TextStyle(fontSize: 12, color: muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget exportMessage(BuildContext context, ChatMessage message) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    if (message.isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: FractionallySizedBox(
          widthFactor: .82,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: dark ? const Color(0xff262626) : const Color(0xfff3f4f6),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(2),
                bottomLeft: Radius.circular(16),
                bottomRight: Radius.circular(16),
              ),
            ),
            child: Text(
              message.content,
              style: const TextStyle(fontSize: 15, height: 1.625),
            ),
          ),
        ),
      );
    }
    final model = message.data['model'] as String? ?? 'MARKAI';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ModelBrand(
          model: model,
          provider: message.data['provider'] as String? ?? '',
          size: 32,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                model,
                style: const TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              if ((message.data['reasoning'] as String? ?? '').isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: dark
                        ? const Color(0x0affffff)
                        : const Color(0xfff9fafb),
                    border: Border.all(
                      color: dark
                          ? const Color(0x1affffff)
                          : const Color(0xffe5e7eb),
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    message.data['reasoning'],
                    style: const TextStyle(
                      fontSize: 12,
                      height: 20 / 12,
                      color: Color(0xff6b7280),
                    ),
                  ),
                ),
              if (message.content.trim().isNotEmpty)
                MessageMarkdown(
                  message: message,
                  controller: widget.controller,
                  text: message.content,
                  fontSize: 15,
                ),
              for (final file in generated(message))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: images[file['id']] == null
                      ? Text(imageError ?? '正在加载图片…')
                      : ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.memory(
                            images[file['id']]!,
                            fit: BoxFit.contain,
                          ),
                        ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
