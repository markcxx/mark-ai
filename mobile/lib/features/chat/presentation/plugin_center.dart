import 'package:markai_mobile/shared/widgets/ui_icon.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/toggle_switch.dart';
import '../application/workspace_controller.dart';

Future<void> showPluginCenter(BuildContext context, WorkspaceController c) =>
    Navigator.push(
      context,
      PageRouteBuilder<void>(
        pageBuilder: (_, _, _) => PluginCenter(controller: c),
        transitionDuration: const Duration(milliseconds: 340),
        transitionsBuilder: (context, animation, _, child) => SlideTransition(
          position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(
            CurvedAnimation(
              parent: animation,
              curve: const Cubic(.22, 1, .36, 1),
            ),
          ),
          child: child,
        ),
      ),
    );

class PluginCenter extends StatefulWidget {
  final WorkspaceController controller;
  const PluginCenter({super.key, required this.controller});
  @override
  State<PluginCenter> createState() => _PluginCenterState();
}

class _PluginCenterState extends State<PluginCenter> {
  String category = 'all';
  final working = <String>{};
  bool loading = true;
  String? error;
  WorkspaceController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await c.api.request('GET', '/api/tools');
      if (mounted) setState(() => c.tools = jsonList(result['tools']));
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> install(Json tool, bool installed) async {
    final id = tool['id'] as String;
    if (working.contains(id) || tool['status'] == 'planned') return;
    setState(() => working.add(id));
    try {
      await c.api.request(
        installed ? 'POST' : 'DELETE',
        '/api/tools/${Uri.encodeComponent(id)}',
      );
      c.tools = c.tools
          .map((t) => t['id'] == id ? {...t, 'installed': installed} : t)
          .toList();
      if (!installed) c.enabledTools.remove(id);
      c.message('${tool['shortName']} ${installed ? '已添加到工具库' : '已移出工具库'}');
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => working.remove(id));
    }
  }

  Widget card(Json tool) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final color =
        {
          'amber': const Color(0xffd97706),
          'blue': const Color(0xff2563eb),
          'emerald': const Color(0xff059669),
          'violet': const Color(0xff7c3aed),
        }[tool['accent']] ??
        const Color(0xff6b7280);
    final icon =
        {
          'calculator': LucideIcons.calculator,
          'data-visualization': LucideIcons.chartNoAxesCombined,
          'excel-workbook': LucideIcons.table2,
          'markmap-mindmap': LucideIcons.network,
          'mermaid-diagram': LucideIcons.gitBranch,
          'word-document': LucideIcons.fileText,
        }[tool['id']] ??
        LucideIcons.layers;
    final planned = tool['status'] == 'planned';
    return Container(
      decoration: BoxDecoration(
        color: dark ? const Color(0xff17181a) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: .08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: UiIcon(icon, size: 20, color: color),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tool['name'] as String? ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            '${tool['kind'] == 'skill' ? '内置 Skill' : '内置插件'} · v${tool['version']}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xff9ca3af),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (planned)
                      const Text(
                        '规划中',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xffd97706),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 40),
                  child: Text(
                    tool['description'] as String? ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 20 / 13,
                      color: Color(0xff6b7280),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  (tool['features'] as List? ?? []).join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xff9ca3af),
                  ),
                ),
              ],
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Divider(),
          ),
          SizedBox(
            height: 48,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const UiIcon(
                    LucideIcons.shieldCheck,
                    size: 14,
                    color: Color(0xff9ca3af),
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    'MarkAI 官方',
                    style: TextStyle(fontSize: 12, color: Color(0xff9ca3af)),
                  ),
                  const Spacer(),
                  Text(
                    planned
                        ? '暂不可用'
                        : tool['installed'] == true
                        ? '已安装'
                        : '未安装',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xff6b7280),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ToggleSwitch(
                    checked: tool['installed'] == true,
                    label: '${tool['name']}安装状态',
                    onChanged: planned || working.contains(tool['id'])
                        ? null
                        : (value) => install(tool, value),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final tools = c.tools
        .where((t) => category == 'all' || t['category'] == category)
        .toList();
    return Scaffold(
      backgroundColor: dark ? const Color(0xff0e0f11) : const Color(0xfff7f7f8),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              height: 64,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              color: dark ? const Color(0xff111214) : Colors.white,
              child: Row(
                children: [
                  const Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '插件中心',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '管理内置插件与 Skill',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xff6b7280),
                          ),
                        ),
                      ],
                    ),
                  ),
                  ActionIcon(
                    '关闭插件中心',
                    LucideIcons.x,
                    () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(),
            Expanded(
              child: SingleChildScrollView(
                child: Center(
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 1152),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 24,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          children: [
                            for (final entry in const {
                              'all': '全部',
                              'documents': '文件与文档',
                              'creation': '创作与原型',
                              'utilities': '效率工具',
                            }.entries)
                              TextButton(
                                onPressed: () =>
                                    setState(() => category = entry.key),
                                style: TextButton.styleFrom(
                                  backgroundColor: category == entry.key
                                      ? Theme.of(context).colorScheme.surface
                                      : Colors.transparent,
                                  textStyle: const TextStyle(fontSize: 12),
                                ),
                                child: Text(entry.value),
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          '在具体对话中按需启用已安装工具',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xff9ca3af),
                          ),
                        ),
                        const SizedBox(height: 20),
                        if (error != null)
                          TextButton(
                            onPressed: load,
                            child: Text('$error · 重试'),
                          ),
                        if (loading && c.tools.isEmpty)
                          const SizedBox(
                            height: 280,
                            child: Center(
                              child: SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                            ),
                          )
                        else
                          LayoutBuilder(
                            builder: (context, box) {
                              final columns = box.maxWidth >= 992
                                  ? 3
                                  : box.maxWidth >= 736
                                  ? 2
                                  : 1;
                              return Wrap(
                                spacing: 16,
                                runSpacing: 16,
                                children: [
                                  for (final t in tools)
                                    SizedBox(
                                      width:
                                          (box.maxWidth - (columns - 1) * 16) /
                                          columns,
                                      child: card(t),
                                    ),
                                ],
                              );
                            },
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
    );
  }
}
