import 'package:markai_mobile/shared/widgets/ui_icon.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'model_brand_data.dart';
import 'app_dialog.dart';

import 'package:lucide_icons_flutter/lucide_icons.dart';

IconData markaiIcon(IconData icon) =>
    {
      Icons.copy_outlined: LucideIcons.copy,
      Icons.copy: LucideIcons.copy,
      Icons.refresh: LucideIcons.rotateCw,
      Icons.attach_file: LucideIcons.paperclip,
      Icons.widgets_outlined: LucideIcons.blocks,
      Icons.language: LucideIcons.globe,
      Icons.view_sidebar_outlined: LucideIcons.panelLeftOpen,
      Icons.more_horiz: LucideIcons.ellipsis,
      Icons.close: LucideIcons.x,
      Icons.chevron_left: LucideIcons.chevronLeft,
      Icons.chevron_right: LucideIcons.chevronRight,
      Icons.arrow_downward: LucideIcons.arrowDown,
      Icons.delete_outline: LucideIcons.trash2,
      Icons.light_mode_outlined: LucideIcons.sun,
      Icons.dark_mode_outlined: LucideIcons.moon,
      Icons.volume_up_outlined: LucideIcons.volume2,
      Icons.stop: LucideIcons.square,
    }[icon] ??
    icon;

class ModelBrand extends StatelessWidget {
  final String model, provider;
  final double size;
  final bool plain;
  const ModelBrand({
    super.key,
    required this.model,
    required this.provider,
    this.size = 20,
    this.plain = false,
  });
  Color parseColor(String value) {
    var hex = value.replaceFirst('#', '');
    if (hex.length == 3) hex = hex.split('').map((c) => '$c$c').join();
    return Color(0xff000000 | int.parse(hex, radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    final normalized = model.trim().toLowerCase();
    final rule = modelAssetRules
        .where((r) => RegExp(r['pattern']!).hasMatch(normalized))
        .firstOrNull;
    final providerKey =
        providerAssetKeys[provider.trim().toLowerCase()] ??
        provider.trim().toLowerCase();
    final raw = brandAssets[rule?['key'] ?? providerKey];
    final asset = raw == null ? null : Map<String, dynamic>.from(raw);
    final dark = Theme.of(context).brightness == Brightness.dark;
    if (asset == null) {
      final label = model.isNotEmpty ? model : provider;
      final fallback = plain
          ? (label.isEmpty ? 'A' : label.substring(0, 1).toUpperCase())
          : RegExp(
                  '[a-z0-9]',
                  caseSensitive: false,
                ).firstMatch(label)?.group(0)?.toUpperCase() ??
                'AI';
      return Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: plain
            ? null
            : BoxDecoration(
                shape: BoxShape.circle,
                color: dark ? const Color(0xff374151) : const Color(0xffe5e7eb),
              ),
        child: Text(
          fallback,
          style: TextStyle(
            fontFamily: 'Plus Jakarta Sans',
            fontSize: plain
                ? size
                : (size * .42).round().clamp(9, 100).toDouble(),
            fontWeight: FontWeight.bold,
            color: dark ? const Color(0xffe5e7eb) : const Color(0xff4b5563),
          ),
        ),
      );
    }
    if (plain) {
      return SvgPicture.asset(
        'assets/model_icons/${asset['slug']}.svg',
        width: size,
        height: size,
        colorFilter: ColorFilter.mode(
          Theme.of(context).colorScheme.onSurface,
          BlendMode.srcIn,
        ),
      );
    }
    if (asset['slug'] == 'openai') {
      if (RegExp(r'gpt[-_.]?5').hasMatch(normalized)) {
        asset['background'] = '#f86aa4';
      } else if (RegExp(r'gpt[-_.]?4').hasMatch(normalized)) {
        asset['background'] = '#ab68ff';
      } else if (RegExp(r'gpt[-_.]?3').hasMatch(normalized)) {
        asset['background'] = '#19c37d';
      } else if (RegExp(r'(?:^|[/_.-])o[1345](?:$|[/_.-])')
          .hasMatch(normalized)) {
        asset['background'] = '#f9c322';
        asset['foreground'] = '#111';
      }
    }
    final colors = RegExp('#[a-fA-F0-9]+')
        .allMatches(asset['background'] as String)
        .map((m) => parseColor(m.group(0)!))
        .toList();
    final glyph = (size * (asset['scale'] as num? ?? .75)).roundToDouble();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: colors.length == 1 ? colors.first : null,
        gradient: colors.length > 1
            ? LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: colors,
              )
            : null,
        boxShadow: [
          BoxShadow(
            color: dark ? const Color(0x1affffff) : const Color(0x0d000000),
            spreadRadius: 1,
          ),
        ],
      ),
      child: SvgPicture.asset(
        'assets/model_icons/${asset['avatarSlug'] ?? asset['slug']}.svg',
        width: glyph,
        height: glyph,
        colorFilter: asset['avatarSlug'] != null
            ? null
            : ColorFilter.mode(
                parseColor(asset['foreground'] as String),
                BlendMode.srcIn,
              ),
      ),
    );
  }
}

class Brand extends StatelessWidget {
  final double size;
  const Brand({super.key, this.size = 32});
  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    'assets/images/markai.svg',
    width: size,
    height: size,
    semanticsLabel: 'MarkAI',
  );
}

class ActionIcon extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final Color? color;
  final bool compact;
  final double? iconSize, buttonWidth, buttonHeight;
  const ActionIcon(
    this.label,
    this.icon,
    this.onPressed, {
    super.key,
    this.color,
    this.compact = false,
    this.iconSize,
    this.buttonWidth,
    this.buttonHeight,
  });
  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: label,
    onPressed: onPressed,
    icon: UiIcon(
      markaiIcon(icon),
      size: iconSize ?? (compact ? 15 : 18),
      color: color ?? (compact ? const Color(0xff9ca3af) : null),
    ),
    padding: EdgeInsets.all(compact ? 6 : 8),
    style: IconButton.styleFrom(
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    ),
    constraints: BoxConstraints(
      minWidth: buttonWidth ?? (compact ? 27 : 44),
      maxWidth: buttonWidth ?? double.infinity,
      minHeight: buttonHeight ?? (compact ? 27 : 44),
    ),
  );
}

class MessageAction extends ActionIcon {
  const MessageAction(
    super.label,
    super.icon,
    super.onPressed, {
    super.key,
    super.color,
  }) : super(compact: true);
}

Future<bool> confirmAction(
  BuildContext context,
  String title,
  String description,
) async =>
    await showAppDialog<bool>(
      context,
      (context) => AppDialog(
        title: title,
        width: 420,
        closable: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                description,
                style: TextStyle(
                  fontSize: 14,
                  height: 24 / 14,
                  color: Theme.of(context).brightness == Brightness.dark
                      ? const Color(0xff9ca3af)
                      : const Color(0xff6b7280),
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 40,
                      child: TextButton(
                        style: TextButton.styleFrom(
                          backgroundColor:
                              Theme.of(context).brightness == Brightness.dark
                              ? const Color(0x12ffffff)
                              : const Color(0xfff3f4f6),
                          foregroundColor: Theme.of(context)
                              .colorScheme
                              .onSurface,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          textStyle: const TextStyle(
                            fontFamily: 'Noto Sans SC',
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0,
                          ),
                        ),
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('取消'),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SizedBox(
                      height: 40,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xffdc2626),
                          foregroundColor: Colors.white,
                          textStyle: const TextStyle(
                            fontFamily: 'Noto Sans SC',
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0,
                          ),
                        ),
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('确认'),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ) ??
    false;
Future<String?> editText(
  BuildContext context,
  String title,
  String initial, {
  int lines = 1,
}) async {
  final controller = TextEditingController(text: initial);
  final value = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: SizedBox(
        width: 420,
        child: TextField(
          controller: controller,
          autofocus: true,
          minLines: lines,
          maxLines: lines == 1 ? 1 : 10,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('取消'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, controller.text.trim()),
          child: const Text('保存'),
        ),
      ],
    ),
  );
  // Dialog route exit animation can still reference its text field.
  Future<void>.delayed(const Duration(milliseconds: 400), controller.dispose);
  return value;
}
