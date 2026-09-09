import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:markdown/markdown.dart' as md;
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/ui_icon.dart';
import '../../../shared/widgets/source_favicon.dart';

List<Json> collectMessageCitations(ChatMessage message) {
  final segments = message.segments
      .where((s) => s['type'] == 'tool')
      .map((s) => jsonMap(s['webSearch']))
      .toList();
  final results =
      (segments.isEmpty ? jsonList(message.data['webSearch']) : segments)
          .expand((s) => jsonList(s['results']))
          .toList();
  var next =
      results.fold<int>(
        0,
        (max, r) => math.max(max, (r['citationId'] as num? ?? 0).toInt()),
      ) +
      1;
  final byUrl = <String, Json>{};
  for (final result in results) {
    final url = (result['url'] as String? ?? '').trim();
    if (url.isEmpty) continue;
    final old = byUrl[url] ?? <String, dynamic>{};
    final structured = (result['citationId'] as num? ?? 0) > 0;
    byUrl[url] = {
      ...old,
      ...result,
      'url': url,
      'citationId': structured
          ? result['citationId']
          : old['citationId'] ?? next++,
      'structured': structured || old['structured'] == true,
      for (final key in ['content', 'favicon', 'publishedDate'])
        key: (result[key] as String?)?.isNotEmpty == true
            ? result[key]
            : old[key],
    };
  }
  return byUrl.values.toList()..sort(
    (a, b) => (a['citationId'] as num).compareTo(b['citationId'] as num),
  );
}

class CitationSyntax extends md.InlineSyntax {
  final Set<int> ids;
  CitationSyntax(this.ids)
    : super(ids.isEmpty ? r'(?!)' : r'\[(' + ids.join('|') + r')\](?![\[(])');
  @override
  bool onMatch(md.InlineParser parser, Match match) {
    parser.addNode(md.Element.text('citation', match[1]!));
    return true;
  }
}

class CitationBuilder extends MarkdownElementBuilder {
  final List<Json> citations;
  CitationBuilder(this.citations);
  @override
  Widget? visitElementAfterWithContext(
    BuildContext context,
    md.Element element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) {
    final citation = citations
        .where((c) => '${c['citationId']}' == element.textContent)
        .firstOrNull;
    if (citation == null) return Text('[${element.textContent}]');
    final primary = Theme.of(context).colorScheme.primary;
    return SourcePopover(
      citation: citation,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 2),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        constraints: const BoxConstraints(minWidth: 20),
        decoration: BoxDecoration(
          color: primary.withValues(alpha: .1),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          element.textContent,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Plus Jakarta Sans',
            fontSize: 11,
            height: 16 / 11,
            fontWeight: FontWeight.w600,
            color: primary,
          ),
        ),
      ),
    );
  }
}

String sourceDomain(Json citation) =>
    (Uri.tryParse(citation['url'] as String? ?? '')?.host ?? '').replaceFirst(
      RegExp(r'^www\.'),
      '',
    );

class SourcePopover extends StatelessWidget {
  final Json citation;
  final Widget child;
  const SourcePopover({super.key, required this.citation, required this.child});
  Future<void> open(BuildContext context) async {
    final box = context.findRenderObject() as RenderBox;
    final anchor = box.localToGlobal(Offset.zero) & box.size;
    await showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: '关闭来源预览',
      barrierColor: Colors.transparent,
      transitionDuration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 150),
      transitionBuilder: (_, animation, _, child) => FadeTransition(
        opacity: animation,
        child: ScaleTransition(
          scale: Tween(begin: .96, end: 1.0).animate(animation),
          child: child,
        ),
      ),
      pageBuilder: (context, _, _) {
        final media = MediaQuery.of(context),
            dark = Theme.of(context).brightness == Brightness.dark;
        final width = math.min(364.0, media.size.width - 24),
            above = anchor.top - media.padding.top > 245;
        final muted = dark ? const Color(0xff9ca3af) : const Color(0xff6b7280);
        final border = dark ? const Color(0x26ffffff) : const Color(0xffe5e7eb);
        final published = DateTime.tryParse(
          citation['publishedDate'] as String? ?? '',
        );
        return Stack(
          children: [
            Positioned(
              left: (anchor.center.dx - width / 2)
                  .clamp(12, math.max(12, media.size.width - width - 12))
                  .toDouble(),
              width: width,
              bottom: above ? media.size.height - anchor.top + 8 : null,
              top: above
                  ? null
                  : (anchor.bottom + 8)
                        .clamp(
                          media.padding.top + 12,
                          math.max(
                            media.padding.top + 12,
                            media.size.height - media.viewInsets.bottom - 260,
                          ),
                        )
                        .toDouble(),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Material(
                    color: dark ? const Color(0xff202020) : Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: border),
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        color: dark ? const Color(0xff202020) : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x2e0f172a),
                            offset: Offset(0, 16),
                            blurRadius: 48,
                          ),
                        ],
                      ),
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              SourceFavicon(citation: citation, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  sourceDomain(citation),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12, color: muted),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: dark
                                      ? const Color(0x12ffffff)
                                      : const Color(0xfff3f4f6),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  '${citation['citationId'] ?? ''}',
                                  style: TextStyle(fontSize: 10, color: muted),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${citation['title'] ?? citation['url']}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14,
                              height: 20 / 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if ((citation['content'] as String? ?? '')
                              .isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              citation['content'] as String,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12,
                                height: 20 / 12,
                                color: muted,
                              ),
                            ),
                          ],
                          Container(
                            margin: const EdgeInsets.only(top: 12),
                            padding: const EdgeInsets.only(top: 8),
                            decoration: BoxDecoration(
                              border: Border(top: BorderSide(color: border)),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    published == null
                                        ? '${citation['url']}'
                                        : '${published.year}年${published.month}月${published.day}日',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: muted,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                TextButton(
                                  style: TextButton.styleFrom(
                                    minimumSize: Size.zero,
                                    padding: EdgeInsets.zero,
                                    tapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                  ),
                                  onPressed: () {
                                    final uri = Uri.tryParse(
                                      citation['url'] as String? ?? '',
                                    );
                                    if (uri != null &&
                                        [
                                          'http',
                                          'https',
                                        ].contains(uri.scheme)) {
                                      launchUrl(
                                        uri,
                                        mode: LaunchMode.externalApplication,
                                      );
                                    }
                                  },
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        '打开来源',
                                        style: TextStyle(fontSize: 12),
                                      ),
                                      SizedBox(width: 4),
                                      UiIcon(
                                        LucideIcons.externalLink,
                                        size: 12,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    left:
                        (anchor.center.dx -
                                (anchor.center.dx - width / 2).clamp(
                                  12,
                                  math.max(12, media.size.width - width - 12),
                                ) -
                                4)
                            .clamp(12, width - 20),
                    bottom: above ? -4 : null,
                    top: above ? null : -4,
                    child: Transform.rotate(
                      angle: math.pi / 4,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: dark ? const Color(0xff202020) : Colors.white,
                          border: Border(
                            right: above
                                ? BorderSide(color: border)
                                : BorderSide.none,
                            bottom: above
                                ? BorderSide(color: border)
                                : BorderSide.none,
                            left: above
                                ? BorderSide.none
                                : BorderSide(color: border),
                            top: above
                                ? BorderSide.none
                                : BorderSide(color: border),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) => Builder(
    builder: (context) => Semantics(
      button: true,
      label: '查看来源 ${citation['citationId'] ?? ''}：${citation['title'] ?? ''}',
      child: InkWell(
        onTap: () => open(context),
        borderRadius: BorderRadius.circular(6),
        child: child,
      ),
    ),
  );
}

class MessageSources extends StatefulWidget {
  final List<Json> citations;
  const MessageSources({super.key, required this.citations});
  @override
  State<MessageSources> createState() => _MessageSourcesState();
}

class _MessageSourcesState extends State<MessageSources> {
  bool expanded = false;
  @override
  Widget build(BuildContext context) {
    if (widget.citations.isEmpty) return const SizedBox.shrink();
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.only(top: 16),
      decoration: BoxDecoration(
        color: dark ? const Color(0x06ffffff) : const Color(0xb3f9fafb),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: dark ? const Color(0x14ffffff) : const Color(0xcce5e7eb),
        ),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => expanded = !expanded),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  const UiIcon(
                    LucideIcons.globe,
                    size: 15,
                    color: Color(0xff9ca3af),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${widget.citations.length} 个来源',
                    style: const TextStyle(
                      fontSize: 12,
                      height: 16 / 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SizedBox(
                      height: 24,
                      child: Stack(
                        children: [
                          for (final entry in widget.citations.take(8).indexed)
                            Positioned(
                              left: entry.$1 * 14,
                              top: 3,
                              child: SourceFavicon(
                                citation: entry.$2,
                                size: 18,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  AnimatedRotation(
                    turns: expanded ? -.25 : 0,
                    duration: MediaQuery.disableAnimationsOf(context)
                        ? Duration.zero
                        : const Duration(milliseconds: 200),
                    child: const UiIcon(
                      LucideIcons.chevronRight,
                      size: 15,
                      color: Color(0xff9ca3af),
                    ),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: MediaQuery.disableAnimationsOf(context)
                ? Duration.zero
                : const Duration(milliseconds: 200),
            alignment: Alignment.topLeft,
            child: expanded
                ? Container(
                    decoration: BoxDecoration(
                      border: Border(
                        top: BorderSide(
                          color: dark
                              ? const Color(0x12ffffff)
                              : const Color(0xb3e5e7eb),
                        ),
                      ),
                    ),
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      children: [
                        for (final entry in widget.citations.indexed)
                          Padding(
                            padding: EdgeInsets.only(
                              bottom: entry.$1 == widget.citations.length - 1
                                  ? 0
                                  : 8,
                            ),
                            child: SourcePopover(
                              citation: entry.$2,
                              child: Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: dark
                                      ? const Color(0x09ffffff)
                                      : Colors.white,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    SourceFavicon(citation: entry.$2),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${entry.$2['title'] ?? entry.$2['url']}',
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontSize: 12,
                                              height: 16 / 12,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            '${entry.$2['citationId']} · ${sourceDomain(entry.$2)}',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: Color(0xff9ca3af),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}
