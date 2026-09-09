import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_number_input.dart';

class AppSliderWithInput extends StatelessWidget {
  final String label;
  final double value, min, max, step, width;
  final ValueChanged<double> onChanged;
  const AppSliderWithInput({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.min = 0,
    this.max = 100,
    this.step = 1,
    this.width = 240,
  });
  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    height: 32,
    child: Row(
      children: [
        Expanded(
          child: _WebRange(
            value: value,
            min: min,
            max: max,
            step: step,
            onChanged: onChanged,
          ),
        ),
        const SizedBox(width: 16),
        AppNumberInput(
          label: label,
          value: value,
          min: min,
          max: max,
          step: step,
          width: 64,
          onChanged: onChanged,
        ),
      ],
    ),
  );
}

class _WebRange extends StatefulWidget {
  final double value, min, max, step;
  final ValueChanged<double> onChanged;
  const _WebRange({
    required this.value,
    required this.min,
    required this.max,
    required this.step,
    required this.onChanged,
  });
  @override
  State<_WebRange> createState() => _WebRangeState();
}

class _WebRangeState extends State<_WebRange> {
  bool hover = false, focused = false;
  void change(double value) =>
      widget.onChanged(value.clamp(widget.min, widget.max));
  void point(double x, double width) {
    final fraction = ((x - 6) / (width - 12)).clamp(0.0, 1.0);
    change(
      widget.min +
          ((widget.max - widget.min) * fraction / widget.step).round() *
              widget.step,
    );
  }

  @override
  Widget build(BuildContext context) => Semantics(
    slider: true,
    label: '数值滑杆',
    value: '${widget.value}',
    increasedValue:
        '${(widget.value + widget.step).clamp(widget.min, widget.max)}',
    decreasedValue:
        '${(widget.value - widget.step).clamp(widget.min, widget.max)}',
    onIncrease: () => change(widget.value + widget.step),
    onDecrease: () => change(widget.value - widget.step),
    child: Focus(
      onFocusChange: (value) => setState(() => focused = value),
      onKeyEvent: (_, event) {
        if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
          return KeyEventResult.ignored;
        }
        final key = event.logicalKey;
        if (key == LogicalKeyboardKey.arrowLeft ||
            key == LogicalKeyboardKey.arrowDown) {
          change(widget.value - widget.step);
        } else if (key == LogicalKeyboardKey.arrowRight ||
            key == LogicalKeyboardKey.arrowUp) {
          change(widget.value + widget.step);
        } else if (key == LogicalKeyboardKey.home) {
          change(widget.min);
        } else if (key == LogicalKeyboardKey.end) {
          change(widget.max);
        } else {
          return KeyEventResult.ignored;
        }
        return KeyEventResult.handled;
      },
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        onEnter: (_) => setState(() => hover = true),
        onExit: (_) => setState(() => hover = false),
        child: LayoutBuilder(
          builder: (context, constraints) => GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (event) =>
                point(event.localPosition.dx, constraints.maxWidth),
            onHorizontalDragUpdate: (event) =>
                point(event.localPosition.dx, constraints.maxWidth),
            child: CustomPaint(
              size: Size(constraints.maxWidth, 32),
              painter: _RangePainter(
                fraction: widget.max == widget.min
                    ? 0
                    : ((widget.value - widget.min) / (widget.max - widget.min))
                          .clamp(0, 1),
                color: Theme.of(context).colorScheme.primary,
                emphasized: hover || focused,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _RangePainter extends CustomPainter {
  final double fraction;
  final Color color;
  final bool emphasized;
  _RangePainter({
    required this.fraction,
    required this.color,
    required this.emphasized,
  });
  @override
  void paint(Canvas canvas, Size size) {
    final track = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, size.height / 2 - 2, size.width, 4),
      const Radius.circular(2),
    );
    canvas.drawRRect(track, Paint()..color = const Color(0xffe5e7eb));
    canvas.save();
    canvas.clipRRect(track);
    canvas.drawRect(
      Rect.fromLTWH(0, size.height / 2 - 2, size.width * fraction, 4),
      Paint()..color = color,
    );
    canvas.restore();
    final center = Offset(6 + (size.width - 12) * fraction, size.height / 2);
    final radius = emphasized ? 6.9 : 6.0;
    canvas.drawShadow(
      Path()..addOval(Rect.fromCircle(center: center, radius: radius)),
      const Color(0x2e0f172a),
      1,
      true,
    );
    canvas.drawCircle(center, radius, Paint()..color = color);
    canvas.drawCircle(center, radius - 2, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant _RangePainter old) =>
      old.fraction != fraction ||
      old.color != color ||
      old.emphasized != emphasized;
}
