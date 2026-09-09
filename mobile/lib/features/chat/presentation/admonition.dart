import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:markdown/markdown.dart' as md;

class AdmonitionSyntax extends md.BlockSyntax {
  const AdmonitionSyntax();
  @override
  RegExp get pattern =>
      RegExp(r'^\[!(TIP|NOTE|WARNING|IMPORTANT|CAUTION)\]\s*(.*)$');
  @override
  md.Node parse(md.BlockParser parser) {
    final match = pattern.firstMatch(parser.current.content)!;
    final lines = [match[2]!];
    parser.advance();
    while (!parser.isDone && parser.current.content.trim().isNotEmpty) {
      lines.add(parser.current.content);
      parser.advance();
    }
    final text = md.Document()
        .parseLines(lines)
        .map((node) => node.textContent)
        .join('\n')
        .trim();
    return md.Element.text('admonition', text)..attributes['kind'] = match[1]!;
  }
}

class AdmonitionBuilder extends MarkdownElementBuilder {
  @override
  bool isBlockElement() => true;
  @override
  Widget visitElementAfterWithContext(
    BuildContext context,
    md.Element element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        element.attributes['kind']!,
        style: TextStyle(
          fontSize: 12,
          height: 16 / 12,
          fontWeight: FontWeight.bold,
          letterSpacing: .6,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
      const SizedBox(height: 4),
      Text(element.textContent, style: preferredStyle ?? parentStyle),
    ],
  );
}
