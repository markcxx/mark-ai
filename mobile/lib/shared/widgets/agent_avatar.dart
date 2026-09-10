import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_parsing/path_parsing.dart';

/// Geometry is sampled from the same BotEngine as the Web avatar, then painted
/// by Flutter Canvas. No browser, JavaScript runtime, or brand-logo recoloring.
enum AvatarAnimation { idle, swirl, wink, wide, notify, egg, hexagon, play }

class AgentAvatar extends StatefulWidget {
  static bool get isPreloaded => _AgentAvatarState.cachedFrames != null;
  static Future<void> preload() async {
    _AgentAvatarState.cachedFrames = await _AgentAvatarState.data;
  }

  final double size;
  final bool arriving;

  /// When supplied, the parent owns playback; ambient animation and taps pause.
  final AvatarAnimation? animation;
  final double progress;
  const AgentAvatar({
    super.key,
    this.size = 72,
    this.arriving = false,
    this.animation,
    this.progress = 0,
  }) : assert(progress >= 0 && progress <= 1);
  @override
  State<AgentAvatar> createState() => _AgentAvatarState();
}

class _AgentAvatarState extends State<AgentAvatar>
    with SingleTickerProviderStateMixin {
  static Map<String, dynamic>? cachedFrames;
  static final data = rootBundle
      .loadString('assets/avatar/frames.json')
      .then((s) => jsonDecode(s) as Map<String, dynamic>);
  late final AnimationController clock = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 8),
  );
  Map<String, dynamic>? frames;
  late String clip = widget.arriving ? 'swirl' : 'idle';
  final random = Random();

  @override
  void initState() {
    super.initState();
    frames = cachedFrames;
    data.then(
      (value) {
        cachedFrames = value;
        if (!mounted) return;
        setState(() => frames = value);
        if (widget.animation == null) play(clip);
      },
      onError: (Object _) {
        /* The startup screen provides an asset fallback. */
      },
    );
    clock.addStatusListener((status) {
      if (status == AnimationStatus.completed && widget.animation == null) {
        play(
          clip == 'idle'
              ? [
                  'wink',
                  'wide',
                  'notify',
                  'egg',
                  'hexagon',
                  'play',
                  'swirl',
                ][random.nextInt(7)]
              : 'idle',
        );
      }
    });
  }

  void play(String value) {
    if (frames == null) return;
    setState(() => clip = value);
    clock.duration = Duration(
      microseconds: ((frames!['clips'][clip] as List).length * 1000000 / 60)
          .round(),
    );
    if (MediaQuery.disableAnimationsOf(context)) return;
    clock.forward(from: 0);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context) || widget.animation != null) {
      clock.stop();
    } else if (frames != null && !clock.isAnimating) {
      clock.forward();
    }
  }

  @override
  void didUpdateWidget(covariant AgentAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.animation != null) {
      clock.stop();
    } else if (oldWidget.animation != null) {
      play(widget.arriving ? 'swirl' : 'idle');
    }
  }

  @override
  void dispose() {
    clock.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      label: widget.animation == null ? '可互动的 MarkAI 助手' : 'MarkAI 机器人',
      button: widget.animation == null,
      child: GestureDetector(
        onTap: reduce || widget.animation != null ? null : () => play('swirl'),
        child: SizedBox(
          width: widget.size,
          height: widget.size,
          child: frames == null
              ? const SizedBox()
              : AnimatedBuilder(
                  animation: clock,
                  builder: (context, _) {
                    final list =
                        frames!['clips'][reduce
                                ? 'idle'
                                : widget.animation?.name ?? clip]
                            as List;
                    final index = reduce
                        ? 0
                        : min(
                            list.length - 1,
                            ((widget.animation == null
                                        ? clock.value
                                        : widget.progress) *
                                    list.length)
                                .floor(),
                          );
                    return CustomPaint(
                      painter: _AvatarPainter(
                        list[index] as Map<String, dynamic>,
                        frames!['paths'] as List,
                        dark
                            ? const Color(0xff2496e8)
                            : const Color(0xff030712),
                        Theme.of(context).colorScheme.surface,
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

class _SvgPath extends PathProxy {
  final path = Path();
  @override
  void moveTo(double x, double y) => path.moveTo(x, y);
  @override
  void lineTo(double x, double y) => path.lineTo(x, y);
  @override
  void cubicTo(
    double x1,
    double y1,
    double x2,
    double y2,
    double x3,
    double y3,
  ) => path.cubicTo(x1, y1, x2, y2, x3, y3);
  @override
  void close() => path.close();
}

class _AvatarPainter extends CustomPainter {
  final Map<String, dynamic> frame;
  final List paths;
  final Color ink, surface;
  _AvatarPainter(this.frame, this.paths, this.ink, this.surface);
  static final cache = <String, Path>{};
  double n(dynamic value) => (value as num).toDouble();
  Path path(dynamic id) {
    final source = paths[id as int] as String;
    if (cache.length > 2048) cache.clear();
    return cache.putIfAbsent(source, () {
      final p = _SvgPath();
      writeSvgPathDataToPath(source, p);
      return p.path;
    });
  }

  Color color(String hex) =>
      Color(int.parse(hex.replaceFirst('#', 'ff'), radix: 16));

  @override
  void paint(Canvas canvas, Size size) {
    final saveCount = canvas.getSaveCount();
    canvas.save();
    try {
      canvas.translate(size.width / 2, size.height / 2);
      canvas.scale(size.width / 316);
      void arcs(String side) {
        for (final a in frame['arcs'] as List) {
          final g = a['grad'];
          final colors = (g['stops'] as List)
              .map((c) => color(c as String).withValues(alpha: n(a['opacity'])))
              .toList();
          canvas.drawPath(
            path(a[side]),
            Paint()
              ..style = PaintingStyle.stroke
              ..strokeCap = StrokeCap.round
              ..strokeWidth = n(a['width'])
              ..shader = ui.Gradient.linear(
                Offset(n(g['x1']), n(g['y1'])),
                Offset(n(g['x2']), n(g['y2'])),
                colors,
                List.generate(
                  colors.length,
                  (index) => index / (colors.length - 1),
                ),
              ),
          );
        }
      }

      void dots() {
        for (final d in frame['dots'] as List) {
          final opacity =
              n(d['opacity']) *
              (d['depth'] == null ? 1 : .35 + n(d['depth']) * .65);
          final paint = Paint()
            ..color = (d['color'] == null ? ink : color(d['color'])).withValues(
              alpha: opacity.clamp(0, 1),
            );
          if (d['d'] != null) {
            canvas.save();
            canvas.translate(n(d['x']), n(d['y']));
            canvas.rotate(n(d['rot'] ?? 0) * pi / 180);
            canvas.scale(100);
            canvas.drawPath(path(d['d']), paint);
            canvas.restore();
          } else {
            canvas.drawCircle(Offset(n(d['x']), n(d['y'])), n(d['r']), paint);
          }
        }
      }

      arcs('back');
      if (frame['dotsBehind'] == true) dots();
      canvas.saveLayer(
        const Rect.fromLTRB(-158, -158, 158, 158),
        Paint()..color = Colors.white.withValues(alpha: n(frame['bodyAlpha'])),
      );
      canvas.drawPath(path(frame['bodyPath']), Paint()..color = ink);
      canvas.save();
      canvas.clipPath(path(frame['bodyPath']));
      for (final e in frame['eyes'] as List) {
        final values = RegExp(r'-?\d+(?:\.\d+)?(?:e[+-]?\d+)?')
            .allMatches(e['matrix'] as String)
            .map((m) => double.parse(m[0]!))
            .toList();
        canvas.save();
        canvas.transform(
          Float64List.fromList([
            values[0],
            values[1],
            0,
            0,
            values[2],
            values[3],
            0,
            0,
            0,
            0,
            1,
            0,
            values[4],
            values[5],
            0,
            1,
          ]),
        );
        canvas.drawPath(
          path(e['d']),
          Paint()..color = surface.withValues(alpha: n(e['alpha'])),
        );
        canvas.restore();
      }
      final notch = frame['notch'];
      if (notch != null) {
        canvas.drawCircle(
          Offset(n(notch['x']), n(notch['y'])),
          n(notch['r']),
          Paint()..color = surface,
        );
      }
      canvas.restore();
      canvas.restore();
      if (frame['dotsBehind'] != true) dots();
      final notif = frame['notif'];
      if (notif != null) {
        canvas.drawCircle(
          Offset(n(notif['x']), n(notif['y'])),
          n(notif['r']),
          Paint()..color = const Color(0xff2496e8),
        );
      }
      arcs('front');
    } finally {
      canvas.restoreToCount(saveCount);
    }
  }

  @override
  bool shouldRepaint(_AvatarPainter old) =>
      old.frame != frame || old.ink != ink || old.surface != surface;
}
