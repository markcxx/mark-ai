import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../shared/widgets/agent_avatar.dart';
import '../../shared/widgets/common.dart';
import '../chat/application/workspace_controller.dart';

/// A finite greeting, independent of network timing. The application waits for
/// both this sequence and workspace initialization before revealing chat.
class StartupScreen extends StatefulWidget {
  static const introDuration = Duration(milliseconds: 3400);
  final WorkspaceController controller;
  final VoidCallback? onIntroComplete;
  const StartupScreen({
    super.key,
    required this.controller,
    this.onIntroComplete,
  });

  @override
  State<StartupScreen> createState() => _StartupScreenState();
}

class _StartupScreenState extends State<StartupScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController timeline =
      AnimationController(vsync: this, duration: StartupScreen.introDuration)
        ..addStatusListener((status) {
          if (status == AnimationStatus.completed) finish();
        });
  bool assetsReady = false, avatarAvailable = true, completed = false;
  bool reduceMotion = false, dependenciesReady = false;
  bool suspended = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    assetsReady = AgentAvatar.isPreloaded;
    if (assetsReady) return;
    AgentAvatar.preload()
        .timeout(const Duration(seconds: 2))
        .then(
          (_) {
            if (!mounted) return;
            setState(() => assetsReady = true);
            start();
          },
          onError: (Object _) {
            if (!mounted) return;
            setState(() {
              assetsReady = true;
              avatarAvailable = false;
            });
            start();
          },
        );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final nextReduce = MediaQuery.disableAnimationsOf(context);
    final changed = nextReduce != reduceMotion;
    reduceMotion = nextReduce;
    dependenciesReady = true;
    if (changed && reduceMotion && timeline.isAnimating) {
      timeline.stop();
      // Accessibility settings can arrive during initialization. Finish the
      // stationary greeting without replaying a moving sequence.
      timeline.animateTo(1, duration: const Duration(milliseconds: 400));
    } else {
      start();
    }
  }

  void start() {
    if (!assetsReady ||
        !dependenciesReady ||
        suspended ||
        completed ||
        timeline.isAnimating) {
      return;
    }
    timeline.duration = reduceMotion
        ? const Duration(milliseconds: 400)
        : StartupScreen.introDuration;
    timeline.forward();
  }

  void finish() {
    if (completed) return;
    setState(() => completed = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onIntroComplete?.call();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    suspended = state != AppLifecycleState.resumed;
    if (suspended) {
      timeline.stop();
    } else {
      start();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    timeline.dispose();
    super.dispose();
  }

  double interval(
    double t,
    double begin,
    double end, [
    Curve curve = Curves.easeOutCubic,
  ]) => curve.transform(((t - begin) / (end - begin)).clamp(0.0, 1.0));

  Widget reveal({required double amount, required Widget child}) => Opacity(
    opacity: amount,
    child: Transform.translate(
      offset: Offset(0, reduceMotion ? 0 : 12 * (1 - amount)),
      child: child,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final scheme = Theme.of(context).colorScheme;
    final muted = Theme.of(context).brightness == Brightness.dark
        ? const Color(0xff9ca3af)
        : const Color(0xff6b7280);
    return Scaffold(
      body: SafeArea(
        child: AnimatedBuilder(
          animation: timeline,
          builder: (context, _) {
            final t = timeline.value;
            final visibleT = reduceMotion ? 1.0 : t;
            final arrival = interval(visibleT, 0, .23, Curves.easeOutBack);
            final float = math.sin(
              interval(visibleT, .34, .80, Curves.linear) * math.pi,
            );
            final settle = math.sin(
              interval(visibleT, .80, 1, Curves.linear) * math.pi,
            );
            final scale = reduceMotion
                ? 1.0
                : .56 + .44 * arrival + .07 * float - .025 * settle;
            final y = reduceMotion
                ? 0.0
                : 48 * (1 - arrival) - 16 * float + 4 * settle;
            final tilt = reduceMotion
                ? 0.0
                : -.16 * (1 - arrival) -
                      .07 *
                          math.sin(
                            interval(t, .38, .86, Curves.linear) * math.pi * 2,
                          );
            final animation = t < .40
                ? AvatarAnimation.swirl
                : t < .87
                ? AvatarAnimation.wink
                : AvatarAnimation.idle;
            final progress = t < .40
                ? t / .40
                : t < .87
                ? (t - .40) / .47
                : (t - .87) * .425;
            final status = c.startupFailed
                ? '暂时无法连接，请检查网络后重试。'
                : completed && !c.connected
                ? '正在连接你的工作空间…'
                : completed
                ? '一起开始吧'
                : t < .42
                ? '正在唤醒你的 AI 搭档'
                : '很高兴见到你';
            return LayoutBuilder(
              builder: (context, box) => SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: box.maxHeight),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Brand(size: 28),
                            SizedBox(width: 9),
                            Text(
                              'MarkAI',
                              style: TextStyle(
                                fontFamily: 'Plus Jakarta Sans',
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -.5,
                              ),
                            ),
                          ],
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 28),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SizedBox(
                                width: 248,
                                height: 232,
                                child: Stack(
                                  alignment: Alignment.center,
                                  children: [
                                    Positioned(
                                      bottom: 19,
                                      child: Opacity(
                                        opacity:
                                            interval(visibleT, .04, .26) *
                                            (1 - float * .35),
                                        child: Container(
                                          width: 84 - float * 15,
                                          height: 7,
                                          decoration: BoxDecoration(
                                            color: scheme.onSurface.withValues(
                                              alpha: .035,
                                            ),
                                            borderRadius: BorderRadius.circular(
                                              100,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: scheme.onSurface
                                                    .withValues(alpha: .04),
                                                blurRadius: 12,
                                                spreadRadius: 3,
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                    Transform.translate(
                                      offset: Offset(0, y),
                                      child: Transform.rotate(
                                        angle: tilt,
                                        child: Transform.scale(
                                          scale: scale,
                                          child: Opacity(
                                            opacity: interval(visibleT, 0, .10),
                                            child: RepaintBoundary(
                                              child:
                                                  avatarAvailable && assetsReady
                                                  ? AgentAvatar(
                                                      size: 208,
                                                      animation: animation,
                                                      progress: progress.clamp(
                                                        0.0,
                                                        1.0,
                                                      ),
                                                    )
                                                  : const SizedBox(
                                                      width: 208,
                                                      height: 208,
                                                    ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 12),
                              reveal(
                                amount: interval(visibleT, .12, .32),
                                child: const Text(
                                  '你好，我是 MarkAI',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 25,
                                    fontWeight: FontWeight.w600,
                                    height: 1.4,
                                    letterSpacing: -.5,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),
                              reveal(
                                amount: interval(visibleT, .25, .46),
                                child: Text(
                                  '让每一个想法，都有回应。',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 14,
                                    height: 1.6,
                                    color: muted,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 36),
                              Semantics(
                                liveRegion: completed || c.startupFailed,
                                child: AnimatedSwitcher(
                                  duration: Duration(
                                    milliseconds: reduceMotion ? 0 : 220,
                                  ),
                                  child: Text(
                                    status,
                                    key: ValueKey(status),
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 12,
                                      height: 1.6,
                                      color: muted,
                                    ),
                                  ),
                                ),
                              ),
                              if (c.startupFailed) ...[
                                const SizedBox(height: 16),
                                FilledButton(
                                  onPressed: () => c.start(),
                                  child: const Text('重试'),
                                ),
                              ] else ...[
                                const SizedBox(height: 14),
                                SizedBox(
                                  width: 32,
                                  height: 4,
                                  child: Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: List.generate(
                                      3,
                                      (i) => Container(
                                        width: 4,
                                        height: 4,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: scheme.onSurface.withValues(
                                            alpha:
                                                (visibleT * 3).floor().clamp(
                                                      0,
                                                      2,
                                                    ) ==
                                                    i
                                                ? .5
                                                : .12,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        Text(
                          '对话 · 灵感 · 创造',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 11,
                            letterSpacing: 2,
                            color: muted.withValues(alpha: .7),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
