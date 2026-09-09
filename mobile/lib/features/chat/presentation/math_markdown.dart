import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:markdown/markdown.dart' as md;

class MathInlineSyntax extends md.InlineSyntax {
  MathInlineSyntax()
    : super(
        r'\$\$([^\$]+?)\$\$|\$([^\$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]',
      );
  @override
  bool onMatch(md.InlineParser parser, Match match) {
    final element = md.Element.text(
      'math-inline',
      match.group(1) ??
          match.group(2) ??
          match.group(3) ??
          match.group(4) ??
          '',
    );
    parser.addNode(element);
    return true;
  }
}

class MathBlockSyntax extends md.BlockSyntax {
  const MathBlockSyntax();
  @override
  RegExp get pattern => RegExp(r'^ {0,3}(\$\$|\\\[)');
  @override
  bool canParse(md.BlockParser parser) {
    if (!super.canParse(parser)) return false;
    final line = parser.current.content.trimLeft();
    final closing = line.startsWith(r'$$') ? r'$$' : r'\]';
    final end = line.indexOf(closing, 2);
    return end < 0 || line.substring(end + 2).trim().isEmpty;
  }

  @override
  md.Node parse(md.BlockParser parser) {
    final line = parser.current.content.trimLeft();
    final closing = line.startsWith(r'$$') ? r'$$' : r'\]';
    var rest = line.substring(2);
    final parts = <String>[];
    while (true) {
      final end = rest.indexOf(closing);
      if (end >= 0) {
        parts.add(rest.substring(0, end));
        parser.advance();
        break;
      }
      parts.add(rest);
      parser.advance();
      if (parser.isDone) break;
      rest = parser.current.content;
    }
    return md.Element.text('math-display', parts.join('\n').trim());
  }
}

class MathMarkdownBuilder extends MarkdownElementBuilder {
  final bool display;
  final double fontSize;
  final Color? color;
  MathMarkdownBuilder({
    required this.display,
    required this.fontSize,
    this.color,
  });
  @override
  bool isBlockElement() => display;
  @override
  Widget? visitElementAfterWithContext(
    BuildContext context,
    md.Element element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) {
    final formula = Math.tex(
      element.textContent,
      mathStyle: display ? MathStyle.display : MathStyle.text,
      textStyle: TextStyle(
        fontSize: fontSize * 1.21,
        color: color ?? Theme.of(context).colorScheme.onSurface,
      ),
      onErrorFallback: (_) => Text(
        element.textContent,
        style: TextStyle(fontSize: fontSize, color: color),
      ),
    );
    if (!display) return formula;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: fontSize * 1.35),
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: ConstrainedBox(
            constraints: BoxConstraints(minWidth: constraints.maxWidth),
            child: Center(child: formula),
          ),
        ),
      ),
    );
  }
}
