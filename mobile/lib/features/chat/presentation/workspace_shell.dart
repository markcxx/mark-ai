import 'package:flutter/material.dart';

/// Mobile pushes the conversation with the finger; desktop keeps a fixed column.
class WorkspaceShell extends StatefulWidget {
  final bool open, reduceMotion;
  final double sidebarWidth;
  final VoidCallback onClose, onOpen;
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
  State<WorkspaceShell> createState() => _WorkspaceShellState();
}

class _WorkspaceShellState extends State<WorkspaceShell>
    with SingleTickerProviderStateMixin {
  late final AnimationController progress;
  bool dragging = false;
  @override
  void initState() {
    super.initState();
    progress = AnimationController(vsync: this, value: widget.open ? 1 : 0);
  }

  void settle(bool open) {
    dragging = false;
    final target = open ? 1.0 : 0.0;
    if (widget.reduceMotion || MediaQuery.disableAnimationsOf(context)) {
      progress.value = target;
    } else {
      progress.animateTo(
        target,
        duration: const Duration(milliseconds: 240),
        curve: Curves.easeOutCubic,
      );
    }
  }

  void finish(bool open) {
    settle(open);
    if (open != widget.open) {
      open ? widget.onOpen() : widget.onClose();
    }
  }

  @override
  void didUpdateWidget(WorkspaceShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.open != widget.open ||
        oldWidget.reduceMotion != widget.reduceMotion) {
      settle(widget.open);
    }
  }

  @override
  void dispose() {
    progress.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final mobile = box.maxWidth < 768;
      final width = widget.sidebarWidth.clamp(
        0.0,
        box.maxWidth * (mobile ? .86 : 1),
      );
      final dark = Theme.of(context).brightness == Brightness.dark;
      final systemEdges = MediaQuery.systemGestureInsetsOf(context);
      return PopScope(
        canPop: !widget.open || !mobile,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop && widget.open) finish(false);
        },
        child: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onHorizontalDragStart: mobile && width > 0
              ? (event) {
                  // Leave the OS edge-back region alone. Child horizontal scrollables
                  // win their own gesture arena before this ancestor.
                  final x = event.localPosition.dx;
                  dragging =
                      x > systemEdges.left &&
                      x < box.maxWidth - systemEdges.right;
                  if (dragging) progress.stop();
                }
              : null,
          onHorizontalDragUpdate: mobile
              ? (event) {
                  if (dragging) {
                    progress.value = (progress.value + event.delta.dx / width)
                        .clamp(0.0, 1.0);
                  }
                }
              : null,
          onHorizontalDragEnd: mobile
              ? (event) {
                  if (!dragging) return;
                  final speed = event.primaryVelocity ?? 0;
                  finish(speed.abs() > 600 ? speed > 0 : progress.value > .5);
                }
              : null,
          onHorizontalDragCancel: mobile
              ? () {
                  if (dragging) settle(widget.open);
                }
              : null,
          child: ColoredBox(
            color: dark ? const Color(0xff0e0f11) : const Color(0xfff8f8f8),
            child: ClipRect(
              child: AnimatedBuilder(
                animation: progress,
                builder: (context, _) {
                  final value = progress.value;
                  return Stack(
                    children: [
                      Positioned(
                        top: mobile ? 0 : 8,
                        bottom: mobile ? 0 : 8,
                        left: mobile ? width * value : 8 + (width + 8) * value,
                        width: mobile
                            ? box.maxWidth
                            : (box.maxWidth - 16 - (width + 8) * value).clamp(
                                0,
                                box.maxWidth,
                              ),
                        child: Container(
                          key: const ValueKey('workspace-main-panel'),
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(
                            color: Theme.of(context).scaffoldBackgroundColor,
                            borderRadius: mobile
                                ? null
                                : BorderRadius.circular(12),
                            border: mobile
                                ? null
                                : Border.all(
                                    color: dark
                                        ? const Color(0xff374151)
                                        : const Color(0xffe5e5e5),
                                  ),
                          ),
                          child: widget.child,
                        ),
                      ),
                      if (value > 0)
                        Positioned(
                          top: mobile ? 0 : 8,
                          bottom: mobile ? 0 : 8,
                          left: mobile ? -width * (1 - value) : 8,
                          width: width,
                          child: IgnorePointer(
                            ignoring: !widget.open,
                            child: Container(
                              decoration: BoxDecoration(
                                boxShadow: mobile
                                    ? const [
                                        BoxShadow(
                                          color: Color(0x29000000),
                                          offset: Offset(12, 0),
                                          blurRadius: 32,
                                        ),
                                      ]
                                    : null,
                              ),
                              child: widget.sidebar,
                            ),
                          ),
                        ),
                      if (value > 0 && mobile)
                        Positioned(
                          top: 0,
                          bottom: 0,
                          left: width * value,
                          right: 0,
                          child: Semantics(
                            button: true,
                            label: '收起历史会话',
                            child: GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () => finish(false),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      );
    },
  );
}
