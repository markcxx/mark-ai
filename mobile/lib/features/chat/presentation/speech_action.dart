import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/ui_icon.dart';
import '../application/speech_playback.dart';
import '../../settings/default_settings.dart';
import 'tool_call_block.dart' show ToolSpinner;

class SpeechAction extends StatelessWidget {
  final SpeechPlayback playback;
  final VoidCallback onPressed;
  final Widget Function(String label, IconData icon, VoidCallback onPressed)
  builder;
  const SpeechAction({
    super.key,
    required this.playback,
    required this.onPressed,
    required this.builder,
  });
  @override
  Widget build(BuildContext context) => builder(
    switch (playback.state) {
      SpeechState.loading => '停止生成语音',
      SpeechState.playing => '暂停朗读',
      SpeechState.paused => '继续朗读',
      SpeechState.ended => '重新播放',
      SpeechState.idle => '语音朗读',
    },
    switch (playback.state) {
      SpeechState.playing => LucideIcons.pause,
      SpeechState.paused || SpeechState.ended => LucideIcons.play,
      _ => LucideIcons.volume2,
    },
    onPressed,
  );
}

class MessageAudioPlayer extends StatelessWidget {
  final SpeechPlayback playback;
  const MessageAudioPlayer({super.key, required this.playback});
  String time(Duration d) =>
      '${d.inSeconds ~/ 60}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
  @override
  Widget build(BuildContext context) {
    final p = playback, dark = Theme.of(context).brightness == Brightness.dark;
    if (p.state == SpeechState.idle) return const SizedBox.shrink();
    final loading = p.state == SpeechState.loading;
    final voice = p.voice == '__system__'
        ? '系统默认音色'
        : speechVoices
                  .where((v) => v['value'] == p.voice)
                  .firstOrNull?['label'] ??
              p.voice;
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      constraints: const BoxConstraints(maxWidth: 576),
      decoration: BoxDecoration(
        color: dark ? const Color(0x0affffff) : const Color(0xccf9fafb),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: dark ? const Color(0x1affffff) : const Color(0xffe5e7eb),
        ),
      ),
      child: Row(
        children: [
          Tooltip(
            message: loading
                ? '正在生成语音'
                : p.state == SpeechState.ended
                ? '重新播放'
                : p.state == SpeechState.playing
                ? '暂停'
                : '播放',
            child: Material(
              color: dark ? const Color(0xfff3f4f6) : const Color(0xff111827),
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: loading ? null : () => p.toggle(p.content, p.voice),
                child: SizedBox(
                  width: 40,
                  height: 40,
                  child: Center(
                    child: loading
                        ? ToolSpinner(
                            size: 16,
                            color: dark
                                ? const Color(0xff111827)
                                : Colors.white,
                          )
                        : UiIcon(
                            p.state == SpeechState.ended
                                ? LucideIcons.rotateCcw
                                : p.state == SpeechState.playing
                                ? LucideIcons.pause
                                : LucideIcons.play,
                            size: 15,
                            color: dark
                                ? const Color(0xff111827)
                                : Colors.white,
                          ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const UiIcon(
                            LucideIcons.audioLines,
                            size: 14,
                            color: Color(0xff9ca3af),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              loading ? '正在生成语音' : voice,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                height: 16 / 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      '${p.chunkCount > 1 ? '${p.chunkIndex}/${p.chunkCount} · ' : ''}${time(p.position)} / ${time(p.duration)}',
                      style: const TextStyle(
                        fontSize: 12,
                        height: 16 / 12,
                        color: Color(0xff9ca3af),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(100),
                  child: LinearProgressIndicator(
                    stopIndicatorColor: Colors.transparent,
                    trackGap: 0,
                    minHeight: 4,
                    value: p.duration.inMilliseconds > 0
                        ? (p.position.inMilliseconds /
                                  p.duration.inMilliseconds)
                              .clamp(0, 1)
                        : 0,
                    color: dark
                        ? const Color(0xffd1d5db)
                        : const Color(0xff374151),
                    backgroundColor: dark
                        ? const Color(0x1affffff)
                        : const Color(0xffe5e7eb),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          ActionIcon(
            '关闭语音播放器',
            LucideIcons.x,
            p.stop,
            buttonWidth: 40,
            buttonHeight: 40,
            iconSize: 15,
          ),
        ],
      ),
    );
  }
}
