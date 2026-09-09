import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

class AuthIcon extends StatelessWidget {
  final IconData icon;
  final double size;
  final Color? color;
  const AuthIcon(this.icon, {super.key, this.size = 18, this.color});
  @override
  Widget build(BuildContext context) {
    final name = {
      LucideIcons.moon: 'moon',
      LucideIcons.sun: 'sun',
      LucideIcons.eye: 'eye',
      LucideIcons.eyeOff: 'eye-off',
      LucideIcons.clock3: 'clock-3',
      LucideIcons.logIn: 'log-in',
      LucideIcons.paperclip: 'paperclip',
      LucideIcons.globe: 'globe',
      LucideIcons.slidersHorizontal: 'sliders-horizontal',
      LucideIcons.sendHorizontal: 'send-horizontal',
    }[icon]!;
    return SvgPicture.asset(
      'assets/images/ui-$name.svg',
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(
        color ??
            IconTheme.of(context).color ??
            Theme.of(context).colorScheme.onSurface,
        BlendMode.srcIn,
      ),
    );
  }
}
