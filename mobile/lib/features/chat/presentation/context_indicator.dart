import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../shared/models/context_window.dart';
import '../../../shared/models/model_metadata.dart';
import '../application/workspace_controller.dart';

class ContextIndicator extends StatelessWidget {
  final WorkspaceController controller;
  const ContextIndicator({super.key, required this.controller});
  @override
  Widget build(BuildContext context) {
    final c = controller;
    final tokens = estimateDraftContextTokens(
      messages: c.messages,
      attachments: c.attachments,
      draft: c.quote == null ? c.draft : '${c.quote!['content']}\n\n${c.draft}',
      toolIds: c.enabledTools,
      webSearch: c.webSearch,
    );
    final metadata = metadataForModel(c.model?.id ?? ''),
        limit = metadata?['contextWindowTokens'] as num?;
    final percent = limit != null && limit > 0 ? tokens / limit * 100 : null;
    final label = percent == null
        ? '上限未知'
        : percent > 0 && percent < 1
        ? '<1%'
        : '${percent.toStringAsFixed(0)}%';
    final dark = Theme.of(context).brightness == Brightness.dark;
    final tone = (percent ?? 0) >= 90
        ? const Color(0xffdc2626)
        : (percent ?? 0) >= 70
        ? const Color(0xffd97706)
        : dark
        ? const Color(0xff6b7280)
        : const Color(0xff9ca3af);
    final anchor = GlobalKey();
    final size = MediaQuery.sizeOf(context).width >= 768 ? 32.0 : 44.0;
    return SizedBox(
      key: anchor,
      width: size,
      height: size,
      child: IconButton(
        tooltip: '查看上下文占用，约 ${formatTokenCount(tokens)} tokens，$label',
        padding: EdgeInsets.zero,
        icon: CustomPaint(
          size: const Size(28, 28),
          painter: _ContextRing(percent, tone, dark),
        ),
        onPressed: () {
          final box = anchor.currentContext!.findRenderObject() as RenderBox;
          final rect = box.localToGlobal(Offset.zero) & box.size;
          showGeneralDialog(
            context: context,
            barrierDismissible: true,
            barrierLabel: '关闭上下文详情',
            barrierColor: Colors.transparent,
            transitionDuration: const Duration(milliseconds: 150),
            pageBuilder: (context, _, _) {
              Widget row(String key, String value) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        key,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xff9ca3af),
                        ),
                      ),
                    ),
                    Text(value, style: const TextStyle(fontSize: 12)),
                  ],
                ),
              );
              return Stack(
                children: [
                  Positioned(
                    left: (rect.right - 256)
                        .clamp(
                          12,
                          math.max(12, MediaQuery.sizeOf(context).width - 268),
                        )
                        .toDouble(),
                    bottom: MediaQuery.sizeOf(context).height - rect.top + 8,
                    width: math.min(256, MediaQuery.sizeOf(context).width - 24),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: dark ? const Color(0xff191919) : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: dark
                              ? const Color(0x1affffff)
                              : const Color(0xffe5e7eb),
                        ),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x1a000000),
                            blurRadius: 15,
                            offset: Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              metadata?['displayName'] as String? ??
                                  c.model?.id ??
                                  '当前会话',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 8),
                            row('预计上下文', '${formatTokenCount(tokens)} tokens'),
                            row(
                              '上下文上限',
                              limit != null
                                  ? '${formatTokenCount(limit)} tokens'
                                  : '尚未公布',
                            ),
                            row(
                              '占用比例',
                              percent == null
                                  ? '无法计算'
                                  : '${percent.toStringAsFixed(1)}%',
                            ),
                            if (metadata?['maxOutputTokens'] != null)
                              row(
                                '最大输出',
                                '${formatTokenCount(metadata!['maxOutputTokens'] as num)} tokens',
                              ),
                            const SizedBox(height: 2),
                            const Divider(),
                            const SizedBox(height: 8),
                            const Text(
                              '按当前会话、草稿、附件和已启用工具估算，不是累计消耗。图片、系统提示与工具结果可能存在偏差；超出预算时服务端会裁剪较早内容。',
                              style: TextStyle(
                                fontSize: 11,
                                height: 16 / 11,
                                color: Color(0xff9ca3af),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}

class _ContextRing extends CustomPainter {
  final double? percent;
  final Color color;
  final bool dark;
  _ContextRing(this.percent, this.color, this.dark);
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..color = dark ? const Color(0x1affffff) : const Color(0xffe5e7eb);
    canvas.drawCircle(const Offset(14, 14), 11, paint);
    if ((percent ?? 0) > 0) {
      paint
        ..color = color
        ..strokeCap = StrokeCap.round;
      canvas.drawArc(
        const Rect.fromLTWH(3, 3, 22, 22),
        -math.pi / 2,
        math.min(100, percent!) / 100 * 2 * math.pi,
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_ContextRing oldDelegate) =>
      oldDelegate.percent != percent ||
      oldDelegate.color != color ||
      oldDelegate.dark != dark;
}
