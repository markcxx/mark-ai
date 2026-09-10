import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/models/model_metadata.dart';
import '../../../shared/widgets/app_dialog.dart';
import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/ui_icon.dart';
import '../application/workspace_controller.dart';

class ModelSelector extends StatefulWidget {
  final WorkspaceController controller;
  const ModelSelector({super.key, required this.controller});
  @override
  State<ModelSelector> createState() => _ModelSelectorState();
}

class _ModelSelectorState extends State<ModelSelector> {
  String query = '', filter = 'all';
  final focus = FocusNode(), selectedKey = GlobalKey();
  WorkspaceController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final selected = selectedKey.currentContext;
      if (selected != null) Scrollable.ensureVisible(selected, alignment: .5);
    });
  }

  @override
  void dispose() {
    focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final filtered = c.models
        .where(
          (m) =>
              (filter == 'all' ||
                  isImageGenerationModel(m.id) == (filter == 'image')) &&
              m.id.toLowerCase().contains(query.trim().toLowerCase()),
        )
        .toList();
    final groups = <bool, Map<String, List<ModelRef>>>{true: {}, false: {}};
    for (final model in filtered) {
      (groups[isImageGenerationModel(model.id)]![model.provider] ??= []).add(
        model,
      );
    }
    final muted = dark ? const Color(0xff6b7280) : const Color(0xff9ca3af);
    final border = dark ? const Color(0x0fffffff) : const Color(0xfff3f4f6);
    const filters = [
      ('all', '全部', LucideIcons.layoutGrid),
      ('text', '文本生成', LucideIcons.messageSquareText),
      ('image', '图片生成', LucideIcons.sparkles),
    ];
    Color filterColor(String id) => id == 'text'
        ? const Color(0xff2563eb)
        : id == 'image'
        ? const Color(0xff7c3aed)
        : const Color(0xff6b7280);
    return AppDialog(
      title: '选择模型',
      width: 448,
      height: math.min(MediaQuery.sizeOf(context).height * .8, 600),
      scrollBody: false,
      child: Column(
        children: [
          Container(
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: border)),
            ),
            child: Column(
              children: [
                SizedBox(
                  height: 44,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      children: [
                        UiIcon(LucideIcons.search, size: 15, color: muted),
                        const SizedBox(width: 8),
                        if (filter != 'all')
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: InkWell(
                              onTap: () => setState(() => filter = 'all'),
                              child: Container(
                                height: 24,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: filterColor(filter)
                                      .withValues(alpha: .12),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    UiIcon(
                                      filter == 'image'
                                          ? LucideIcons.sparkles
                                          : LucideIcons.messageSquareText,
                                      size: 11,
                                      color: filterColor(filter),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      filter == 'image' ? '图片生成' : '文本生成',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: filterColor(filter),
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    UiIcon(
                                      LucideIcons.x,
                                      size: 11,
                                      color: filterColor(filter),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        Expanded(
                          child: TextField(
                            focusNode: focus,
                            onChanged: (v) => setState(() => query = v),
                            style: const TextStyle(
                              fontSize: 14,
                              letterSpacing: 0,
                            ),
                            decoration: InputDecoration(
                              hintText: filter == 'all'
                                  ? '搜索模型...'
                                  : '在筛选结果中搜索...',
                              filled: false,
                              isDense: true,
                              contentPadding: EdgeInsets.zero,
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                  child: Row(
                    children: [
                      for (final item in filters)
                        Padding(
                          padding: const EdgeInsets.only(right: 4),
                          child: Semantics(
                            selected: filter == item.$1,
                            child: Material(
                              color: filter == item.$1
                                  ? (item.$1 == 'all'
                                        ? (dark
                                              ? const Color(0x1fffffff)
                                              : const Color(0xffe5e7eb))
                                        : filterColor(item.$1)
                                              .withValues(alpha: .12))
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(6),
                              child: InkWell(
                                onTap: () {
                                  setState(() => filter = item.$1);
                                },
                                borderRadius: BorderRadius.circular(6),
                                child: Container(
                                  height: 32,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                  ),
                                  child: Row(
                                    children: [
                                      UiIcon(
                                        item.$3,
                                        size: 13,
                                        color: filterColor(item.$1),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        item.$2,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w500,
                                          color: filterColor(item.$1),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              children: [
                if (filtered.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 32),
                    child: Text(
                      '没有匹配的模型',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: Color(0xff9ca3af)),
                    ),
                  ),
                for (final image in [true, false])
                  if (groups[image]!.isNotEmpty) ...[
                    Container(
                      height: 40,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          UiIcon(
                            image
                                ? LucideIcons.sparkles
                                : LucideIcons.messageSquareText,
                            size: 14,
                            color: image
                                ? const Color(0xffd946ef)
                                : const Color(0xff10b981),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            image ? '图片生成模型' : '文本生成模型',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    for (final provider
                        in (groups[image]!.keys.toList()..sort(
                          (a, b) =>
                              a.toLowerCase().startsWith('mark') ==
                                  b.toLowerCase().startsWith('mark')
                              ? 0
                              : a.toLowerCase().startsWith('mark')
                              ? -1
                              : 1,
                        ))) ...[
                      Container(
                        height: 32,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        color: dark
                            ? const Color(0xe61f1f1f)
                            : const Color(0xe6f9fafb),
                        child: Row(
                          children: [
                            Text(
                              c.providerNames[provider] ?? provider,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: muted,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Divider(
                                color: dark
                                    ? const Color(0x0fffffff)
                                    : const Color(0xffe5e7eb),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${groups[image]![provider]!.length}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xffd1d5db),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(6, 0, 6, 4),
                        child: Column(
                          children: [
                            for (final model in sortModelsByFamily(
                              groups[image]![provider]!,
                            ))
                              Builder(
                                builder: (context) {
                                  final selected = model.key == c.model?.key,
                                      metadata = metadataForModel(model.id),
                                      tokens =
                                          metadata?['contextWindowTokens']
                                              as num?;
                                  return Material(
                                    key: selected ? selectedKey : null,
                                    color: selected
                                        ? (dark
                                              ? const Color(0x14ffffff)
                                              : const Color(0xfff3f4f6))
                                        : Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(8),
                                      onTap: () async {
                                        try {
                                          await c.selectModel(model);
                                          if (context.mounted) {
                                            Navigator.pop(context);
                                          }
                                        } catch (e) {
                                          c.report(e);
                                        }
                                      },
                                      child: Container(
                                        height: 40,
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                        ),
                                        child: Row(
                                          children: [
                                            ModelBrand(
                                              model: model.id,
                                              provider: model.provider,

                                              size: 20,
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Text(
                                                modelDisplayName(model.id),
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontSize: 14,
                                                ),
                                              ),
                                            ),
                                            if (image ||
                                                metadata?['supportsVision'] ==
                                                    true)
                                              Padding(
                                                padding: const EdgeInsets.only(
                                                  left: 10,
                                                ),
                                                child: Tooltip(
                                                  message: image
                                                      ? '支持图片生成'
                                                      : '支持图片理解',
                                                  child: UiIcon(
                                                    LucideIcons.image,
                                                    size: 14,
                                                    color: image
                                                        ? const Color(
                                                            0xffd946ef,
                                                          )
                                                        : const Color(
                                                            0xff0ea5e9,
                                                          ),
                                                  ),
                                                ),
                                              ),
                                            if (image)
                                              const Padding(
                                                padding: EdgeInsets.only(
                                                  left: 10,
                                                ),
                                                child: Tooltip(
                                                  message: '支持图片编辑与多轮修改',
                                                  child: UiIcon(
                                                    LucideIcons.paintbrush,
                                                    size: 14,
                                                    color: Color(0xfff59e0b),
                                                  ),
                                                ),
                                              ),
                                            if (tokens != null && tokens > 0)
                                              Padding(
                                                padding: const EdgeInsets.only(
                                                  left: 10,
                                                ),
                                                child: Tooltip(
                                                  message: '上下文 $tokens tokens',
                                                  child: Text(
                                                    formatTokenCount(tokens),
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      color: muted,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            if (selected)
                                              Padding(
                                                padding: const EdgeInsets.only(
                                                  left: 10,
                                                ),
                                                child: UiIcon(
                                                  LucideIcons.check,
                                                  size: 16,
                                                  color: muted,
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                          ],
                        ),
                      ),
                    ],
                  ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
