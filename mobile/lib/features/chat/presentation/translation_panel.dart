import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/ui_icon.dart';

class TranslationPanel extends StatefulWidget {
  final String language;
  final Widget child;
  const TranslationPanel({
    super.key,
    required this.language,
    required this.child,
  });
  @override
  State<TranslationPanel> createState() => _TranslationPanelState();
}

class _TranslationPanelState extends State<TranslationPanel> {
  bool expanded = false;
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final muted = dark ? const Color(0xff9ca3af) : const Color(0xff6b7280);
    final duration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 200);
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.only(top: 16),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: dark ? const Color(0x17ffffff) : const Color(0xcce5e7eb),
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Semantics(
              expanded: expanded,
              button: true,
              child: InkWell(
                borderRadius: BorderRadius.circular(6),
                onTap: () => setState(() => expanded = !expanded),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 36),
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        UiIcon(LucideIcons.languages, size: 13, color: muted),
                        const SizedBox(width: 6),
                        Text(
                          '译文 · ${widget.language}',
                          style: TextStyle(
                            fontSize: 12,
                            height: 16 / 12,
                            fontWeight: FontWeight.w500,
                            color: muted,
                          ),
                        ),
                        const SizedBox(width: 6),
                        AnimatedRotation(
                          turns: expanded ? -.5 : 0,
                          duration: duration,
                          child: UiIcon(
                            LucideIcons.chevronDown,
                            size: 13,
                            color: muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          AnimatedSize(
            duration: duration,
            curve: Curves.easeOut,
            alignment: Alignment.topLeft,
            child: expanded
                ? Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: dark
                          ? const Color(0x06ffffff)
                          : const Color(0xe6f9fafb),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: dark
                            ? const Color(0x1affffff)
                            : const Color(0xffe5e7eb),
                      ),
                    ),
                    child: widget.child,
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}
