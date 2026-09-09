import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'ui_icon.dart';
import 'app_menu.dart';

class AppSelect<T> extends StatelessWidget {
  final T value;
  final Map<T, String> options;
  final ValueChanged<T>? onChanged;
  final double width, height;
  final String label;
  const AppSelect({
    super.key,
    required this.value,
    required this.options,
    required this.onChanged,
    required this.label,
    this.width = 240,
    this.height = 32,
  });
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final border = dark ? const Color(0x2effffff) : const Color(0xffd1d5db);
    final trigger = Opacity(
      opacity: onChanged == null ? .5 : 1,
      child: Container(
        height: height,
        padding: const EdgeInsets.symmetric(horizontal: 11),
        decoration: BoxDecoration(
          color: dark ? const Color(0xff202020) : Colors.white,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: border),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0f0f172a),
              blurRadius: 2,
              offset: Offset(0, 1),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                options[value] ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 14,
                  height: 20 / 14,
                  letterSpacing: 0,
                ),
              ),
            ),
            const SizedBox(width: 8),
            const UiIcon(
              LucideIcons.chevronDown,
              size: 14,
              color: Color(0xff9ca3af),
            ),
          ],
        ),
      ),
    );
    return SizedBox(
      width: width,
      child: AppMenuButton(
        width: width,
        selectionMenu: true,
        items: () => [
          for (final entry in options.entries)
            AppMenuItem(
              entry.value,
              selected: entry.key == value,
              onPressed: () => onChanged?.call(entry.key),
            ),
        ],
        builder: (toggle) => Tooltip(
          message: label,
          child: InkWell(
            onTap: onChanged == null ? null : toggle,
            borderRadius: BorderRadius.circular(6),
            child: trigger,
          ),
        ),
      ),
    );
  }
}
