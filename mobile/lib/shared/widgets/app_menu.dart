import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'ui_icon.dart';

class AppMenuItem {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final List<AppMenuItem>? submenu;
  final bool danger, divider, keepOpen, selected;
  final bool? checked;
  const AppMenuItem(
    this.label, {
    this.icon,
    this.onPressed,
    this.submenu,
    this.danger = false,
    this.checked,
    this.keepOpen = false,
    this.selected = false,
  }) : divider = false;
  const AppMenuItem.divider()
    : label = '',
      icon = null,
      onPressed = null,
      submenu = null,
      danger = false,
      checked = null,
      keepOpen = false,
      selected = false,
      divider = true;
}

/// DropdownSurface / FloatingMenu geometry, without Material popup padding and elevation.
class AppMenuButton extends StatefulWidget {
  final Widget Function(VoidCallback toggle) builder;
  final List<AppMenuItem> Function() items;
  final double width, radius, horizontalOffset;
  final bool alignRight, floating, selectionMenu;
  final GlobalKey? positionAnchor;
  final double? topOffset;
  const AppMenuButton({
    super.key,
    required this.builder,
    required this.items,
    this.width = 208,
    this.radius = 12,
    this.alignRight = false,
    this.floating = false,
    this.positionAnchor,
    this.topOffset,
    this.horizontalOffset = 0,
    this.selectionMenu = false,
  });
  @override
  State<AppMenuButton> createState() => _AppMenuButtonState();
}

class _AppMenuButtonState extends State<AppMenuButton> {
  final anchor = GlobalKey();
  bool open = false;
  Future<void> toggle() async {
    if (open) return;
    final box =
        (widget.positionAnchor?.currentContext ?? anchor.currentContext)!
                .findRenderObject()
            as RenderBox;
    final rect = box.localToGlobal(Offset.zero) & box.size;
    open = true;
    await showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: '关闭菜单',
      barrierColor: Colors.transparent,
      transitionDuration:
          widget.floating || MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 150),
      transitionBuilder: (_, animation, _, child) =>
          FadeTransition(opacity: animation, child: child),
      pageBuilder: (_, _, _) => _MenuOverlay(anchor: rect, button: widget),
    );
    open = false;
  }

  @override
  Widget build(BuildContext context) =>
      KeyedSubtree(key: anchor, child: widget.builder(toggle));
}

class _MenuOverlay extends StatefulWidget {
  final Rect anchor;
  final AppMenuButton button;
  const _MenuOverlay({required this.anchor, required this.button});
  @override
  State<_MenuOverlay> createState() => _MenuOverlayState();
}

class _MenuOverlayState extends State<_MenuOverlay> {
  String? submenu;
  int selected = -1;
  Widget surface(List<AppMenuItem> items, {bool nested = false}) {
    final floating = widget.button.floating || nested;
    final selection = widget.button.selectionMenu;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final foreground = dark
        ? const Color(0xffd1d5db)
        : selection
        ? const Color(0xff111827)
        : const Color(0xff374151);
    final panel = Container(
      decoration: BoxDecoration(
        color: dark
            ? (selection
                  ? const Color(0xff202020)
                  : floating
                  ? const Color(0xff1f2937)
                  : const Color(0xff191919))
            : Colors.white,
        borderRadius: BorderRadius.circular(nested ? 12 : widget.button.radius),
        border: Border.all(
          color: dark
              ? (selection
                    ? const Color(0x2effffff)
                    : floating
                    ? const Color(0xff374151)
                    : const Color(0x1affffff))
              : selection
              ? const Color(0xffd1d5db)
              : const Color(0xffe5e7eb),
        ),
        boxShadow: selection
            ? [
                BoxShadow(
                  color: dark
                      ? const Color(0x8c000000)
                      : const Color(0x290f172a),
                  blurRadius: dark ? 48 : 40,
                  offset: Offset(0, dark ? 18 : 16),
                ),
                BoxShadow(
                  color: dark
                      ? const Color(0x59000000)
                      : const Color(0x140f172a),
                  blurRadius: dark ? 14 : 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : const [
                BoxShadow(
                  color: Color(0x29000000),
                  blurRadius: 36,
                  offset: Offset(0, 12),
                ),
              ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: SingleChildScrollView(
          padding: EdgeInsets.symmetric(
            vertical: 4,
            horizontal: floating ? 0 : 4,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final indexed in items.indexed)
                if (indexed.$2.divider)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Divider(
                      height: 1,
                      color: dark
                          ? const Color(0x1affffff)
                          : const Color(0xfff3f4f6),
                    ),
                  )
                else
                  MouseRegion(
                    onEnter: (_) => setState(() {
                      if (!nested) {
                        selected = indexed.$1;
                        submenu = indexed.$2.submenu == null
                            ? null
                            : indexed.$2.label;
                      }
                    }),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(
                        selection
                            ? 8
                            : floating
                            ? 0
                            : 6,
                      ),
                      hoverColor: dark
                          ? const Color(0xff374151)
                          : const Color(0xfff3f4f6),
                      onTap: () => activateItem(indexed.$2),
                      child: Container(
                        height: selection ? 32 : 36,
                        padding: EdgeInsets.symmetric(
                          horizontal: floating || selection ? 12 : 10,
                        ),
                        color: selection && indexed.$2.selected
                            ? Color.alphaBlend(
                                Theme.of(context).colorScheme.primary
                                    .withValues(alpha: dark ? .17 : .09),
                                dark ? const Color(0xff202020) : Colors.white,
                              )
                            : !nested && selected == indexed.$1
                            ? (dark
                                  ? const Color(0xff374151)
                                  : const Color(0xfff3f4f6))
                            : null,
                        child: Row(
                          children: [
                            if (indexed.$2.icon != null) ...[
                              UiIcon(
                                indexed.$2.icon,
                                size: 15,
                                color: indexed.$2.danger
                                    ? (dark
                                          ? const Color(0xfff87171)
                                          : const Color(0xffdc2626))
                                    : foreground,
                              ),
                              const SizedBox(width: 8),
                            ],
                            Expanded(
                              child: Text(
                                indexed.$2.label,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontFamily: 'Noto Sans SC',
                                  fontSize: 14,
                                  height: 20 / 14,
                                  fontWeight: FontWeight.w400,
                                  letterSpacing: 0,
                                  color: indexed.$2.danger
                                      ? (dark
                                            ? const Color(0xfff87171)
                                            : const Color(0xffdc2626))
                                      : foreground,
                                ),
                              ),
                            ),
                            if (indexed.$2.submenu != null)
                              const UiIcon(
                                LucideIcons.chevronRight,
                                size: 14,
                                color: Color(0xff9ca3af),
                              ),
                            if (selection && indexed.$2.selected) ...[
                              const SizedBox(width: 8),
                              UiIcon(
                                LucideIcons.check,
                                size: 14,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            ],
                            if (indexed.$2.checked != null)
                              Container(
                                width: 36,
                                height: 20,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(10),
                                  color: indexed.$2.checked!
                                      ? Theme.of(context).colorScheme.primary
                                      : dark
                                      ? const Color(0xff374151)
                                      : const Color(0xffd1d5db),
                                ),
                                alignment: indexed.$2.checked!
                                    ? Alignment.centerRight
                                    : Alignment.centerLeft,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 2,
                                ),
                                child: Container(
                                  width: 16,
                                  height: 16,
                                  decoration: const BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
    final animation = ModalRoute.of(context)?.animation;
    if (floating || animation == null) return panel;
    return AnimatedBuilder(
      animation: animation,
      child: panel,
      builder: (_, child) {
        final progress = const Cubic(.22, 1, .36, 1).transform(animation.value);
        if (selection) {
          return Transform(
            alignment: Alignment.topCenter,
            transform: Matrix4.diagonal3Values(1, .92 + .08 * progress, 1),
            child: child,
          );
        }
        return Transform.translate(
          offset: Offset(0, 8 * (1 - progress)),
          child: Transform.scale(
            alignment: Alignment.topRight,
            scale: .97 + .03 * progress,
            child: child,
          ),
        );
      },
    );
  }

  void activateItem(AppMenuItem item) {
    if (item.divider) return;
    if (item.submenu != null) {
      setState(() => submenu = submenu == item.label ? null : item.label);
      return;
    }
    if (!item.keepOpen) Navigator.pop(context);
    item.onPressed?.call();
    if (item.keepOpen) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final items = widget.button.items();
    final size = MediaQuery.sizeOf(context);
    final width = math.min(widget.button.width, size.width - 16);
    final height = items.fold<double>(
      10,
      (sum, item) =>
          sum +
          (item.divider
              ? 9
              : widget.button.selectionMenu
              ? 32
              : 36),
    );
    final below =
        size.height -
        widget.anchor.bottom -
        8 -
        MediaQuery.viewInsetsOf(context).bottom;
    final above = widget.anchor.top - 8;
    final showAbove =
        widget.button.topOffset == null && below < height && above > below;
    final maxHeight = math.max(0.0, (showAbove ? above : below) - 4);
    final left =
        (widget.button.alignRight
                ? widget.anchor.right - width
                : widget.anchor.left + widget.button.horizontalOffset)
            .clamp(8.0, math.max(8.0, size.width - width - 8))
            .toDouble();
    final top = widget.button.topOffset != null
        ? widget.anchor.top + widget.button.topOffset!
        : showAbove
        ? math.max(8.0, widget.anchor.top - math.min(height, maxHeight) - 6)
        : widget.anchor.bottom + 6;
    final childIndex = items.indexWhere((item) => item.label == submenu);
    final children = childIndex < 0 ? null : items[childIndex].submenu;
    final preferredChildLeft = left + width + 6 + 176 <= size.width - 8
        ? left + width + 6
        : left - 182;
    return Focus(
      autofocus: true,
      onKeyEvent: (_, event) {
        if (event is! KeyDownEvent) return KeyEventResult.ignored;
        if (event.logicalKey == LogicalKeyboardKey.escape) {
          if (submenu != null) {
            setState(() => submenu = null);
          } else {
            Navigator.pop(context);
          }
        } else if (event.logicalKey == LogicalKeyboardKey.arrowDown ||
            event.logicalKey == LogicalKeyboardKey.arrowUp) {
          final step = event.logicalKey == LogicalKeyboardKey.arrowDown
              ? 1
              : -1;
          setState(() {
            do {
              selected = (selected + step) % items.length;
            } while (items[selected].divider);
          });
        } else if (event.logicalKey == LogicalKeyboardKey.enter &&
            selected >= 0) {
          activateItem(items[selected]);
        } else {
          return KeyEventResult.ignored;
        }
        return KeyEventResult.handled;
      },
      child: Stack(
        children: [
          Positioned(
            left: left,
            top: top.toDouble(),
            width: width,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: math.min(maxHeight, size.height - top - 8),
              ),
              child: surface(items),
            ),
          ),
          if (children != null)
            Positioned(
              left: preferredChildLeft
                  .clamp(8.0, math.max(8.0, size.width - 184))
                  .toDouble(),
              top: math.max(
                8.0,
                math.min(
                  top + childIndex * 36,
                  size.height -
                      math.min(children.length * 36.0 + 10, 420.0) -
                      8,
                ),
              ),
              width: 176,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: math.min(size.height * .7, 420),
                ),
                child: surface(children, nested: true),
              ),
            ),
        ],
      ),
    );
  }
}
