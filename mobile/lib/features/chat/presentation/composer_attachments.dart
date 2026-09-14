import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/ui_icon.dart';

class ComposerAttachmentPanel extends StatelessWidget {
  const ComposerAttachmentPanel({
    super.key,
    required this.onPick,
    this.disabled = false,
  });
  final ValueChanged<String> onPick;
  final bool disabled;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 12, bottom: 4),
    child: Row(
      children: [
        for (final (index, option) in const [
          ('camera', '拍照', LucideIcons.camera),
          ('images', '相册', LucideIcons.image),
          ('files', '文件', LucideIcons.paperclip),
        ].indexed) ...[
          if (index > 0) const SizedBox(width: 10),
          Expanded(
            child: OutlinedButton(
              onPressed: disabled ? null : () => onPick(option.$1),
              style: OutlinedButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.onSurface,
                backgroundColor: Theme.of(context).colorScheme.surface,
                side: BorderSide(color: Theme.of(context).colorScheme.outline),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.symmetric(
                  vertical: 18,
                  horizontal: 8,
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  UiIcon(option.$3, size: 24),
                  const SizedBox(height: 8),
                  Text(option.$2, style: const TextStyle(fontSize: 14)),
                ],
              ),
            ),
          ),
        ],
      ],
    ),
  );
}

class PendingAttachments extends StatelessWidget {
  const PendingAttachments({
    super.key,
    required this.files,
    required this.loadImage,
    required this.onRemove,
  });
  final List<Json> files;
  final Future<Uint8List> Function(Json file) loadImage;
  final ValueChanged<String> onRemove;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 2),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: files.map((file) {
          final id = file['id'] as String;
          final name = file['name'] as String? ?? '附件';
          final isImage = (file['contentType'] as String? ?? '').startsWith(
            'image/',
          );
          return isImage
              ? _PendingImage(
                  key: ValueKey(id),
                  file: file,
                  loadImage: loadImage,
                  onRemove: () => onRemove(id),
                )
              : Container(
                  key: ValueKey('pending-file-$id'),
                  constraints: const BoxConstraints(
                    maxWidth: 240,
                    minHeight: 44,
                  ),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest
                        .withValues(alpha: .35),
                    border: Border.all(
                      color: Theme.of(context).colorScheme.outline,
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  padding: const EdgeInsets.only(left: 10),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const UiIcon(LucideIcons.file, size: 18),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                      IconButton(
                        tooltip: '移除$name',
                        onPressed: () => onRemove(id),
                        icon: const UiIcon(LucideIcons.x, size: 16),
                      ),
                    ],
                  ),
                );
        }).toList(),
      ),
    ),
  );
}

class _PendingImage extends StatefulWidget {
  const _PendingImage({
    super.key,
    required this.file,
    required this.loadImage,
    required this.onRemove,
  });
  final Json file;
  final Future<Uint8List> Function(Json file) loadImage;
  final VoidCallback onRemove;
  @override
  State<_PendingImage> createState() => _PendingImageState();
}

class _PendingImageState extends State<_PendingImage> {
  late final content = widget.loadImage(widget.file);
  @override
  Widget build(BuildContext context) {
    final name = widget.file['name'] as String? ?? '图片';
    return SizedBox(
      key: ValueKey('pending-image-${widget.file['id']}'),
      width: 76,
      height: 76,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
            ),
            FutureBuilder<Uint8List>(
              future: content,
              builder: (context, snapshot) => snapshot.hasData
                  ? Image.memory(
                      snapshot.data!,
                      fit: BoxFit.cover,
                      cacheWidth: 228,
                      semanticLabel: name,
                      errorBuilder: (_, _, _) => const Center(
                        child: UiIcon(LucideIcons.imageOff, size: 22),
                      ),
                    )
                  : Center(
                      child: UiIcon(
                        snapshot.hasError
                            ? LucideIcons.imageOff
                            : LucideIcons.image,
                        size: 22,
                      ),
                    ),
            ),
            Positioned(
              top: 0,
              right: 0,
              child: IconButton(
                tooltip: '移除$name',
                onPressed: widget.onRemove,
                constraints: const BoxConstraints.tightFor(
                  width: 44,
                  height: 44,
                ),
                padding: const EdgeInsets.all(8),
                icon: const CircleAvatar(
                  radius: 11,
                  backgroundColor: Colors.black54,
                  child: UiIcon(LucideIcons.x, size: 14, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
