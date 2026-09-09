import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:markdown/markdown.dart' as md;

import '../../../shared/widgets/common.dart';

class MarkaiTableSyntax extends md.TableSyntax {
  const MarkaiTableSyntax();
  @override
  md.Node parse(md.BlockParser parser) {
    final table = super.parse(parser) as md.Element;
    // flutter_markdown handles the standard table tag before custom builders.
    md.Node customTags(md.Node node) {
      if (node is! md.Element) return node;
      final tag =
          const {'table', 'thead', 'tbody', 'tr', 'th', 'td'}.contains(node.tag)
          ? 'markai-${node.tag}'
          : node.tag;
      return md.Element(tag, node.children?.map(customTags).toList())
        ..attributes.addAll(node.attributes);
    }

    return customTags(table);
  }
}

class MarkdownTableBuilder extends MarkdownElementBuilder {
  final Widget Function(BuildContext, String) render;
  MarkdownTableBuilder({required this.render});
  @override
  bool isBlockElement() => true;
  @override
  Widget? visitElementAfterWithContext(
    BuildContext context,
    md.Element element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) {
    final rows = <List<md.Element>>[];
    void collect(md.Node node) {
      if (node is! md.Element) return;
      if (node.tag == 'markai-tr') {
        rows.add((node.children ?? []).whereType<md.Element>().toList());
      } else {
        for (final child in node.children ?? <md.Node>[]) {
          collect(child);
        }
      }
    }

    collect(element);
    return _MarkdownTable(rows: rows, render: render);
  }
}

String _source(md.Node node) {
  if (node is md.Text) return node.text;
  if (node is! md.Element) return node.textContent;
  final content = (node.children ?? []).map(_source).join();
  return switch (node.tag) {
    'strong' => '**$content**',
    'em' => '*$content*',
    'code' => '`$content`',
    'a' => '[$content](${node.attributes['href']})',
    'br' => '\n',
    'math-inline' => '\$$content\$',
    _ => content,
  };
}

class _MarkdownTable extends StatefulWidget {
  final List<List<md.Element>> rows;
  final Widget Function(BuildContext, String) render;
  const _MarkdownTable({required this.rows, required this.render});
  @override
  State<_MarkdownTable> createState() => _MarkdownTableState();
}

class _MarkdownTableState extends State<_MarkdownTable> {
  bool copied = false;
  Future<void> copy() async {
    final rows = widget.rows
        .map(
          (r) => r
              .map(
                (cell) => cell.textContent
                    .replaceAll('|', r'\|')
                    .replaceAll('\n', '<br>'),
              )
              .toList(),
        )
        .toList();
    if (rows.isEmpty) return;
    final columns = rows.map((r) => r.length).reduce(math.max);
    String line(List<String> row) =>
        '| ${List.generate(columns, (i) => i < row.length ? row[i] : '').join(' | ')} |';
    await Clipboard.setData(
      ClipboardData(
        text: [
          line(rows.first),
          line(List.filled(columns, '---')),
          ...rows.skip(1).map(line),
        ].join('\n'),
      ),
    );
    if (!mounted) return;
    setState(() => copied = true);
    await Future<void>.delayed(const Duration(seconds: 2));
    if (mounted) setState(() => copied = false);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.rows.isEmpty) return const SizedBox.shrink();
    final dark = Theme.of(context).brightness == Brightness.dark;
    final line = dark ? const Color(0x1affffff) : const Color(0xffeeeeee);
    final count = widget.rows.map((r) => r.length).reduce(math.max);
    final widths = List<double>.filled(count, 120);
    for (var row = 0; row < widget.rows.length; row++) {
      for (var column = 0; column < widget.rows[row].length; column++) {
        final painter = TextPainter(
          text: TextSpan(
            text: widget.rows[row][column].textContent,
            style: TextStyle(
              fontFamily: 'Noto Sans SC',
              fontSize: 14,
              fontWeight: row == 0 ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        widths[column] = math.max(
          widths[column],
          (painter.width + 28 + (row == 0 && column == count - 1 ? 32 : 0))
              .clamp(120, 320),
        );
        painter.dispose();
      }
    }
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Table(
              defaultColumnWidth: const FixedColumnWidth(120),
              columnWidths: {
                for (var i = 0; i < count; i++) i: FixedColumnWidth(widths[i]),
              },
              children: [
                for (var index = 0; index < widget.rows.length; index++)
                  TableRow(
                    decoration: BoxDecoration(
                      color: index == 0
                          ? (dark
                                ? const Color(0x08ffffff)
                                : const Color(0x04000000))
                          : null,
                      border: index == widget.rows.length - 1
                          ? null
                          : Border(bottom: BorderSide(color: line)),
                    ),
                    children: [
                      for (var column = 0; column < count; column++)
                        Padding(
                          padding: EdgeInsets.fromLTRB(
                            14,
                            10.5,
                            index == 0 && column == count - 1 ? 46 : 14,
                            10.5,
                          ),
                          child: DefaultTextStyle.merge(
                            style: TextStyle(
                              fontSize: 14,
                              height: 1.6,
                              fontWeight: index == 0
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                            ),
                            child: widget.render(
                              context,
                              column < widget.rows[index].length
                                  ? (index == 0
                                        ? '**${_source(widget.rows[index][column])}**'
                                        : _source(widget.rows[index][column]))
                                  : '',
                            ),
                          ),
                        ),
                    ],
                  ),
              ],
            ),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: ActionIcon(
              copied ? '已复制' : '复制表格',
              copied ? LucideIcons.check : LucideIcons.copy,
              copy,
              compact: true,
              buttonHeight: 28,
              buttonWidth: 28,
              iconSize: 14,
            ),
          ),
        ],
      ),
    );
  }
}
