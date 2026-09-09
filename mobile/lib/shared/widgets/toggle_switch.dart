import 'package:flutter/material.dart';

class ToggleSwitch extends StatelessWidget {
  final bool checked;
  final ValueChanged<bool>? onChanged;
  final String label;
  const ToggleSwitch({
    super.key,
    required this.checked,
    required this.onChanged,
    required this.label,
  });
  @override
  Widget build(BuildContext context) => Semantics(
    toggled: checked,
    enabled: onChanged != null,
    label: label,
    child: InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onChanged == null ? null : () => onChanged!(!checked),
      child: SizedBox(
        width: 44,
        height: 28,
        child: Center(
          child: Opacity(
            opacity: onChanged == null ? .6 : 1,
            child: AnimatedContainer(
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 150),
              width: 36,
              height: 20,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: checked
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xff4b5563)
                    : const Color(0xffd1d5db),
              ),
              child: AnimatedAlign(
                duration: MediaQuery.disableAnimationsOf(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 150),
                alignment: checked
                    ? Alignment.centerRight
                    : Alignment.centerLeft,
                child: Container(
                  width: 14,
                  height: 14,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x1a000000),
                        blurRadius: 2,
                        offset: Offset(0, 1),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
