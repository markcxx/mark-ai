import 'package:markai_mobile/shared/widgets/ui_icon.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

class ThinkingPanel extends StatefulWidget {
  final String content, display;
  final bool active;
  final num duration;
  final Widget child;
  const ThinkingPanel({
    super.key,
    required this.content,
    required this.display,
    required this.active,
    required this.duration,
    required this.child,
  });
  @override
  State<ThinkingPanel> createState() => _ThinkingPanelState();
}

class _ThinkingPanelState extends State<ThinkingPanel>
    with SingleTickerProviderStateMixin {
  bool showDetail = false;
  final scroll = ScrollController();
  late final AnimationController spin = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 2),
  );
  @override
  void initState() {
    super.initState();
    showDetail =
        widget.display == 'expanded' ||
        (widget.display == 'auto' && widget.active);
  }

  @override
  void didUpdateWidget(covariant ThinkingPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && widget.content != oldWidget.content) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && scroll.hasClients) {
          scroll.jumpTo(scroll.position.maxScrollExtent);
        }
      });
    }
  }

  @override
  void dispose() {
    scroll.dispose();
    spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active && widget.content.trim().isEmpty) {
      spin.stop();
      return const SizedBox.shrink();
    }
    final expanded =
        showDetail ||
        widget.display == 'expanded' ||
        (widget.display == 'auto' && widget.active);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    if (widget.active && !reduceMotion) {
      if (!spin.isAnimating) spin.repeat();
    } else {
      spin.stop();
    }
    final highlighted = expanded && !widget.active;
    final title = widget.active
        ? '正在深度思考...'
        : widget.duration > 0
        ? '已深度思考 (${(widget.duration / 1000).toStringAsFixed(1)} 秒)'
        : '已深度思考';
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: () => setState(() => showDetail = !showDetail),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: highlighted
                          ? (dark
                                ? const Color(0x4d581c87)
                                : const Color(0xfffaf5ff))
                          : (dark ? const Color(0xff1f2937) : Colors.white),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: highlighted
                            ? (dark
                                  ? const Color(0xff6b21a8)
                                  : const Color(0xffe9d5ff))
                            : (dark
                                  ? const Color(0xff4b5563)
                                  : const Color(0xffe5e7eb)),
                      ),
                    ),
                    child: Center(
                      child: RotationTransition(
                        turns: widget.active
                            ? Tween<double>(begin: 0, end: 2).animate(spin)
                            : const AlwaysStoppedAnimation(0),
                        child: UiIcon(
                          widget.active
                              ? LucideIcons.loaderCircle
                              : LucideIcons.atom,
                          size: 14,
                          color: highlighted
                              ? (dark
                                    ? const Color(0xffc084fc)
                                    : const Color(0xffa855f7))
                              : const Color(0xff9ca3af),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  AnimatedBuilder(
                    animation: spin,
                    builder: (context, child) => widget.active
                        ? Opacity(
                            opacity: reduceMotion
                                ? 1
                                : 1 - .5 * (1 - (spin.value * 2 - 1).abs()),
                            child: ShaderMask(
                              blendMode: BlendMode.srcIn,
                              shaderCallback: (rect) => LinearGradient(
                                colors: [
                                  const Color(0xff9ca3af),
                                  dark
                                      ? const Color(0xffe5e7eb)
                                      : const Color(0xff4b5563),
                                  const Color(0xff9ca3af),
                                ],
                              ).createShader(rect),
                              child: child,
                            ),
                          )
                        : child!,
                    child: Text(
                      title,
                      style: TextStyle(
                        fontSize: 14,
                        height: 20 / 14,
                        color: dark
                            ? const Color(0xff9ca3af)
                            : const Color(0xff6b7280),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  AnimatedRotation(
                    turns: expanded ? -.5 : 0,
                    duration: reduceMotion
                        ? Duration.zero
                        : const Duration(milliseconds: 150),
                    child: const UiIcon(
                      LucideIcons.chevronDown,
                      size: 14,
                      color: Color(0xff9ca3af),
                    ),
                  ),
                ],
              ),
            ),
          ),
          _ReasoningSize(
            child: expanded
                ? Container(
                    margin: const EdgeInsets.only(top: 4),
                    constraints: BoxConstraints(
                      maxHeight: (MediaQuery.sizeOf(context).height * .4).clamp(
                        0,
                        320,
                      ),
                    ),
                    child: ShaderMask(
                      shaderCallback: (rect) => LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Colors.white,
                          Colors.white,
                          Colors.transparent,
                        ],
                        stops: [
                          0,
                          (12 / rect.height).clamp(0, .5),
                          (1 - 18 / rect.height).clamp(.5, 1),
                          1,
                        ],
                      ).createShader(rect),
                      blendMode: BlendMode.dstIn,
                      child: SingleChildScrollView(
                        controller: scroll,
                        padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                        child: widget.child,
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

class _ReasoningSize extends StatelessWidget {
  final Widget child;
  const _ReasoningSize({required this.child});
  @override
  Widget build(BuildContext context) => MediaQuery.disableAnimationsOf(context)
      ? child
      : AnimatedSize(
          alignment: Alignment.topLeft,
          curve: Curves.easeOut,
          duration: const Duration(milliseconds: 200),
          child: child,
        );
}
