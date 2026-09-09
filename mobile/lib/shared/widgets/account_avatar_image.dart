import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../../features/previews/file_service.dart';

class AccountAvatarImage extends StatefulWidget {
  final ApiClient api;
  final String url;
  final double size;
  final Widget fallback;
  const AccountAvatarImage({
    super.key,
    required this.api,
    required this.url,
    required this.size,
    required this.fallback,
  });
  @override
  State<AccountAvatarImage> createState() => _AccountAvatarImageState();
}

class _AccountAvatarImageState extends State<AccountAvatarImage> {
  Future<Uint8List>? bytes;
  Uri? remote;
  void load() {
    bytes = null;
    remote = null;
    if (widget.url.isEmpty) return;
    final base = Uri.tryParse(widget.api.baseUrl);
    if (base == null || !base.hasAuthority) return;
    final uri = base.resolve(widget.url);
    if (!['http', 'https'].contains(uri.scheme)) return;
    final id = RegExp(r'^/api/files/([^/]+)/(?:preview|download)$')
        .firstMatch(uri.path)
        ?.group(1);
    if (uri.origin == base.origin && id != null) {
      bytes = FileService(widget.api).bytes({'id': id});
    } else if (uri.origin != base.origin) {
      // Public object storage / OAuth avatars receive no application cookies.
      remote = uri;
    }
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void didUpdateWidget(covariant AccountAvatarImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url || oldWidget.api != widget.api) load();
  }

  @override
  Widget build(BuildContext context) => ClipOval(
    child: SizedBox(
      width: widget.size,
      height: widget.size,
      child: remote != null
          ? Image.network(
              remote.toString(),
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => widget.fallback,
            )
          : bytes == null
          ? Center(child: widget.fallback)
          : FutureBuilder<Uint8List>(
              future: bytes,
              builder: (_, snapshot) => snapshot.hasData
                  ? Image.memory(
                      snapshot.data!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => widget.fallback,
                    )
                  : Center(child: widget.fallback),
            ),
    ),
  );
}
