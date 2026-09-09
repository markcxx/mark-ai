import 'package:markai_mobile/shared/widgets/ui_icon.dart';

import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../../shared/models/chat.dart';
import 'file_service.dart';

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
      return GestureDetector(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute<void>(
            builder: (context) => Scaffold(
              appBar: AppBar(
                title: Text(widget.file['name'] as String? ?? '图片'),
              ),
              body: InteractiveViewer(
                minScale: .5,
                maxScale: 5,
                child: Center(child: Image.memory(result.data!)),
              ),
            ),
          ),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.memory(result.data!, fit: BoxFit.contain),
        ),
      );
    },
  );
}
