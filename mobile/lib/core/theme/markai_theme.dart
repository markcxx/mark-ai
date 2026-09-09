import 'package:flutter/material.dart';

ThemeData markaiTheme(
  Brightness brightness, {
  double fontSize = 15,
  String primaryColor = 'black',
}) {
  final dark = brightness == Brightness.dark;
  final surface = dark ? const Color(0xff111214) : Colors.white;
  final ink = dark ? const Color(0xfff3f4f6) : const Color(0xff111827);
  final border = dark ? const Color(0x1affffff) : const Color(0xffe5e7eb);
  final scheme = ColorScheme.fromSeed(seedColor: ink, brightness: brightness)
      .copyWith(
        primary:
            {
              'blue': const Color(0xff2563eb),
              'cyan': const Color(0xff0891b2),
              'green': const Color(0xff16a34a),
              'indigo': const Color(0xff4f46e5),
              'magenta': const Color(0xffc026d3),
              'orange': const Color(0xffea580c),
              'red': const Color(0xffdc2626),
              'violet': const Color(0xff7c3aed),
            }[primaryColor] ??
            ink,
        onPrimary: surface,
        surface: surface,
        onSurface: ink,
        outline: border,
        outlineVariant: border,
        surfaceTint: Colors.transparent,
        surfaceContainerHighest: dark
            ? const Color(0xff191919)
            : const Color(0xfff3f4f6),
      );
  return ThemeData(
    fontFamily: 'Noto Sans SC',
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: surface,
    splashFactory: NoSplash.splashFactory,
    textTheme: ThemeData(brightness: brightness).textTheme
        .apply(bodyColor: ink, displayColor: ink, fontFamily: 'Noto Sans SC')
        .copyWith(
          bodyMedium: TextStyle(
            fontFamily: 'Noto Sans SC',
            fontSize: fontSize,
            height: 1.625,
            letterSpacing: 0,
            color: ink,
          ),
        ),
    textSelectionTheme: const TextSelectionThemeData(
      selectionColor: Color(0x553b82f6),
      cursorColor: Color(0xff3b82f6),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: surface,
      surfaceTintColor: Colors.transparent,
      toolbarHeight: 56,
      titleTextStyle: TextStyle(
        fontFamily: 'Noto Sans SC',
        letterSpacing: 0,
        color: ink,
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
    ),
    dividerTheme: DividerThemeData(color: border, space: 1),
    iconTheme: const IconThemeData(size: 20, color: Color(0xff6b7280)),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: border),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
