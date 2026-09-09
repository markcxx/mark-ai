import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../shared/widgets/ui_icon.dart';
import 'preview_screen.dart';

String htmlPreviewTitle(String source) {
  final title = RegExp(
    r'<title>([\S\s]*?)</title>',
    caseSensitive: false,
  ).firstMatch(source)?.group(1)?.replaceAll(RegExp(r'\s+'), ' ').trim();
  return title == null || title.isEmpty ? 'HTML 预览' : title;
}

/// Native counterpart of HtmlPreviewBlock; only the generated document uses a browser surface.
class HtmlPreviewCard extends StatelessWidget {
  final String source;
  const HtmlPreviewCard({super.key, required this.source});
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final title = htmlPreviewTitle(source);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Material(
        color: dark ? const Color(0xff151515) : const Color(0xfff8f9fa),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(
            color: dark ? const Color(0x1affffff) : const Color(0xffe5e7eb),
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => PreviewScreen(html: source, title: title),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: dark
                        ? const Color(0x0fffffff)
                        : const Color(0xfff3f4f6),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Center(
                    child: UiIcon(
                      LucideIcons.fileCode2,
                      size: 21,
                      color: Color(0xff6b7280),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          height: 20 / 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const UiIcon(
                            LucideIcons.codeXml,
                            size: 13,
                            color: Color(0xff9ca3af),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'HTML · ${source.trim().split('\n').length} 行 · 点击打开右侧预览',
                              style: const TextStyle(
                                fontSize: 12,
                                height: 16 / 12,
                                color: Color(0xff9ca3af),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                const SizedBox(
                  width: 32,
                  height: 32,
                  child: Center(
                    child: UiIcon(
                      LucideIcons.panelRightOpen,
                      size: 16,
                      color: Color(0xff9ca3af),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
