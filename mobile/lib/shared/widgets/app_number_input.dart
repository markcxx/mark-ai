import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'ui_icon.dart';

class AppNumberInput extends StatefulWidget {
  final double value, min, max, step, width;
  final ValueChanged<double> onChanged;
  final String label;
  const AppNumberInput({
    super.key,
    required this.value,
    required this.onChanged,
    required this.label,
    this.min = 0,
    this.max = 100,
    this.step = 1,
    this.width = 100,
  });
  @override
  State<AppNumberInput> createState() => _AppNumberInputState();
}

class _AppNumberInputState extends State<AppNumberInput> {
  final focus = FocusNode();
  late final text = TextEditingController(text: formatted(widget.value));
  bool hover = false;
  String formatted(double value) =>
      value == value.roundToDouble() ? '${value.toInt()}' : '$value';
  @override
  void initState() {
    super.initState();
    focus.addListener(() => setState(() {}));
  }

  @override
  void didUpdateWidget(covariant AppNumberInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value &&
        double.tryParse(text.text) != widget.value) {
      text.text = formatted(widget.value);
    }
  }

  @override
  void dispose() {
    focus.dispose();
    text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return MouseRegion(
      onEnter: (_) => setState(() => hover = true),
      onExit: (_) => setState(() => hover = false),
      child: Container(
        width: widget.width,
        height: 32,
        decoration: BoxDecoration(
          color: dark ? const Color(0x0fffffff) : Colors.white,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: focus.hasFocus
                ? Theme.of(context).colorScheme.primary.withValues(alpha: .6)
                : dark
                ? const Color(0x29ffffff)
                : const Color(0xffd1d5db),
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: text,
                focusNode: focus,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                  signed: true,
                ),
                style: const TextStyle(fontSize: 14, height: 20 / 14),
                decoration: InputDecoration(
                  hintText: widget.label,
                  isDense: true,
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                ),
                onChanged: (input) {
                  final value = double.tryParse(input);
                  if (value != null && value.isFinite) {
                    widget.onChanged(value.clamp(widget.min, widget.max));
                  }
                },
              ),
            ),
            Opacity(
              opacity: hover || focus.hasFocus ? 1 : 0,
              child: SizedBox(
                width: 20,
                child: Column(
                  children: [
                    for (final direction in [1, -1])
                      Expanded(
                        child: Semantics(
                          button: true,
                          label: direction == 1
                              ? '增加${widget.label}'
                              : '减少${widget.label}',
                          child: InkWell(
                            onTap: () => widget.onChanged(
                              (widget.value + widget.step * direction).clamp(
                                widget.min,
                                widget.max,
                              ),
                            ),
                            child: Center(
                              child: UiIcon(
                                direction == 1
                                    ? LucideIcons.chevronUp
                                    : LucideIcons.chevronDown,
                                size: 10,
                                color: const Color(0xff9ca3af),
                              ),
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
    );
  }
}
