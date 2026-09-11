import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class SharedFile {
  final String name, path;
  const SharedFile(this.name, this.path);
}

class IncomingShare {
  final String id, text, error;
  final List<SharedFile> files;
  const IncomingShare({
    required this.id,
    this.text = '',
    this.error = '',
    this.files = const [],
  });
  factory IncomingShare.fromMap(Map<dynamic, dynamic> map) => IncomingShare(
    id: map['id'] as String,
    text: map['text'] as String? ?? '',
    error: map['error'] as String? ?? '',
    files: (map['files'] as List? ?? [])
        .map((f) => SharedFile(f['name'] as String, f['path'] as String))
        .toList(),
  );
}

class IncomingShareInbox extends ChangeNotifier {
  final MethodChannel channel;
  IncomingShareInbox({
    this.channel = const MethodChannel('markai/incoming_shares'),
  });
  List<IncomingShare> _items = [];
  final _consumed = <String>{};
  List<IncomingShare> get items =>
      _items.where((s) => !_consumed.contains(s.id)).toList();
  bool _disposed = false, _loading = false, _again = false;
  String? error;
  void start() {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    channel.setMethodCallHandler((call) async {
      if (call.method == 'changed') await refresh();
    });
    unawaited(refresh());
  }

  Future<void> refresh() async {
    if (_loading) {
      _again = true;
      return;
    }
    _loading = true;
    do {
      _again = false;
      try {
        final values = await channel.invokeListMethod<dynamic>('list');
        if (_disposed) return;
        _items = (values ?? [])
            .map((v) => IncomingShare.fromMap(v as Map))
            .toList();
        error = null;
      } on MissingPluginException {
        // Non-Android test hosts have no share intent bridge.
      } catch (_) {
        error = '读取分享内容失败，点击重试';
      }
      if (!_disposed) notifyListeners();
    } while (_again && !_disposed);
    _loading = false;
  }

  Future<void> remove(IncomingShare share) async {
    await channel.invokeMethod<void>('remove', {'id': share.id});
    _consumed.add(share.id);
    _items.removeWhere((s) => s.id == share.id);
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    channel.setMethodCallHandler(null);
    super.dispose();
  }
}
