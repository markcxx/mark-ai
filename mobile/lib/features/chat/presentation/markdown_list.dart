import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:markdown/markdown.dart' as md;

/// Keeps Web's list-inside indent and 4px item gap independently of paragraph spacing.
class MarkdownListBuilder extends MarkdownElementBuilder {
  final Widget Function(BuildContext, String) render;
  final double fontSize;
  MarkdownListBuilder({required this.render, required this.fontSize});
  @override
  bool isBlockElement() => true;
  @override
  Widget visitElementAfterWithContext(
    BuildContext context,
    md.Element element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) {
    final items =
        element.children
            ?.whereType<md.Element>()
            .where((e) => e.tag == 'li')
            .toList() ??
        [];
    final start = int.tryParse(element.attributes['start'] ?? '') ?? 1;
    return Padding(
      // MarkdownBody contributes another 8px after this custom list block.
      padding: const EdgeInsets.only(left: 8, bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 22,
                    child: Text(
                      element.tag == 'ol' ? '${start + i}.' : '•',
                      style: TextStyle(
                        fontSize: fontSize,
                        height: 1.625,
                        color: Theme.of(context).brightness == Brightness.dark
                            ? const Color(0xffd1d5db)
                            : const Color(0xff374151),
                      ),
                    ),
                  ),
                  Expanded(
                    child: render(
                      context,
                      items[i].children?.map(markdownSource).join() ?? '',
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

// Round-trip Markdown's parsed inline/structural nodes for a list item's renderer.
// Keep link targets, code, emphasis and nested lists; never flatten textContent.
String markdownSource(md.Node node) {
  if (node is md.Text) {
    return node.text.replaceAllMapped(
      RegExp(r'[\\`*_\[\]<>]'),
      (m) => '\\${m[0]}',
    );
  }
  final e = node as md.Element,
      body = (node.children ?? []).map(markdownSource).join();
  switch (e.tag) {
    case 'math-inline':
      return '\\(${e.textContent}\\)';
    case 'math-display':
      return '\n\\[\n${e.textContent}\n\\]\n';
    case 'strong':
      return '**$body**';
    case 'em':
      return '*$body*';
    case 'del':
      return '~~$body~~';
    case 'a':
      return '[$body](<${e.attributes['href'] ?? ''}>)';
    case 'img':
      return '![${e.attributes['alt'] ?? ''}](<${e.attributes['src'] ?? ''}>)';
    case 'code':
      final delimiter =
          '`' *
          (RegExp(r'`+')
                  .allMatches(e.textContent)
                  .fold<int>(
                    0,
                    (longest, m) => m.group(0)!.length > longest
                        ? m.group(0)!.length
                        : longest,
                  ) +
              1);
      return '$delimiter ${e.textContent} $delimiter';
    case 'pre':
      final code = e.children?.whereType<md.Element>().firstOrNull;
      final fence =
          '`' *
          (RegExp(r'`+')
                  .allMatches(e.textContent)
                  .fold<int>(
                    2,
                    (longest, m) => m.group(0)!.length > longest
                        ? m.group(0)!.length
                        : longest,
                  ) +
              1);
      return '\n$fence${(code?.attributes['class'] ?? '').replaceFirst('language-', '')}\n${e.textContent}\n$fence\n\n';
    case 'br':
      return '  \n';
    case 'p':
      return '$body\n\n';
    case 'blockquote':
      return '\n${body.trim().split('\n').map((line) => '> $line').join('\n')}\n\n';
    case 'ul':
    case 'ol':
      final start = int.tryParse(e.attributes['start'] ?? '') ?? 1;
      var index = start;
      return '\n${(e.children ?? []).whereType<md.Element>().where((li) => li.tag == 'li').map((li) {
        final prefix = e.tag == 'ol' ? '${index++}. ' : '- ';
        final lines = (li.children ?? []).map(markdownSource).join().trim().split('\n');
        return '$prefix${lines.first}\n${lines.skip(1).map((line) => '${' ' * prefix.length}$line').join('\n')}';
      }).join('\n')}\n';
    case 'hr':
      return '\n---\n\n';
    case 'input':
      return e.attributes.containsKey('checked') ? '[x] ' : '[ ] ';
    default:
      if (RegExp(r'^h[1-6]$').hasMatch(e.tag)) {
        return '${'#' * int.parse(e.tag[1])} $body\n\n';
      }
      return body;
  }
}
