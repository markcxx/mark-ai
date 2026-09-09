import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/app_checkbox.dart';
import '../../../shared/widgets/file_type_icon.dart';
import '../../../shared/widgets/common.dart';

String formatFileBytes(num bytes) => bytes < 1024
    ? '$bytes B'
    : bytes < 1048576
    ? '${(bytes / 1024).ceil()} KB'
    : bytes < 1073741824
    ? '${(bytes / 1048576).toStringAsFixed(1)} MB'
    : '${(bytes / 1073741824).toStringAsFixed(1)} GB';

String managedFileDate(String value) {
  final date = DateTime.tryParse(value)?.toLocal();
  if (date == null) return '';
  return '${date.year}年${date.month}月${date.day}日 ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
}

String managedFileType(Json file) {
  final name = file['name'] as String;
  final extension = name.split('.').last.trim().toUpperCase();
  return extension.isNotEmpty && extension != name.toUpperCase()
      ? extension
      : (file['contentType'] as String? ?? '').split('/').last.toUpperCase();
}

class ManagedFileMobileRow extends StatelessWidget {
  final Json file;
  final int index;
  final bool selected;
  final ValueChanged<bool> onSelected;
  final VoidCallback onDownload;
  final VoidCallback? onPreview, onDelete;
  const ManagedFileMobileRow({
    super.key,
    required this.file,
    required this.index,
    required this.selected,
    required this.onSelected,
    required this.onDownload,
    this.onPreview,
    this.onDelete,
  });
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        color: selected
            ? (dark ? const Color(0x0effffff) : const Color(0xfff3f4f6))
            : index.isEven
            ? (dark ? const Color(0x05ffffff) : const Color(0xb3f9fafb))
            : Colors.transparent,
      ),
      child: Row(
        children: [
          SizedBox(
            width: 28,
            child: Align(
              alignment: Alignment.centerLeft,
              child: AppCheckbox(
                checked: selected,
                label: '选择文件 ${file['name']}',
                onChanged: onSelected,
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 40,
            child: Align(
              alignment: Alignment.centerLeft,
              child: InkWell(
                onTap: onPreview,
                child: FileTypeIcon(
                  contentType: file['contentType'] as String? ?? '',
                  name: file['name'] as String,
                  tile: true,
                  size: 36,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  file['name'] as String,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    height: 20 / 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${managedFileType(file)} · ${formatFileBytes(file['size'] as num)} · ${managedFileDate(file['createdAt'] as String? ?? '')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    height: 16 / 12,
                    color: Color(0xff9ca3af),
                  ),
                ),
                const SizedBox(height: 6),
                Transform.translate(
                  offset: const Offset(-4, 0),
                  child: Row(
                    children: [
                      if (onPreview != null) ...[
                        ActionIcon(
                          '预览 ${file['name']}',
                          LucideIcons.eye,
                          onPreview,
                          compact: true,
                          buttonWidth: 32,
                          buttonHeight: 32,
                        ),
                        const SizedBox(width: 4),
                      ],
                      ActionIcon(
                        '下载 ${file['name']}',
                        LucideIcons.download,
                        onDownload,
                        compact: true,
                        buttonWidth: 32,
                        buttonHeight: 32,
                      ),
                      const SizedBox(width: 4),
                      ActionIcon(
                        '删除 ${file['name']}',
                        LucideIcons.trash2,
                        onDelete,
                        compact: true,
                        buttonWidth: 32,
                        buttonHeight: 32,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
