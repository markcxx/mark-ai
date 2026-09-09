import 'dart:async';
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/api_client.dart';
import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/ui_icon.dart';

class SpeechAction extends StatefulWidget {
  final ApiClient api;
  final bool menu;
  final String content;
  final void Function(Object) onError;
  final Widget Function(String label, IconData icon, VoidCallback onPressed)?
  builder;
  const SpeechAction({
    super.key,
    required this.api,
    this.menu = false,
    required this.content,
    required this.onError,
    this.builder,
  });
  @override
  State<SpeechAction> createState() => _SpeechActionState();
}

class _SpeechActionState extends State<SpeechAction> {
  static _SpeechActionState? current;
  AudioPlayer? _player;
  AudioPlayer get player => _player ??= AudioPlayer();
  CancelToken? cancel;
  bool playing = false;
  bool paused = false, loading = false, ended = false;
  Future<void> stop() async {
    cancel?.cancel();
    await player.stop();
    if (mounted) {
      setState(() {
        playing = false;
        paused = false;
        loading = false;
      });
    }
  }

  Future<void> play() async {
    if (playing) {
      if (loading) {
        await stop();
        return;
      }
      if (paused) {
        await player.resume();
      } else {
        await player.pause();
      }
      if (mounted) setState(() => paused = !paused);
      return;
    }
    await current?.stop();
    current = this;
    final token = CancelToken();
    cancel = token;
    if (!mounted) return;
    setState(() {
      playing = true;
      loading = true;
      ended = false;
    });
    try {
      final text = widget.content
          .replaceAll(RegExp(r'```[\s\S]*?```'), ' ')
          .replaceAll(RegExp(r'[#*_>`]'), '');
      final runes = text.runes.toList();
      for (
        var start = 0;
        start < runes.length && !token.isCancelled;
        start += 600
      ) {
        final chunk = String.fromCharCodes(
          runes.sublist(start, (start + 600).clamp(0, runes.length)),
        );
        final audio = await widget.api.raw(
          'POST',
          '/api/speech',
          body: {'content': chunk},
          cancel: token,
          type: ResponseType.bytes,
        );
        if (token.isCancelled) break;
        if (mounted) setState(() => loading = false);
        final done = player.onPlayerComplete.first;
        await player.play(
          BytesSource(Uint8List.fromList((audio.data as List).cast<int>())),
        );
        await Future.any([done, token.whenCancel]);
        if (mounted && !token.isCancelled) setState(() => loading = true);
      }
    } catch (e) {
      if (!token.isCancelled) widget.onError(e);
    } finally {
      if (mounted) {
        setState(() {
          playing = false;
          loading = false;
          paused = false;
          ended = !token.isCancelled;
        });
      }
    }
  }

  @override
  void dispose() {
    if (identical(current, this)) current = null;
    cancel?.cancel();
    _player?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder != null
      ? widget.builder!(
          loading
              ? '停止生成语音'
              : playing
              ? (paused ? '继续朗读' : '暂停朗读')
              : ended
              ? '重新播放'
              : '语音朗读',
          playing && !paused && !loading
              ? LucideIcons.pause
              : paused || ended
              ? LucideIcons.play
              : LucideIcons.volume2,
          play,
        )
      : widget.menu
      ? MenuItemButton(
          onPressed: play,
          leadingIcon: UiIcon(
            markaiIcon(playing ? Icons.stop : Icons.volume_up_outlined),
            size: 16,
          ),
          child: Text(playing ? '停止朗读' : '朗读'),
        )
      : MessageAction(
          playing ? '停止朗读' : '朗读',
          playing ? Icons.stop : Icons.volume_up_outlined,
          play,
        );
}
