import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/app_dialog.dart';

Uri? publicWebImageUri(dynamic value) {
  if (value is! String || value.length > 4096) return null;
  final uri = Uri.tryParse(value);
  if (uri == null ||
      !['http', 'https'].contains(uri.scheme) ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty) {
    return null;
  }
  final host = uri.host.toLowerCase();
  if (host.contains(':') ||
      RegExp(
        r'^(localhost(?:\.|$)|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)',
      ).hasMatch(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.localhost') ||
      (RegExp(r'^\d+\.').hasMatch(host) &&
          (int.tryParse(host.split('.').first) ?? 0) >= 224)) {
    return null;
  }
  return uri;
}

class WebImageGallery extends StatelessWidget {
  final List<Json> images;
  const WebImageGallery({super.key, required this.images});

  Future<void> openSource(BuildContext context, Json image) async {
    final uri =
        publicWebImageUri(image['sourceUrl']) ??
        publicWebImageUri(image['url']);
    if (uri == null) return;
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) &&
        context.mounted) {
      ScaffoldMessenger.maybeOf(context)
          ?.showSnackBar(const SnackBar(content: Text('无法打开来源，请稍后重试')));
    }
  }

  Widget picture(Json image, {BoxFit fit = BoxFit.cover}) => Image.network(
    image['url'] as String,
    fit: fit,
    // Public images never receive the API client's cookies or authentication headers.
    errorBuilder: (_, _, _) => const Center(
      child: Padding(
        padding: EdgeInsets.all(8),
        child: Text('图片暂不可用', style: TextStyle(fontSize: 12)),
      ),
    ),
    loadingBuilder: (_, child, progress) => progress == null
        ? child
        : const ColoredBox(color: Color(0x11777777), child: SizedBox.expand()),
  );

  @override
  Widget build(BuildContext context) {
    final safe = images
        .where((image) => publicWebImageUri(image['url']) != null)
        .take(6)
        .toList();
    if (safe.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final count = constraints.maxWidth > 560 ? 3 : 2;
          final width = (constraints.maxWidth - (count - 1) * 8) / count;
          return Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final image in safe)
                SizedBox(
                  width: width,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Semantics(
                      button: true,
                      label: '查看图片 ${image['title'] ?? ''}',
                      child: InkWell(
                        onTap: () => showAppDialog(
                          context,
                          (dialogContext) => AppDialog(
                            title: image['title'] as String? ?? '网页图片',
                            height:
                                MediaQuery.sizeOf(dialogContext).height * .82,
                            scrollBody: false,
                            child: Column(
                              children: [
                                Expanded(
                                  child: InteractiveViewer(
                                    minScale: .5,
                                    maxScale: 5,
                                    child: picture(image, fit: BoxFit.contain),
                                  ),
                                ),
                                TextButton.icon(
                                  onPressed: () =>
                                      openSource(dialogContext, image),
                                  icon: const Icon(Icons.open_in_new, size: 14),
                                  label: const Text('打开来源'),
                                ),
                              ],
                            ),
                          ),
                        ),
                        child: AspectRatio(
                          aspectRatio: 1.5,
                          child: picture(image),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
