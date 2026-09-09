import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/models/chat.dart';
import 'code_block.dart';
import 'stream_fade.dart';
import 'admonition.dart';
import 'message_sources.dart';
import 'markdown_list.dart';
import 'math_markdown.dart';
import 'markdown_table.dart';
import '../application/workspace_controller.dart';

class MessageMarkdown extends StatelessWidget {
  final ChatMessage message;
  final WorkspaceController controller;
  final String text;
  final bool reasoning;
  final double? fontSize;
  const MessageMarkdown({
    super.key,
    required this.message,
    required this.controller,
    required this.text,
    this.reasoning = false,
    this.fontSize,
  });
  @override
  Widget build(BuildContext context) =>
      markdown(context, text, reasoning: reasoning, fontSize: fontSize);
  Widget markdown(
    BuildContext context,
    String text, {
    bool reasoning = false,
    double? fontSize,
  }) => StreamFade(
    content: text,
    enabled:
        message.streaming && controller.general['responseAnimation'] == 'fade',
    child: MarkdownBody(
      data: text,
      inlineSyntaxes: [
        MathInlineSyntax(),
        CitationSyntax(
          collectMessageCitations(message)
              .where((c) => c['structured'] == true)
              .map((c) => (c['citationId'] as num).toInt())
              .toSet(),
        ),
      ],
      blockSyntaxes: const [
        MathBlockSyntax(),
        MarkaiTableSyntax(),
        AdmonitionSyntax(),
      ],
      builders: {
        'admonition': AdmonitionBuilder(),
        'citation': CitationBuilder(collectMessageCitations(message)),
        'markai-table': MarkdownTableBuilder(
          render: (context, value) =>
              markdown(context, value, reasoning: reasoning, fontSize: 14),
        ),
        for (final display in [false, true])
          display ? 'math-display' : 'math-inline': MathMarkdownBuilder(
            display: display,
            fontSize: reasoning
                ? 13
                : fontSize ??
                      (controller.general['chatFontSize'] as num).toDouble(),
            color: reasoning
                ? (Theme.of(context).brightness == Brightness.dark
                      ? const Color(0xff9ca3af)
                      : const Color(0xff6b7280))
                : null,
          ),
        for (final tag in ['ul', 'ol'])
          tag: MarkdownListBuilder(
            fontSize: reasoning
                ? 13
                : fontSize ??
                      (controller.general['chatFontSize'] as num).toDouble(),
            render: (context, text) =>
                markdown(context, text, reasoning: reasoning),
          ),
        'pre': CodeBlockBuilder(
          theme: controller.general['codeTheme'] as String,
          colorMode: controller.general['codeColorMode'] as String,
          wrap: controller.general['codeWrap'] == true,
          lineNumbers: controller.general['codeLineNumbers'] != false,
          collapseLines: (controller.general['codeCollapseLines'] as num? ?? 8)
              .toInt(),
        ),
      },
      selectable: !message.streaming,
      styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
        h1: TextStyle(
          fontSize: 24,
          height: 32 / 24,
          fontWeight: FontWeight.w600,
          color: reasoning
              ? (Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xff9ca3af)
                    : const Color(0xff6b7280))
              : Theme.of(context).colorScheme.onSurface,
        ),
        h2: TextStyle(
          fontSize: 20,
          height: 28 / 20,
          fontWeight: FontWeight.w600,
          color: reasoning
              ? (Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xff9ca3af)
                    : const Color(0xff6b7280))
              : Theme.of(context).colorScheme.onSurface,
        ),
        h3: TextStyle(
          fontSize: 18,
          height: 28 / 18,
          fontWeight: FontWeight.w600,
          color: reasoning
              ? (Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xff9ca3af)
                    : const Color(0xff6b7280))
              : Theme.of(context).colorScheme.onSurface,
        ),
        h1Padding: const EdgeInsets.only(top: 8),
        h2Padding: const EdgeInsets.only(top: 8),
        h3Padding: const EdgeInsets.only(top: 8),
        blockquotePadding: const EdgeInsets.symmetric(horizontal: 16),
        blockquote: TextStyle(
          fontSize:
              fontSize ??
              (controller.general['chatFontSize'] as num).toDouble(),
          height: 1.625,
          color: Theme.of(context).brightness == Brightness.dark
              ? const Color(0xff9ca3af)
              : const Color(0xff6b7280),
        ),
        blockquoteDecoration: BoxDecoration(
          border: Border(
            left: BorderSide(
              width: 4,
              color: Theme.of(context).brightness == Brightness.dark
                  ? const Color(0xff4b5563)
                  : const Color(0xffd1d5db),
            ),
          ),
        ),
        p: Theme.of(context).textTheme.bodyMedium?.copyWith(
          fontSize: reasoning
              ? 13
              : fontSize ??
                    (controller.general['chatFontSize'] as num).toDouble(),
          height: 1.625,
          color: reasoning
              ? (Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xff9ca3af)
                    : const Color(0xff6b7280))
              : null,
        ),
        blockSpacing: 16,
        listIndent: 8,
        listBulletPadding: const EdgeInsets.only(right: 10),
        listBullet: TextStyle(
          fontSize: (controller.general['chatFontSize'] as num).toDouble(),
          height: 1.625,
        ),
        code: const TextStyle(fontFamily: 'monospace', fontSize: 13),
        codeblockPadding: EdgeInsets.zero,
        codeblockDecoration: const BoxDecoration(),
      ),
      onTapLink: (_, url, _) {
        final uri = Uri.tryParse(url ?? '');
        if (uri != null && ['https', 'http'].contains(uri.scheme)) {
          launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      },
    ),
  );
}
