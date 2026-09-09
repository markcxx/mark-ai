import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/ui_icon.dart';
import '../../../shared/widgets/source_favicon.dart';
import 'message_sources.dart';

/// Native counterpart of WebSearchToolBlock and GeneratedFileToolBlock.
class ToolCallBlock extends StatefulWidget {
  final Json data;
  final bool generatedFile;
  final Future<void> Function(Json)? download, preview;
  final String? toolLabel;
  const ToolCallBlock({
    super.key,
    required this.data,
    this.generatedFile = false,
    this.download,
    this.preview,
    this.toolLabel,
  });
  @override
  State<ToolCallBlock> createState() => _ToolCallBlockState();
}

class _ToolCallBlockState extends State<ToolCallBlock> {
  bool expanded = false;
  Json get data => widget.data;
  bool get failed => data['status'] == 'error';
  bool get running =>
      data['status'] == 'running' || data['status'] == 'searching';
  bool get readPage => data['tool'] == 'read_webpage';
  static const wordLabels = {
    'word_document_append': '正在构建下一个章节',
    'word_document_begin': '正在规划文档结构',
    'word_document_finalize': '正在打包 Word 文档',
    'word_document_inspect': '正在检查文档结构与格式',
    'word_document_open': '正在打开上一份可编辑 Word',
    'word_document_restyle': '正在修改整份文档的样式',
    'word_document_revise': '正在修改文档内容或格式',
  };
  late bool dark;
  Color get muted => dark ? const Color(0xff9ca3af) : const Color(0xff6b7280);
  Color get line => dark ? const Color(0x14ffffff) : const Color(0xfff3f4f6);
  Widget text(
    String value, {
    double size = 12,
    Color? color,
    FontWeight? weight,
    bool mono = false,
    int? lines,
  }) => Text(
    value,
    maxLines: lines,
    overflow: lines == null ? null : TextOverflow.ellipsis,
    style: TextStyle(
      fontSize: size,
      height: size == 13
          ? 1.625
          : size == 14
          ? 20 / 14
          : 16 / size,
      color: color ?? muted,
      fontWeight: weight,
      fontFamily: mono ? 'monospace' : null,
    ),
  );
  @override
  Widget build(BuildContext context) {
    dark = Theme.of(context).brightness == Brightness.dark;
    final label = widget.generatedFile
        ? widget.toolLabel ?? '文件生成'
        : readPage
        ? '网页读取'
        : '联网搜索';
    final progress = jsonMap(data['progress']);
    final title = running
        ? (widget.generatedFile ? wordLabels[data['toolName']] : null) ??
              '正在调用$label'
        : failed
        ? '$label调用失败'
        : (widget.generatedFile ? progress['label'] as String? : null) ??
              '已调用$label';
    final primary = Theme.of(context).colorScheme.primary;
    final statusColor = failed
        ? (dark ? const Color(0xfffca5a5) : const Color(0xffdc2626))
        : running && !widget.generatedFile
        ? (dark ? const Color(0xffbae6fd) : const Color(0xff0369a1))
        : primary;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: dark ? const Color(0x06ffffff) : Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: dark
              ? Color(expanded ? 0x26ffffff : 0x1affffff)
              : expanded
              ? const Color(0xffd1d5db)
              : const Color(0xffe5e7eb),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            expanded: expanded,
            child: InkWell(
              onTap: () => setState(() => expanded = !expanded),
              child: SizedBox(
                height: 36,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Row(
                    children: [
                      Container(
                        width: 20,
                        height: 20,
                        decoration: BoxDecoration(
                          color: failed
                              ? (dark
                                    ? const Color(0x1aef4444)
                                    : const Color(0xfffef2f2))
                              : running && !widget.generatedFile
                              ? (dark
                                    ? const Color(0x260ea5e9)
                                    : const Color(0xfff0f9ff))
                              : primary.withValues(alpha: .1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Center(
                          child: running
                              ? ToolSpinner(size: 12, color: statusColor)
                              : UiIcon(
                                  failed
                                      ? LucideIcons.x
                                      : widget.generatedFile
                                      ? LucideIcons.fileOutput
                                      : LucideIcons.globe,
                                  size: 12,
                                  color: statusColor,
                                ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: text(
                          title,
                          color: failed
                              ? statusColor
                              : dark
                              ? const Color(0xffd1d5db)
                              : const Color(0xff4b5563),
                          weight: FontWeight.w500,
                          lines: 1,
                        ),
                      ),
                      const SizedBox(width: 8),
                      AnimatedRotation(
                        turns: expanded ? -.25 : 0,
                        duration: MediaQuery.disableAnimationsOf(context)
                            ? Duration.zero
                            : const Duration(milliseconds: 200),
                        child: const UiIcon(
                          LucideIcons.chevronRight,
                          size: 14,
                          color: Color(0xff9ca3af),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          if (expanded)
            Container(
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: line)),
              ),
              child: widget.generatedFile
                  ? fileBody(progress)
                  : searchBody(label),
            ),
        ],
      ),
    );
  }

  Widget errorBox(String fallback) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    decoration: BoxDecoration(
      color: dark ? const Color(0x1aef4444) : const Color(0xfffef2f2),
      border: Border.all(
        color: dark ? const Color(0x33f87171) : const Color(0xfffee2e2),
      ),
      borderRadius: BorderRadius.circular(8),
    ),
    child: text(
      data['error'] as String? ?? fallback,
      size: 14,
      color: dark ? const Color(0xfffca5a5) : const Color(0xffb91c1c),
    ),
  );

  Widget excerpt(String content, double height) => Container(
    margin: const EdgeInsets.only(top: 4, bottom: 4),
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    constraints: BoxConstraints(maxHeight: height),
    decoration: BoxDecoration(
      color: dark ? const Color(0x0affffff) : const Color(0xfff9fafb),
      borderRadius: BorderRadius.circular(6),
    ),
    child: SingleChildScrollView(child: text(content, size: 13)),
  );

  Widget searchBody(String label) {
    final results = jsonList(data['results']);
    final cost = (data['costTime'] as num? ?? 0) / 1000;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              text(
                readPage ? 'read_webpage' : 'web_search',
                size: 11,
                mono: true,
                color: const Color(0xff9ca3af),
              ),
              Container(
                width: 1,
                height: 12,
                margin: const EdgeInsets.symmetric(horizontal: 8),
                color: line,
              ),
              text(
                readPage ? 'url:' : 'query:',
                size: 11,
                mono: true,
                color: const Color(0xff9ca3af),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: text(
                  '${readPage ? data['url'] ?? data['query'] ?? '—' : data['query'] ?? '—'}',
                  mono: true,
                  lines: 1,
                ),
              ),
              if (data['status'] == 'done') ...[
                const SizedBox(width: 8),
                text(
                  '${readPage ? '已读取' : '${results.length} 个结果'}${cost > 0 ? ' · ${cost.toStringAsFixed(1)}s' : ''}',
                  size: 11,
                ),
              ],
            ],
          ),
        ),
        if (running)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Column(
              children: [
                Row(
                  children: [
                    UiIcon(LucideIcons.globe, size: 14, color: muted),
                    const SizedBox(width: 8),
                    Expanded(
                      child: text(
                        readPage ? '正在读取网页、提取正文和页面信息...' : '正在检索网页、整理摘要和来源...',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 86,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: 4,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (_, _) => Container(
                      width: 172,
                      decoration: BoxDecoration(
                        color: dark
                            ? const Color(0x0dffffff)
                            : const Color(0xfff9fafb),
                        border: Border.all(color: line),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final width in [118.0, 98.0, 74.0])
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Container(
                                width: width,
                                height: 12,
                                color: dark
                                    ? const Color(0x1affffff)
                                    : const Color(0xffe5e7eb),
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
        else if (failed)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                errorBox(readPage ? '网页读取服务暂时不可用' : '搜索服务暂时不可用'),
                const SizedBox(height: 8),
                text('已跳过$label结果，继续使用当前模型回复。'),
              ],
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (data['answer'] is String)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: excerpt(data['answer'] as String, 120),
                  ),
                for (final entry in results.take(readPage ? 1 : 8).indexed)
                  resultRow(
                    {...entry.$2, 'citationId': entry.$2['citationId'] ?? entry.$1 + 1},
                    last: entry.$1 == results.take(readPage ? 1 : 8).length - 1,
                  ),
                if (readPage && results.isEmpty && data['url'] is String)
                  resultRow({
                    'url': data['url'],
                    'title': data['title'] ?? data['url'],
                    'content': data['description'] ?? '',
                  }, last: true),
                if (readPage && data['content'] is String)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: excerpt(
                      (data['content'] as String).length > 2400
                          ? '${(data['content'] as String).substring(0, 2400)}\n\n...'
                          : data['content'] as String,
                      220,
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  Widget resultRow(Json result, {bool last = false}) => SourcePopover(
    citation: result,
    child: Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        border: last ? null : Border(bottom: BorderSide(color: line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SourceFavicon(citation: result),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                text(
                  result['title'] as String? ?? '',
                  size: 13,
                  weight: FontWeight.w500,
                  color: dark
                      ? const Color(0xfff3f4f6)
                      : const Color(0xff111827),
                  lines: 1,
                ),
                const SizedBox(height: 2),
                text(
                  result['url'] as String? ?? '',
                  color: const Color(0xff9ca3af),
                  lines: 1,
                ),
                if (result['content'] is String) ...[
                  const SizedBox(height: 2),
                  Text(
                    result['content'] as String,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, height: 1.625, color: muted),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    ),
  );

  Widget fileBody(Json progress) {
    final file = jsonMap(data['file']);
    final current = progress['current'] as num? ?? 0,
        total = progress['total'] as num? ?? 0;
    final size = file['size'] as num? ?? 0;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              text(data['toolName'] as String? ?? '', size: 11, mono: true),
              if (file.isNotEmpty) ...[
                Container(
                  width: 1,
                  height: 12,
                  margin: const EdgeInsets.symmetric(horizontal: 8),
                  color: line,
                ),
                Expanded(child: text(file['name'] as String? ?? '', lines: 1)),
                const SizedBox(width: 8),
                text(
                  size < 1048576
                      ? '${(size / 1024).ceil().clamp(1, 1024)} KB'
                      : '${(size / 1048576).toStringAsFixed(1)} MB',
                  size: 11,
                ),
              ],
            ],
          ),
          if (progress.isNotEmpty && !failed) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: text(
                    '${progress['detail'] ?? progress['label'] ?? ''}',
                    size: 11,
                  ),
                ),
                const SizedBox(width: 12),
                text('$current/$total', size: 11),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(100),
              child: LinearProgressIndicator(
                minHeight: 6,
                value: (total > 0 ? current / total : 0.0).clamp(
                  progress['phase'] == 'plan' ? .04 : 0,
                  1,
                ),
                color: Theme.of(context).colorScheme.primary,
                backgroundColor: line,
              ),
            ),
          ],
          if (running) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                ToolSpinner(size: 13, color: muted),
                const SizedBox(width: 8),
                Expanded(
                  child: text(wordLabels[data['toolName']] ?? '正在执行，请稍候…'),
                ),
              ],
            ),
          ],
          if (failed) ...[const SizedBox(height: 8), errorBox('文件生成失败，请稍后重试')],
          if (file.isNotEmpty && !failed) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                UiIcon(
                  LucideIcons.check,
                  size: 14,
                  color: dark
                      ? const Color(0xff34d399)
                      : const Color(0xff059669),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: text(
                    '文件已生成',
                    color: dark
                        ? const Color(0xff34d399)
                        : const Color(0xff059669),
                  ),
                ),
                if (widget.preview != null)
                  fileButton(
                    '预览',
                    LucideIcons.eye,
                    () => widget.preview!(file),
                  ),
                const SizedBox(width: 6),
                fileButton(
                  '下载',
                  LucideIcons.download,
                  () => widget.download?.call(file),
                  primary: true,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget fileButton(
    String label,
    IconData icon,
    VoidCallback action, {
    bool primary = false,
  }) {
    final color = primary ? Theme.of(context).colorScheme.primary : muted;
    return Material(
      color: primary ? color.withValues(alpha: .1) : Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: action,
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          height: 32,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Row(
              children: [
                UiIcon(icon, size: 14, color: color),
                const SizedBox(width: 6),
                text(label, color: color, weight: FontWeight.w500),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ToolSpinner extends StatefulWidget {
  final double size;
  final Color color;
  const ToolSpinner({super.key, required this.size, required this.color});
  @override
  State<ToolSpinner> createState() => _ToolSpinnerState();
}

class _ToolSpinnerState extends State<ToolSpinner>
    with SingleTickerProviderStateMixin {
  late final controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 1),
  );
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      controller.stop();
    } else {
      controller.repeat();
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(
    turns: controller,
    child: UiIcon(
      LucideIcons.loaderCircle,
      size: widget.size,
      color: widget.color,
    ),
  );
}
