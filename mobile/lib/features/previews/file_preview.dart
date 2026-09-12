import '../../shared/widgets/swipe_back_route.dart';

import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/network/api_client.dart';
import '../../shared/models/chat.dart';
import '../../shared/widgets/common.dart';
import '../../shared/widgets/file_type_icon.dart';
import '../../shared/widgets/app_toast.dart';
import 'file_service.dart';

bool supportsNativeFilePreview(Json file) {
  final type = (file['contentType'] as String? ?? '').toLowerCase();
  final name = (file['name'] as String? ?? '').toLowerCase();
  if ([
        '.pdf',
        '.doc',
        '.docx',
        '.docm',
        '.dotx',
        '.dotm',
        '.xls',
        '.xlsx',
        '.xlsm',
        '.xlsb',
        '.ppt',
        '.pptx',
        '.pptm',
        '.rtf',
        '.odt',
        '.ods',
        '.odp',
      ].any(name.endsWith) ||
      type.contains('pdf') ||
      type.contains('officedocument') ||
      type.contains('msword') ||
      type.contains('ms-excel') ||
      type.contains('ms-powerpoint') ||
      type.contains('opendocument')) {
    return false;
  }
  return type.startsWith('image/') ||
      type.startsWith('text/') ||
      [
        '.txt',
        '.md',
        '.csv',
        '.json',
        '.xml',
        '.yaml',
        '.yml',
      ].any(name.endsWith);
}

Future<void> showFilePreview(
  BuildContext context,
  ApiClient api,
  Json file,
) async {
  if (!supportsNativeFilePreview(file)) {
    AppToastHost.show(context, '安卓端不支持此文件预览，请下载后打开');
    return;
  }
  await Navigator.push(
    context,
    SwipeBackRoute<void>(
      reduceMotion: MediaQuery.disableAnimationsOf(context),
      builder: (_) => FilePreview(api: api, file: file),
    ),
  );
}

class FilePreview extends StatefulWidget {
  final ApiClient api;
  final Json file;
  const FilePreview({super.key, required this.api, required this.file});
  @override
  State<FilePreview> createState() => _FilePreviewState();
}

class _FilePreviewState extends State<FilePreview> {
  late Future<Uint8List> bytes = FileService(widget.api).bytes(widget.file);
  final zoom = TransformationController();
  bool enlarged = false;
  String get name => widget.file['name'] as String? ?? '文件';
  bool get image =>
      (widget.file['contentType'] as String? ?? '').startsWith('image/');
  void toggleZoom() => setState(() {
    enlarged = !enlarged;
    zoom.value = enlarged
        ? Matrix4.diagonal3Values(2, 2, 1)
        : Matrix4.identity();
  });
  Future<void> download() async {
    try {
      await FileService(widget.api).saveFile(widget.file);
    } catch (_) {
      if (mounted) {
        AppToastHost.show(context, '下载失败，请重试', kind: 'error');
      }
    }
  }

  @override
  void dispose() {
    zoom.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: image
        ? const Color(0xeb000000)
        : Theme.of(context).colorScheme.surface,
    body: SafeArea(
      child: Column(
        children: [
          Container(
            height: image ? 52 : 49,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: image
                ? null
                : BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: Theme.of(context).colorScheme.outline,
                      ),
                    ),
                  ),
            child: Row(
              children: [
                if (!image) ...[
                  FileTypeIcon(
                    contentType: widget.file['contentType'] as String? ?? '',
                    name: name,
                    tile: true,
                    size: 32,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ] else
                  const Spacer(),
                if (image)
                  TextButton(
                    onPressed: download,
                    child: const Text(
                      '下载',
                      style: TextStyle(color: Colors.white),
                    ),
                  )
                else
                  ActionIcon(
                    '下载 $name',
                    LucideIcons.download,
                    download,
                    compact: true,
                    buttonWidth: 32,
                    buttonHeight: 32,
                  ),
                if (image)
                  ActionIcon(
                    '缩放图片',
                    enlarged ? LucideIcons.zoomOut : LucideIcons.zoomIn,
                    toggleZoom,
                    color: Colors.white,
                  ),
                ActionIcon(
                  '关闭预览',
                  LucideIcons.x,
                  () => Navigator.pop(context),
                  color: image ? Colors.white : null,
                  compact: !image,
                  buttonWidth: image ? 44 : 32,
                  buttonHeight: image ? 44 : 32,
                ),
              ],
            ),
          ),
          Expanded(
            child: FutureBuilder<Uint8List>(
              future: bytes,
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Center(
                    child: TextButton(
                      onPressed: () => setState(
                        () =>
                            bytes = FileService(widget.api).bytes(widget.file),
                      ),
                      child: const Text('文件加载失败，点击重试'),
                    ),
                  );
                }
                if (!snapshot.hasData) {
                  return Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: image ? Colors.white : null,
                      ),
                    ),
                  );
                }
                if (image) {
                  return GestureDetector(
                    onDoubleTap: toggleZoom,
                    onVerticalDragEnd: (details) {
                      if (!enlarged &&
                          (details.primaryVelocity ?? 0).abs() > 300) {
                        Navigator.pop(context);
                      }
                    },
                    child: InteractiveViewer(
                      transformationController: zoom,
                      minScale: 1,
                      maxScale: 5,
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Image.memory(
                            snapshot.data!,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ),
                  );
                }
                return ColoredBox(
                  color: Colors.white,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(8),
                    child: SizedBox(
                      width: double.infinity,
                      child: SelectableText(
                        utf8.decode(snapshot.data!, allowMalformed: true),
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 13,
                          color: Colors.black,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          if (image)
            SizedBox(
              height: 72,
              child: Center(
                child: Text(
                  name,
                  style: const TextStyle(fontSize: 14, color: Colors.white),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}
