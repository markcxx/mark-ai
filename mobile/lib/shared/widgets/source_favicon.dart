import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/chat.dart';
import 'ui_icon.dart';

class SourceFavicon extends StatelessWidget {
  final Json citation;
  final double size;
  const SourceFavicon({super.key, required this.citation, this.size = 20});
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final favicon = citation['favicon'] as String?;
    final domain =
        Uri.tryParse(citation['url'] as String? ?? '')?.host
            .replaceFirst(RegExp(r'^www\.'), '') ??
        '';
    final uri = Uri.tryParse(favicon ?? '');
    final url = uri != null && ['http', 'https'].contains(uri.scheme)
        ? favicon!
        : 'https://icons.duckduckgo.com/ip3/${Uri.encodeComponent(favicon ?? domain)}.ico';
    Widget fallback() => Center(
      child: UiIcon(
        LucideIcons.globe,
        size: (size - 5).clamp(10, size),
        color: const Color(0xff9ca3af),
      ),
    );
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: dark ? const Color(0xff252525) : Colors.white,
        boxShadow: [
          BoxShadow(
            color: dark ? const Color(0x26ffffff) : const Color(0xffe5e7eb),
            spreadRadius: 1,
          ),
        ],
      ),
      child: ClipOval(
        child: Padding(
          padding: const EdgeInsets.all(2),
          child: Image.network(
            url,
            fit: BoxFit.contain,
            errorBuilder: (_, _, _) => fallback(),
          ),
        ),
      ),
    );
  }
}
