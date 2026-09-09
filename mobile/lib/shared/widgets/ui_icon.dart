import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'ui_icon_paths.dart';

/// Draw exactly the SVG path used by lucide-react, without font glyph padding.
class UiIcon extends StatelessWidget {
  final IconData? icon;
  final double? size;
  final Color? color;
  final String? semanticLabel;
  const UiIcon(
    this.icon, {
    super.key,
    this.size,
    this.color,
    this.semanticLabel,
  });
  @override
  Widget build(BuildContext context) {
    final path = uiIconPaths[icon];
    if (path == null) {
      return Icon(icon, size: size, color: color, semanticLabel: semanticLabel);
    }
    final theme = IconTheme.of(context);
    return SvgPicture.asset(
      'assets/images/ui-$path.svg',
      width: size ?? theme.size ?? 24,
      height: size ?? theme.size ?? 24,
      semanticsLabel: semanticLabel,
      colorFilter: ColorFilter.mode(
        (color ?? theme.color ?? Colors.black).withValues(
          alpha: theme.opacity ?? 1,
        ),
        BlendMode.srcIn,
      ),
    );
  }
}
