import 'package:markai_mobile/shared/widgets/ui_icon.dart';

import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../../shared/models/chat.dart';
import 'file_service.dart';
import 'file_preview.dart';

class GeneratedImage extends StatefulWidget {
  final Json file;
  final ApiClient api;
  const GeneratedImage({super.key, required this.file, required this.api});
  @override
  State<GeneratedImage> createState() => _GeneratedImageState();
}

class _GeneratedImageState extends State<GeneratedImage> {
  late Future<Uint8List> content;
  @override
  void initState() {
    super.initState();
    content = FileService(widget.api).bytes(widget.file);
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Uint8List>(
    future: content,
    builder: (context, result) {
      if (result.hasError) {
        return TextButton.icon(
          onPressed: () => setState(
            () => content = FileService(widget.api).bytes(widget.file),
          ),
          icon: const UiIcon(Icons.refresh),
          label: const Text('图片加载失败，点击重试'),
        );
      }
      if (!result.hasData) {
        return Container(
          height: 180,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Center(child: Text('正在加载图片…')),
        );
      }
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Semantics(
          button: true,
          label: '预览 ${widget.file['name'] ?? '图片'}',
          child: GestureDetector(
            onTap: () => showFilePreview(context, widget.api, widget.file),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(context).height * .72,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.memory(result.data!, fit: BoxFit.contain),
              ),
            ),
          ),
        ),
      );
    },
  );
}
