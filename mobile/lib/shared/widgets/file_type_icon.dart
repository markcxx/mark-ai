import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'ui_icon.dart';

/// Same type precedence and neutral/semantic colors as chat/files/FileTypeIcon.
class FileTypeIcon extends StatelessWidget {
  final String contentType, name;
  final bool tile;
  final double size;
  const FileTypeIcon({
    super.key,
    required this.contentType,
    required this.name,
    this.tile = false,
    this.size = 40,
  });
  @override
  Widget build(BuildContext context) {
    final lower = name.toLowerCase();
    bool extension(List<String> suffixes) => suffixes.any(lower.endsWith);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final visual = contentType.startsWith('image/')
        ? (LucideIcons.fileImage, 0xff2563eb, 0xff60a5fa, 0xff3b82f6)
        : contentType.contains('spreadsheet') ||
              extension(['.csv', '.xls', '.xlsx'])
        ? (LucideIcons.fileSpreadsheet, 0xff059669, 0xff34d399, 0xff059669)
        : contentType.contains('presentation') || extension(['.ppt', '.pptx'])
        ? (LucideIcons.presentation, 0xffd97706, 0xfffbbf24, 0xffd97706)
        : contentType == 'application/pdf' || extension(['.pdf'])
        ? (LucideIcons.fileText, 0xffef4444, 0xfff87171, 0xffef4444)
        : contentType.contains('wordprocessing') ||
              contentType == 'application/msword' ||
              extension(['.doc', '.docx'])
        ? (LucideIcons.fileText, 0xff2563eb, 0xff60a5fa, 0xff2563eb)
        : contentType.contains('zip') ||
              extension(['.7z', '.rar', '.tar', '.zip'])
        ? (LucideIcons.fileArchive, 0xff7c3aed, 0xffa78bfa, 0xff7c3aed)
        : (
            LucideIcons.fileText,
            0xff4b5563,
            0xffd1d5db,
            dark ? 0xff6b7280 : 0xff4b5563,
          );
    final icon = UiIcon(
      visual.$1,
      size: 20,
      color: tile ? Colors.white : Color(dark ? visual.$3 : visual.$2),
    );
    return tile
        ? Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              color: Color(visual.$4),
              borderRadius: BorderRadius.circular(8),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0d000000),
                  blurRadius: 2,
                  offset: Offset(0, 1),
                ),
              ],
            ),
            child: Center(child: icon),
          )
        : icon;
  }
}
