import 'package:markai_mobile/shared/widgets/ui_icon.dart';

import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

Future<T?> showAppDialog<T>(BuildContext context, WidgetBuilder builder) =>
    showGeneralDialog<T>(
      context: context,
      barrierDismissible: true,
      barrierLabel: '关闭对话框',
      barrierColor: Colors.transparent,
      transitionDuration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 220),
      pageBuilder: (context, _, _) => builder(context),
      transitionBuilder: (context, animation, _, child) {
        final curve = CurvedAnimation(
          parent: animation,
          curve: const Cubic(.32, .72, 0, 1),
        );
        return FadeTransition(
          opacity: curve,
          child: Stack(
            children: [
              Positioned.fill(
                child: IgnorePointer(
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
                    child: const ColoredBox(color: Color(0x59000000)),
                  ),
                ),
              ),
              ScaleTransition(
                scale: Tween(begin: .97, end: 1.0).animate(curve),
                child: child,
              ),
            ],
          ),
        );
      },
    );

/// Geometry and motion shared with components/ui/AppDialog.tsx.
class AppDialog extends StatelessWidget {
  final String title;
  final Widget child;
  final double width;
  final double? height;
  final bool scrollBody;
  final bool closable;
  final bool closeDisabled;
  const AppDialog({
    super.key,
    required this.title,
    required this.child,
    this.width = 520,
    this.height,
    this.scrollBody = true,
    this.closable = true,
    this.closeDisabled = false,
  });
  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final mobile = media.size.width < 640;
    return PopScope(
      canPop: !closeDisabled,
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            mobile ? 12 : 32,
            12,
            mobile ? 12 : 32,
            12 + media.viewInsets.bottom,
          ),
          child: Center(
            child: Container(
              height: height,
              constraints: BoxConstraints(
                maxWidth: width,
                maxHeight:
                    media.size.height -
                    media.padding.vertical -
                    media.viewInsets.bottom -
                    (mobile ? 24 : 64),
              ),
              decoration: BoxDecoration(
                color: dark ? const Color(0xff191919) : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: dark
                      ? const Color(0x26ffffff)
                      : const Color(0xffe5e7eb),
                ),
                boxShadow: [
                  BoxShadow(
                    color: dark
                        ? const Color(0x94000000)
                        : const Color(0x380f172a),
                    blurRadius: 80,
                    offset: const Offset(0, 24),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Material(
                color: Colors.transparent,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      constraints: const BoxConstraints(minHeight: 56),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: dark
                                ? const Color(0x14ffffff)
                                : const Color(0xfff3f4f6),
                          ),
                        ),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              title,
                              style: const TextStyle(
                                fontSize: 17,
                                height: 1.4,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0,
                              ),
                            ),
                          ),
                          if (closable) const SizedBox(width: 12),
                          if (closable)
                            SizedBox(
                              width: 32,
                              height: 32,
                              child: IconButton(
                                tooltip: '关闭',
                                padding: EdgeInsets.zero,
                                onPressed: closeDisabled
                                    ? null
                                    : () => Navigator.pop(context),
                                icon: const UiIcon(LucideIcons.x, size: 16),
                              ),
                            ),
                        ],
                      ),
                    ),
                    Flexible(
                      child: scrollBody
                          ? SingleChildScrollView(child: child)
                          : child,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class AppField extends StatelessWidget {
  final String label;
  final TextEditingController? controller;
  final String? value, hint;
  final IconData icon;
  final bool enabled, numeric;
  const AppField({
    super.key,
    required this.label,
    required this.icon,
    this.controller,
    this.value,
    this.hint,
    this.enabled = true,
    this.numeric = false,
  });
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SizedBox(
        height: 24,
        child: Align(
          alignment: Alignment.centerLeft,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Color(0xff6b7280),
            ),
          ),
        ),
      ),
      const SizedBox(height: 6),
      Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: value != null
              ? Theme.of(context).brightness == Brightness.dark
                    ? const Color(0x06ffffff)
                    : const Color(0xfff9fafb)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Theme.of(context).colorScheme.outline),
        ),
        child: Row(
          children: [
            UiIcon(icon, size: 17, color: const Color(0xff9ca3af)),
            const SizedBox(width: 10),
            Expanded(
              child: value != null
                  ? Text(
                      value!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 14),
                    )
                  : TextField(
                      controller: controller,
                      enabled: enabled,
                      keyboardType: numeric
                          ? TextInputType.number
                          : TextInputType.text,
                      style: const TextStyle(fontSize: 14, letterSpacing: 0),
                      decoration: InputDecoration(
                        hintText: hint,
                        isDense: true,
                        filled: false,
                        contentPadding: EdgeInsets.zero,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        disabledBorder: InputBorder.none,
                      ),
                    ),
            ),
          ],
        ),
      ),
    ],
  );
}
