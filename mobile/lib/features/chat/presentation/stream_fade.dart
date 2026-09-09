import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';

/// Paint only newly appended glyphs with the Web 180ms opacity transition.
/// Text remains a normal RenderParagraph: selection, shaping and wrapping are
/// preserved, including Chinese and mixed-direction text.
class StreamFade extends StatefulWidget {
  final Widget child;
  final String content;
  final bool enabled;
  const StreamFade({
    super.key,
    required this.child,
    required this.content,
    required this.enabled,
  });
  @override
  State<StreamFade> createState() => _StreamFadeState();
}

class _StreamFadeState extends State<StreamFade>
    with SingleTickerProviderStateMixin {
  late final AnimationController clock = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 180),
  );
  @override
  void initState() {
    super.initState();
    if (widget.enabled) clock.forward();
  }

  @override
  void didUpdateWidget(StreamFade oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.enabled && oldWidget.content != widget.content) {
      clock.forward(from: 0);
    }
  }

  @override
  void dispose() {
    clock.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _FadePaint(
    enabled: widget.enabled && !MediaQuery.disableAnimationsOf(context),
    clock: clock,
    child: widget.child,
  );
}

class StreamFadeExclusion extends SingleChildRenderObjectWidget {
  const StreamFadeExclusion({super.key, required super.child});
  @override
  RenderObject createRenderObject(BuildContext context) => _Excluded();
}

class _Excluded extends RenderProxyBox {}

class _FadePaint extends SingleChildRenderObjectWidget {
  final bool enabled;
  final Animation<double> clock;
  const _FadePaint({
    required this.enabled,
    required this.clock,
    required super.child,
  });
  @override
  RenderObject createRenderObject(BuildContext context) =>
      _FadeRender(enabled, clock);
  @override
  void updateRenderObject(BuildContext context, _FadeRender renderObject) {
    renderObject.enabled = enabled;
    renderObject.markNeedsPaint();
  }
}

class _GlyphHistory {
  final String text;
  final List<int> born;
  _GlyphHistory(this.text, this.born);
}

class _FadeRender extends RenderProxyBox {
  bool enabled;
  final Animation<double> clock;
  final history = <String, _GlyphHistory>{};
  _FadeRender(this.enabled, this.clock);
  @override
  bool get isRepaintBoundary => true;
  @override
  void attach(PipelineOwner owner) {
    super.attach(owner);
    clock.addListener(markNeedsPaint);
  }

  @override
  void detach() {
    clock.removeListener(markNeedsPaint);
    super.detach();
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    if (!enabled) {
      history.clear();
      super.paint(context, offset);
      return;
    }
    final masks = <(Rect, double)>[], alive = <String>{};
    final now = SchedulerBinding.instance.currentFrameTimeStamp.inMilliseconds;
    void visit(RenderObject node, String path) {
      if (node is _Excluded || (node is _FadeRender && node != this)) return;
      if (node is RenderParagraph && node.hasSize) {
        alive.add(path);
        final text = node.text.toPlainText(), old = history[path];
        var prefix = 0;
        if (old != null) {
          while (prefix < old.text.length &&
              prefix < text.length &&
              old.text.codeUnitAt(prefix) == text.codeUnitAt(prefix)) {
            prefix++;
          }
        }
        final born = List<int>.generate(
          text.length,
          (i) => i < prefix ? old!.born[i] : now,
        );
        history[path] = _GlyphHistory(text, born);
        final origin = node.localToGlobal(Offset.zero, ancestor: this) + offset;
        for (var i = 0; i < text.length; i++) {
          final age = now - born[i];
          if (clock.status == AnimationStatus.completed ||
              age >= 180 ||
              text[i].trim().isEmpty) {
            continue;
          }
          var end = i + 1;
          if (text.codeUnitAt(i) >= 0xd800 &&
              text.codeUnitAt(i) <= 0xdbff &&
              end < text.length) {
            end++;
          }
          final opacity = const Cubic(
            .33,
            0,
            .67,
            1,
          ).transform((age / 180).clamp(0, 1));
          for (final box in node.getBoxesForSelection(
            TextSelection(baseOffset: i, extentOffset: end),
          )) {
            masks.add((box.toRect().shift(origin), opacity));
          }
          i = end - 1;
        }
        return;
      }
      var index = 0;
      node.visitChildren((child) => visit(child, '$path/${index++}'));
    }

    if (child != null) visit(child!, '');
    history.removeWhere((key, _) => !alive.contains(key));
    if (masks.isEmpty) {
      super.paint(context, offset);
      return;
    }
    context.canvas.saveLayer(offset & size, Paint());
    super.paint(context, offset);
    final paint = Paint()..blendMode = BlendMode.dstIn;
    for (final mask in masks) {
      paint.color = Colors.white.withValues(alpha: mask.$2);
      context.canvas.drawRect(mask.$1, paint);
    }
    context.canvas.restore();
  }
}
