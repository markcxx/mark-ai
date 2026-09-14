import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:markdown/markdown.dart' as md;

import 'dart:async';
import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/ui_icon.dart';
import '../../../shared/models/chat.dart';
import '../../../shared/models/code_themes.dart';
import 'code_highlighter.dart';
import 'stream_fade.dart';
import '../../previews/html_preview_card.dart';
import '../../previews/artifact_card.dart';

class CodeBlockBuilder extends MarkdownElementBuilder {
  final int collapseLines;
  final String theme, colorMode;
  final bool wrap, lineNumbers;
  CodeBlockBuilder({
    this.collapseLines = 8,
    this.theme = 'one',
    this.colorMode = 'auto',
    this.wrap = false,
    this.lineNumbers = true,
  });
  @override
  bool isBlockElement() => true;
  @override
  Widget? visitElementAfter(md.Element element, TextStyle? preferredStyle) {
    final child = element.children?.firstOrNull;
    final language = child is md.Element
        ? (child.attributes['class'] ?? '').replaceFirst('language-', '')
        : '';
    if (language == 'html' || language == 'htm') {
      return StreamFadeExclusion(
        child: HtmlPreviewCard(source: element.textContent),
      );
    }
    final kind = artifactKind(language);
    if (kind != null) {
      return StreamFadeExclusion(
        child: ArtifactCard(kind: kind, source: element.textContent),
      );
    }
    return StreamFadeExclusion(
      child: CodeBlock(
        code: element.textContent,
        language: language,
        collapseLines: collapseLines,
        theme: theme,
        colorMode: colorMode,
        wrap: wrap,
        lineNumbers: lineNumbers,
      ),
    );
  }
}

class CodeBlock extends StatefulWidget {
  final String code, language;
  final int collapseLines;
  final String theme, colorMode;
  final bool wrap, lineNumbers;
  const CodeBlock({
    super.key,
    required this.code,
    required this.language,
    required this.collapseLines,
    this.theme = 'one',
    this.colorMode = 'auto',
    this.wrap = false,
    this.lineNumbers = true,
  });
  @override
  State<CodeBlock> createState() => _CodeBlockState();
}

class _CodeBlockState extends State<CodeBlock> {
  bool collapsed = false, copied = false;
  late bool wrap = widget.wrap;
  Timer? copyTimer, parseTimer;
  List<Json> tokens = [];
  int revision = 0;
  String? highlightedTheme, highlightedLanguage;
  String get resolvedTheme => resolveCodeTheme(
    widget.theme,
    widget.colorMode == 'dark' ||
        widget.colorMode == 'auto' &&
            Theme.of(context).brightness == Brightness.dark,
  );
  String get language => widget.language.trim().isEmpty
      ? 'txt'
      : widget.language.trim().toLowerCase();
  String get code => widget.code.replaceFirst(RegExp(r'\n$'), '');
  @override
  void initState() {
    super.initState();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    scheduleParse();
  }

  void scheduleParse() {
    // Do not reset the timer on every streamed chunk: process the latest revision.
    parseTimer ??= Timer(const Duration(milliseconds: 100), () {
      parseTimer = null;
      parse();
    });
  }

  @override
  void didUpdateWidget(covariant CodeBlock oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.code != widget.code ||
        oldWidget.language != widget.language ||
        oldWidget.theme != widget.theme ||
        oldWidget.colorMode != widget.colorMode) {
      scheduleParse();
    }
  }

  void parse() async {
    final current = ++revision,
        source = code,
        theme = resolvedTheme,
        lang = language;
    try {
      final result = await CodeHighlighter.highlight(source, lang, theme);
      if (mounted &&
          current == revision &&
          source == code &&
          theme == resolvedTheme &&
          lang == language) {
        setState(() {
          tokens = jsonList(result['tokens']);
          highlightedTheme = theme;
          highlightedLanguage = lang;
        });
      }
    } catch (_) {
      if (mounted && current == revision) {
        setState(
          () => tokens = [
            {'text': source, 'classes': []},
          ],
        );
      }
    }
  }

  @override
  void dispose() {
    copyTimer?.cancel();
    parseTimer?.cancel();
    super.dispose();
  }

  // Shiki emits CSS hex colors; preserve alpha when a theme supplies it.
  Color? color(dynamic value) {
    if (value is! String || !value.startsWith('#')) return null;
    var hex = value.substring(1);
    if (hex.length == 3 || hex.length == 4) {
      hex = hex.split('').map((c) => '$c$c').join();
    }
    final number = int.tryParse(hex, radix: 16);
    if (number == null) return null;
    if (hex.length == 6) return Color(0xff000000 | number);
    if (hex.length == 8) return Color((number >> 8) | ((number & 0xff) << 24));
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final dark =
        widget.colorMode == 'dark' ||
        widget.colorMode == 'auto' &&
            Theme.of(context).brightness == Brightness.dark;
    final base = codeThemeColors[resolvedTheme] ?? const <String, String>{};
    final lines = <List<InlineSpan>>[[]];
    for (final token
        in highlightedTheme != resolvedTheme ||
                highlightedLanguage != language ||
                tokens.isEmpty ||
                tokens.map((t) => t['text']).join() != code
            ? [
                {'text': code},
              ]
            : tokens) {
      final flags = (token['fontStyle'] as num?)?.toInt() ?? 0;
      final style = TextStyle(
        color: color(token['color']),
        fontWeight: flags & 2 != 0 ? FontWeight.bold : null,
        fontStyle: flags & 1 != 0 ? FontStyle.italic : null,
        decoration: flags & 4 != 0 ? TextDecoration.underline : null,
      );
      final parts = (token['text'] as String).split('\n');
      for (var i = 0; i < parts.length; i++) {
        if (i > 0) lines.add([]);
        lines.last.add(TextSpan(text: parts[i], style: style));
      }
    }
    final collapsible =
        widget.collapseLines > 0 &&
        code.split('\n').length > widget.collapseLines;
    final foreground = dark ? const Color(0xff9ca3af) : const Color(0xff6b7280);
    Widget action(
      String label,
      IconData icon,
      VoidCallback callback, {
      Color? active,
    }) => SizedBox(
      width: 27,
      height: 27,
      child: IconButton(
        tooltip: label,
        onPressed: callback,
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints.tightFor(width: 27, height: 27),
        style: IconButton.styleFrom(
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        icon: UiIcon(icon, size: 14, color: active ?? foreground),
      ),
    );
    Widget content() => SelectionArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < lines.length; i++)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: wrap ? MainAxisSize.max : MainAxisSize.min,
              children: [
                if (widget.lineNumbers)
                  SelectionContainer.disabled(
                    child: SizedBox(
                      width: 32.5,
                      child: Padding(
                        padding: const EdgeInsets.only(right: 13),
                        child: Text(
                          '${i + 1}',
                          textAlign: TextAlign.right,
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 13,
                            height: 1.5,
                            color: dark
                                ? const Color(0xff6e7681)
                                : const Color(0xff94a3b8),
                          ),
                        ),
                      ),
                    ),
                  ),
                if (wrap)
                  Expanded(
                    child: Text.rich(
                      TextSpan(children: lines[i]),
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 13,
                        height: 1.5,
                        letterSpacing: 0,
                        color: color(base['fg']) ?? foreground,
                      ),
                    ),
                  )
                else
                  Text.rich(
                    TextSpan(children: lines[i]),
                    softWrap: false,
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 13,
                      height: 1.5,
                      letterSpacing: 0,
                      color: color(base['fg']) ?? foreground,
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 20),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: dark ? const Color(0xff0d1117) : const Color(0xfff8f9fa),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: dark ? const Color(0x1affffff) : const Color(0xffe5e7eb),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Material(
            color: dark ? const Color(0xff161b22) : const Color(0xccffffff),
            child: InkWell(
              onTap: collapsible
                  ? () => setState(() => collapsed = !collapsed)
                  : null,
              child: Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  border: collapsed
                      ? null
                      : Border(
                          bottom: BorderSide(
                            color: dark
                                ? const Color(0x1affffff)
                                : const Color(0xcce5e7eb),
                          ),
                        ),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: dark
                            ? const Color(0x0fffffff)
                            : const Color(0xfff3f4f6),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        language.toUpperCase(),
                        style: TextStyle(
                          fontFamily: 'Plus Jakarta Sans',
                          fontSize: 12,
                          height: 16 / 12,
                          fontWeight: FontWeight.w500,
                          color: foreground,
                        ),
                      ),
                    ),
                    const Spacer(),
                    if (collapsible) ...[
                      action(
                        collapsed ? '展开代码' : '折叠代码',
                        collapsed
                            ? LucideIcons.chevronDown
                            : LucideIcons.chevronUp,
                        () => setState(() => collapsed = !collapsed),
                      ),
                      const SizedBox(width: 4),
                    ],
                    action(
                      wrap ? '关闭自动换行' : '开启自动换行',
                      LucideIcons.wrapText,
                      () => setState(() => wrap = !wrap),
                      active: wrap
                          ? Theme.of(context).colorScheme.primary
                          : null,
                    ),
                    const SizedBox(width: 4),
                    action('下载代码', LucideIcons.download, () async {
                      const extensions = {
                        'bash': 'sh',
                        'shell': 'sh',
                        'csharp': 'cs',
                        'javascript': 'js',
                        'python': 'py',
                        'typescript': 'ts',
                        'markdown': 'md',
                        'yaml': 'yaml',
                      };
                      await FilePicker.saveFile(
                        fileName: 'code.${extensions[language] ?? language}',
                        bytes: Uint8List.fromList(utf8.encode(widget.code)),
                        mimeType: 'text/plain',
                      );
                    }),
                    const SizedBox(width: 4),
                    action(
                      '复制代码',
                      copied ? LucideIcons.check : LucideIcons.copy,
                      () {
                        Clipboard.setData(ClipboardData(text: widget.code));
                        setState(() => copied = true);
                        copyTimer?.cancel();
                        copyTimer = Timer(const Duration(seconds: 2), () {
                          if (mounted) setState(() => copied = false);
                        });
                      },
                      active: copied ? const Color(0xff16a34a) : null,
                    ),
                  ],
                ),
              ),
            ),
          ),
          ClipRect(
            child: AnimatedAlign(
              alignment: Alignment.topCenter,
              heightFactor: collapsed ? 0 : 1,
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 200),
              curve: Curves.easeOut,
              child: Container(
                width: double.infinity,
                color: color(base['bg']),
                child: wrap
                    ? Padding(
                        padding: const EdgeInsets.all(16),
                        child: content(),
                      )
                    : SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.all(16),
                        child: content(),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
