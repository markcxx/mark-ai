import 'package:flutter/material.dart';

/// Matches ChatApp's mobile push transition and desktop persistent column.
class WorkspaceShell extends StatelessWidget {
  final bool open, reduceMotion;
  final double sidebarWidth;
  final VoidCallback onClose;
  final VoidCallback onOpen;
  final Widget sidebar, child;
  const WorkspaceShell({
    super.key,
    required this.open,
    required this.reduceMotion,
    required this.sidebarWidth,
    required this.onClose,
    required this.onOpen,
    required this.sidebar,
    required this.child,
  });
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final mobile = box.maxWidth < 768;
      final width = sidebarWidth.clamp(0.0, box.maxWidth * (mobile ? .86 : 1));
      final dark = Theme.of(context).brightness == Brightness.dark;
      return PopScope(
        canPop: !open || !mobile,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop && open) onClose();
        },
        child: ColoredBox(
          color: dark ? const Color(0xff0e0f11) : const Color(0xfff8f8f8),
          child: ClipRect(
            child: TweenAnimationBuilder<double>(
              tween: Tween(end: open ? 1 : 0),
              duration: reduceMotion
                  ? Duration.zero
                  : Duration(milliseconds: mobile ? 500 : 300),
              curve: mobile ? const Cubic(.22, 1, .36, 1) : Curves.easeOut,
              builder: (context, progress, _) => Stack(
                children: [
                  Positioned(
                    top: mobile ? 0 : 8,
                    bottom: mobile ? 0 : 8,
                    left: mobile
                        ? width * progress
                        : 8 + (width + 8) * progress,
                    width: mobile
                        ? box.maxWidth
                        : (box.maxWidth - 16 - (width + 8) * progress).clamp(
                            0,
                            box.maxWidth,
                          ),
                    child: Container(
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(
                        color: Theme.of(context).scaffoldBackgroundColor,
                        borderRadius: mobile ? null : BorderRadius.circular(12),
                        border: mobile
                            ? null
                            : Border.all(
                                color: dark
                                    ? const Color(0xff374151)
                                    : const Color(0xffe5e5e5),
                              ),
                      ),
                      child: _SidebarSwipe(
                        enabled: mobile && !open,
                        onOpen: onOpen,
                        child: child,
                      ),
                    ),
                  ),
                  if (progress > 0)
                    Positioned(
                      top: mobile ? 0 : 8,
                      bottom: mobile ? 0 : 8,
                      left: mobile ? -(width + 24) * (1 - progress) : 8,
                      width: width,
                      child: IgnorePointer(
                        ignoring: !open,
                        child: Opacity(
                          opacity: progress,
                          child: Container(
                            decoration: BoxDecoration(
                              boxShadow: mobile
                                  ? const [
                                      BoxShadow(
                                        color: Color(0x290f172a),
                                        offset: Offset(16, 0),
                                        blurRadius: 40,
                                      ),
                                    ]
                                  : null,
                            ),
                            child: sidebar,
                          ),
                        ),
                      ),
                    ),
                  if (open && mobile)
                    Positioned(
                      top: 0,
                      bottom: 0,
                      left: width,
                      right: 0,
                      child: Semantics(
                        button: true,
                        label: '收起历史会话',
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: onClose,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      );
    },
  );
}

class _SidebarSwipe extends StatefulWidget {
  final bool enabled;
  final VoidCallback onOpen;
  final Widget child;
  const _SidebarSwipe({
    required this.enabled,
    required this.onOpen,
    required this.child,
  });
  @override
  State<_SidebarSwipe> createState() => _SidebarSwipeState();
}

class _SidebarSwipeState extends State<_SidebarSwipe> {
  double distance = 0;
  @override
  Widget build(BuildContext context) => GestureDetector(
    behavior: HitTestBehavior.translucent,
    onHorizontalDragStart: widget.enabled ? (_) => distance = 0 : null,
    onHorizontalDragUpdate: widget.enabled
        ? (event) => distance += event.delta.dx
        : null,
    onHorizontalDragEnd: widget.enabled
        ? (_) {
            if (distance >= 60) widget.onOpen();
            distance = 0;
          }
        : null,
    onHorizontalDragCancel: widget.enabled ? () => distance = 0 : null,
    child: widget.child,
  );
}
