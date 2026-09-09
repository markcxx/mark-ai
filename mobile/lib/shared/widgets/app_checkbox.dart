import 'package:flutter/material.dart';

class AppCheckbox extends StatelessWidget {
  final bool checked, indeterminate;
  final String label;
  final ValueChanged<bool>? onChanged;
  const AppCheckbox({
    super.key,
    required this.checked,
    required this.label,
    required this.onChanged,
    this.indeterminate = false,
  });
  @override
  Widget build(BuildContext context) {
    final active = checked || indeterminate;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      checked: checked,
      mixed: indeterminate,
      label: label,
      enabled: onChanged != null,
      child: InkWell(
        onTap: onChanged == null ? null : () => onChanged!(!checked),
        borderRadius: BorderRadius.circular(4),
        child: Opacity(
          opacity: onChanged == null ? .4 : 1,
          child: Container(
            width: 18,
            height: 18,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4),
              color: active
                  ? Theme.of(context).colorScheme.primary
                  : dark
                  ? Colors.transparent
                  : Colors.white,
              border: Border.all(
                width: 1.5,
                color: active
                    ? Theme.of(context).colorScheme.primary
                    : dark
                    ? const Color(0xff4b5563)
                    : const Color(0xffd1d5db),
              ),
            ),
            child: active
                ? CustomPaint(painter: _CheckPainter(indeterminate))
                : null,
          ),
        ),
      ),
    );
  }
}

class _CheckPainter extends CustomPainter {
  final bool mixed;
  _CheckPainter(this.mixed);
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.translate((size.width - 12) / 2, (size.height - 12) / 2);
    canvas.scale(.5);
    final path = mixed
        ? (Path()
            ..moveTo(5, 12)
            ..lineTo(19, 12))
        : (Path()
            ..moveTo(20, 6)
            ..lineTo(9, 17)
            ..lineTo(4, 12));
    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.8
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _CheckPainter old) => old.mixed != mixed;
}
