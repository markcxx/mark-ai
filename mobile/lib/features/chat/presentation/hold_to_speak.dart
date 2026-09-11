import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/ui_icon.dart';
import '../application/voice_input_controller.dart';

class HoldToSpeak extends StatefulWidget {
  final Widget child;
  final bool enabled;
  final String contextKey;
  final VoidCallback onStart;
  final ValueChanged<String> onText, onError;
  final SpeechInputBackend? backend;
  const HoldToSpeak({
    super.key,
    required this.child,
    required this.enabled,
    required this.contextKey,
    required this.onStart,
    required this.onText,
    required this.onError,
    this.backend,
  });

  @override
  State<HoldToSpeak> createState() => _HoldToSpeakState();
}

class _HoldToSpeakState extends State<HoldToSpeak> with WidgetsBindingObserver {
  VoiceInputController? voice;
  OverlayEntry? overlay;
  bool wasArmed = false;
  Timer? holdTimer;
  int? pointer;
  Offset origin = Offset.zero;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didUpdateWidget(HoldToSpeak oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.enabled || oldWidget.contextKey != widget.contextKey) {
      holdTimer?.cancel();
      pointer = null;
      // didUpdateWidget runs during build; remove the overlay after this frame.
      if (voice?.active == true) {
        voice!.removeListener(changed);
        voice!.cancel();
        voice!.addListener(changed);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) changed();
        });
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      holdTimer?.cancel();
      pointer = null;
      voice?.cancel();
    }
  }

  void changed() {
    if (!mounted) return;
    if (voice!.cancelArmed != wasArmed) {
      wasArmed = voice!.cancelArmed;
      unawaited(HapticFeedback.selectionClick());
    }
    if (!voice!.active) {
      overlay?.remove();
      overlay?.dispose();
      overlay = null;
    } else {
      overlay?.markNeedsBuild();
    }
    setState(() {});
  }

  void start() {
    if (!widget.enabled || pointer == null) return;
    widget.onStart();
    voice ??= VoiceInputController(
      backend: widget.backend ?? AndroidSpeechInput(),
      onText: (text) {
        if (mounted && widget.enabled) widget.onText(text);
      },
      onError: (message) {
        if (mounted) widget.onError(message);
      },
    )..addListener(changed);
    if (voice!.active) return;
    final theme = Theme.of(context);
    overlay = OverlayEntry(
      builder: (_) => Theme(
        data: theme,
        child: VoiceInputOverlay(voice: voice!),
      ),
    );
    Overlay.of(context, rootOverlay: true).insert(overlay!);
    unawaited(HapticFeedback.lightImpact());
    unawaited(voice!.start());
  }

  @override
  void dispose() {
    holdTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    voice?.removeListener(changed);
    voice?.dispose();
    overlay?.remove();
    overlay?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: voice?.active != true,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) voice?.cancel();
    },
    child: Listener(
      behavior: HitTestBehavior.translucent,
      // A TextField owns its long-press recognizer, so observe the pointer
      // directly without taking away normal taps or text-selection gestures.
      onPointerDown: (event) {
        if (!widget.enabled) return;
        if (pointer != null) {
          holdTimer?.cancel();
          pointer = null;
          voice?.cancel();
          return;
        }
        pointer = event.pointer;
        origin = event.position;
        holdTimer = Timer(const Duration(milliseconds: 450), start);
      },
      onPointerMove: (event) {
        if (event.pointer != pointer) return;
        final offset = event.position - origin;
        if (voice?.active == true) {
          voice!.move(offset.dy);
        } else if (offset.distance > 18) {
          holdTimer?.cancel();
          pointer = null;
        }
      },
      onPointerUp: (event) {
        if (event.pointer != pointer) return;
        holdTimer?.cancel();
        pointer = null;
        unawaited(voice?.release());
      },
      onPointerCancel: (event) {
        if (event.pointer != pointer) return;
        holdTimer?.cancel();
        pointer = null;
        voice?.cancel();
      },
      child: ExcludeFocus(
        excluding: voice?.active == true,
        child: widget.child,
      ),
    ),
  );
}

class VoiceInputOverlay extends StatelessWidget {
  final VoiceInputController voice;
  const VoiceInputOverlay({super.key, required this.voice});
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final color = voice.cancelArmed ? colors.error : colors.primary;
    final label = voice.cancelArmed
        ? '松手取消'
        : switch (voice.phase) {
            VoiceInputPhase.starting => '正在启动麦克风…',
            VoiceInputPhase.finishing => '正在识别，上滑取消',
            VoiceInputPhase.ready => '识别完成，松手发送，上滑取消',
            _ => '松手发送，上滑取消',
          };
    return Positioned.fill(
      child: Material(
        type: MaterialType.transparency,
        child: Stack(
          children: [
            const ModalBarrier(dismissible: false, color: Colors.transparent),
            Align(
              alignment: Alignment.bottomCenter,
              child: AnimatedContainer(
                key: const ValueKey('voice-input-overlay'),
                duration: MediaQuery.disableAnimationsOf(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 180),
                width: double.infinity,
                padding: EdgeInsets.fromLTRB(
                  24,
                  72,
                  24,
                  MediaQuery.paddingOf(context).bottom + 24,
                ),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      colors.surface.withValues(alpha: 0),
                      colors.surface,
                      Color.alphaBlend(
                        color.withValues(alpha: .14),
                        colors.surface,
                      ),
                    ],
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (voice.text.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 20),
                        child: Text(
                          voice.text,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 17,
                            color: colors.onSurface,
                          ),
                        ),
                      ),
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        label,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 15,
                          color: voice.cancelArmed
                              ? color
                              : colors.onSurfaceVariant,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      height: 64,
                      width: double.infinity,
                      child: CustomPaint(
                        painter: VoiceWavePainter(List.of(voice.levels), color),
                      ),
                    ),
                    const SizedBox(height: 12),
                    IconButton(
                      tooltip: '取消语音输入',
                      onPressed: voice.cancel,
                      icon: UiIcon(LucideIcons.x, color: colors.onSurfaceVariant),
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

class VoiceWavePainter extends CustomPainter {
  final List<double> levels;
  final Color color;
  VoiceWavePainter(this.levels, this.color);
  @override
  void paint(Canvas canvas, Size size) {
    final gap = size.width / levels.length;
    final paint = Paint()
      ..color = color
      ..strokeWidth = (gap * .42).clamp(2.0, 4.0)
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < levels.length; i++) {
      final height = 3 + levels[i] * (size.height - 8);
      canvas.drawLine(
        Offset((i + .5) * gap, (size.height - height) / 2),
        Offset((i + .5) * gap, (size.height + height) / 2),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(VoiceWavePainter oldDelegate) => true;
}
