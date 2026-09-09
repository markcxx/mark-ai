import 'dart:async';

import 'package:flutter/material.dart';

import '../../features/chat/presentation/tool_call_block.dart' show ToolSpinner;

class AppToastHost extends StatefulWidget {
  final Widget child;
  const AppToastHost({super.key, required this.child});
  static void show(
    BuildContext context,
    String text, {
    String kind = 'blank',
    String? id,
  }) => context.findAncestorStateOfType<AppToastHostState>()?.show(
    text,
    kind: kind,
    id: id,
  );
  @override
  State<AppToastHost> createState() => AppToastHostState();
}

class AppToastHostState extends State<AppToastHost> {
  final entries = <String, ({String text, String kind})>{};
  final timers = <String, Timer>{};
  int sequence = 0;
  void show(String text, {String kind = 'blank', String? id}) {
    final key = id ?? 'toast-${sequence++}';
    timers.remove(key)?.cancel();
    setState(() => entries[key] = (text: text, kind: kind));
    if (kind != 'loading') {
      timers[key] = Timer(const Duration(milliseconds: 2200), () {
        timers.remove(key);
        if (mounted) setState(() => entries.remove(key));
      });
    }
  }

  @override
  void dispose() {
    for (final timer in timers.values) {
      timer.cancel();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      widget.child,
      Positioned(
        top: MediaQuery.paddingOf(context).top + 16,
        left: 16,
        right: 16,
        child: IgnorePointer(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final entry in entries.entries.toList().reversed)
                Padding(
                  key: ValueKey(entry.key),
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 350),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xffe5e7eb)),
                      boxShadow: const [
                        BoxShadow(
                          offset: Offset(0, 12),
                          blurRadius: 36,
                          color: Color(0x1f000000),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (entry.value.kind != 'blank') ...[
                          if (entry.value.kind == 'loading')
                            const ToolSpinner(
                              size: 20,
                              color: Color(0xff6b7280),
                            )
                          else
                            Container(
                              width: 20,
                              height: 20,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: entry.value.kind == 'error'
                                    ? const Color(0xffff4b4b)
                                    : const Color(0xff61d345),
                              ),
                              child: Center(
                                child: CustomPaint(
                                  size: const Size(14, 14),
                                  painter: _ToastMark(
                                    entry.value.kind == 'error',
                                  ),
                                ),
                              ),
                            ),
                          const SizedBox(width: 10),
                        ],
                        Flexible(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 4,
                            ),
                            child: Text(
                              entry.value.text,
                              style: const TextStyle(
                                fontFamily: 'Noto Sans SC',
                                fontSize: 14,
                                height: 1.3,
                                color: Color(0xff363636),
                                decoration: TextDecoration.none,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    ],
  );
}

class _ToastMark extends CustomPainter {
  final bool error;
  const _ToastMark(this.error);
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path();
    if (error) {
      path
        ..moveTo(3, 3)
        ..lineTo(11, 11)
        ..moveTo(11, 3)
        ..lineTo(3, 11);
    } else {
      path
        ..moveTo(2, 7)
        ..lineTo(5.5, 10.5)
        ..lineTo(12, 4);
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _ToastMark oldDelegate) =>
      error != oldDelegate.error;
}
