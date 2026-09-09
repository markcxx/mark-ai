import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/ui_icon.dart';
import '../application/workspace_controller.dart';
import 'plugin_center.dart';

Future<void> showToolMenu(
  BuildContext context,
  WorkspaceController c,
  Rect anchor,
) async {
  final openStore = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: '关闭工具菜单',
    barrierColor: Colors.transparent,
    transitionDuration: c.general['reduceMotion'] == true
        ? Duration.zero
        : const Duration(milliseconds: 150),
    transitionBuilder: (_, animation, _, child) => FadeTransition(
      opacity: animation,
      child: ScaleTransition(
        alignment: Alignment.bottomLeft,
        scale: Tween(begin: .96, end: 1.0).animate(
          CurvedAnimation(
            parent: animation,
            curve: const Cubic(.22, 1, .36, 1),
          ),
        ),
        child: child,
      ),
    ),
    pageBuilder: (context, _, _) => ListenableBuilder(
      listenable: c,
      builder: (context, _) {
        final media = MediaQuery.of(context),
            dark = Theme.of(context).brightness == Brightness.dark;
        final items = c.tools
            .where((t) => t['installed'] == true && t['status'] == 'available')
            .toList();
        final availableHeight = media.size.height - media.viewInsets.bottom;
        final listHeight = math.min(
          math.min(availableHeight * .52, 360.0),
          items.isEmpty ? 144.0 : 54.0 + items.length * 42,
        );
        final height = listHeight + 58;
        final bottom = (media.size.height - anchor.top + 8).clamp(
          media.viewInsets.bottom + 12,
          math.max(
            media.viewInsets.bottom + 12,
            media.size.height - height - media.padding.top - 12,
          ),
        );
        final secondary = dark
            ? const Color(0xff9ca3af)
            : const Color(0xff9ca3af);
        return Stack(
          children: [
            Positioned(
              left: media.size.width < 640
                  ? 12
                  : anchor.left.clamp(12, math.max(12, media.size.width - 332)),
              width: media.size.width < 640 ? media.size.width - 24 : 320,
              bottom: bottom.toDouble(),
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: dark ? const Color(0xff191919) : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: dark
                        ? const Color(0x1affffff)
                        : const Color(0xffe5e7eb),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: dark
                          ? const Color(0x8c000000)
                          : const Color(0x330f172a),
                      blurRadius: 60,
                      offset: const Offset(0, 18),
                    ),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ConstrainedBox(
                        constraints: BoxConstraints(
                          maxHeight: math.min(availableHeight * .52, 360),
                        ),
                        child: SingleChildScrollView(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (items.isEmpty)
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 32,
                                  ),
                                  child: Column(
                                    children: [
                                      UiIcon(
                                        LucideIcons.puzzle,
                                        size: 28,
                                        color: dark
                                            ? const Color(0xff4b5563)
                                            : const Color(0xffd1d5db),
                                      ),
                                      const SizedBox(height: 12),
                                      const Text(
                                        '还没有安装工具',
                                        style: TextStyle(
                                          fontSize: 14,
                                          height: 20 / 14,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '去插件中心添加内置工具',
                                        style: TextStyle(
                                          fontSize: 12,
                                          height: 16 / 12,
                                          color: secondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              else ...[
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                    8,
                                    4,
                                    8,
                                    4,
                                  ),
                                  child: Text(
                                    '内置插件',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: secondary,
                                    ),
                                  ),
                                ),
                                for (final tool in items)
                                  Builder(
                                    builder: (context) {
                                      final checked = c.enabledTools.contains(
                                        tool['id'],
                                      );
                                      final color = switch (tool['accent']) {
                                        'emerald' => const Color(0xff059669),
                                        'violet' => const Color(0xff7c3aed),
                                        _ => const Color(0xff2563eb),
                                      };
                                      final icon = switch (tool['id']) {
                                        'word-document' => LucideIcons.fileText,
                                        'excel-workbook' =>
                                          LucideIcons.fileSpreadsheet,
                                        'data-visualization' =>
                                          LucideIcons.chartColumn,
                                        _ => LucideIcons.puzzle,
                                      };
                                      return Padding(
                                        padding: const EdgeInsets.only(
                                          bottom: 2,
                                        ),
                                        child: Semantics(
                                          toggled: checked,
                                          child: Material(
                                            color: checked
                                                ? (dark
                                                      ? const Color(0x09ffffff)
                                                      : const Color(0xfff9fafb))
                                                : Colors.transparent,
                                            borderRadius: BorderRadius.circular(
                                              8,
                                            ),
                                            child: InkWell(
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                              onTap: c.generating
                                                  ? null
                                                  : () async {
                                                      try {
                                                        await c.setTool(
                                                          tool['id'] as String,
                                                          !checked,
                                                        );
                                                      } catch (e) {
                                                        c.report(e);
                                                      }
                                                    },
                                              child: SizedBox(
                                                height: 40,
                                                child: Padding(
                                                  padding:
                                                      const EdgeInsets.symmetric(
                                                        horizontal: 8,
                                                      ),
                                                  child: Row(
                                                    children: [
                                                      Container(
                                                        width: 24,
                                                        height: 24,
                                                        decoration: BoxDecoration(
                                                          color: color
                                                              .withValues(
                                                                alpha: dark
                                                                    ? .15
                                                                    : .07,
                                                              ),
                                                          borderRadius:
                                                              BorderRadius.circular(
                                                                6,
                                                              ),
                                                        ),
                                                        child: Center(
                                                          child: UiIcon(
                                                            icon,
                                                            size: 15,
                                                            color: color,
                                                          ),
                                                        ),
                                                      ),
                                                      const SizedBox(width: 10),
                                                      Expanded(
                                                        child: Text(
                                                          tool['name']
                                                              as String,
                                                          overflow: TextOverflow
                                                              .ellipsis,
                                                          style:
                                                              const TextStyle(
                                                                fontSize: 14,
                                                              ),
                                                        ),
                                                      ),
                                                      Container(
                                                        width: 18,
                                                        height: 18,
                                                        decoration: BoxDecoration(
                                                          color: checked
                                                              ? Theme.of(
                                                                      context,
                                                                    )
                                                                    .colorScheme
                                                                    .primary
                                                              : Colors
                                                                    .transparent,
                                                          borderRadius:
                                                              BorderRadius.circular(
                                                                5,
                                                              ),
                                                          border: Border.all(
                                                            color: checked
                                                                ? Theme.of(
                                                                        context,
                                                                      )
                                                                      .colorScheme
                                                                      .primary
                                                                : const Color(
                                                                    0xffd1d5db,
                                                                  ),
                                                          ),
                                                        ),
                                                        child: checked
                                                            ? const UiIcon(
                                                                LucideIcons
                                                                    .check,
                                                                size: 12,
                                                                color: Colors
                                                                    .white,
                                                              )
                                                            : null,
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                    8,
                                    12,
                                    8,
                                    4,
                                  ),
                                  child: Text(
                                    '第三方插件',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: secondary,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        decoration: BoxDecoration(
                          border: Border(
                            top: BorderSide(
                              color: dark
                                  ? const Color(0x1affffff)
                                  : const Color(0xfff3f4f6),
                            ),
                          ),
                        ),
                        child: InkWell(
                          onTap: () => Navigator.pop(context, true),
                          child: SizedBox(
                            height: 39,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                              ),
                              child: Row(
                                children: [
                                  const UiIcon(
                                    LucideIcons.store,
                                    size: 16,
                                    color: Color(0xff6b7280),
                                  ),
                                  const SizedBox(width: 8),
                                  const Text(
                                    '插件商店',
                                    style: TextStyle(
                                      fontSize: 14,
                                      height: 20 / 14,
                                    ),
                                  ),
                                  const Spacer(),
                                  UiIcon(
                                    LucideIcons.chevronRight,
                                    size: 15,
                                    color: secondary,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    ),
  );
  if (openStore == true && context.mounted) await showPluginCenter(context, c);
}
