import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../shared/models/chat.dart';
import '../../shared/widgets/app_select.dart';
import '../../shared/widgets/app_number_input.dart';
import '../../shared/widgets/app_slider_with_input.dart';
import '../../shared/widgets/common.dart';
import '../../shared/widgets/toggle_switch.dart';
import '../../shared/widgets/ui_icon.dart';
import '../chat/application/workspace_controller.dart';
import 'default_settings.dart';
import 'provider_settings.dart';
import 'recovery_notice.dart';

class SettingsScreen extends StatefulWidget {
  final WorkspaceController controller;
  const SettingsScreen({super.key, required this.controller});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final scroll = ScrollController();
  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  String section = 'appearance';
  WorkspaceController get c => widget.controller;
  static const sections = {
    'appearance': '外观',
    'chat': '对话',
    'speech': '语音',
    'providers': 'AI 提供商',
  };
  Widget row(
    String title,
    Widget control, {
    String? description,
    bool last = false,
  }) {
    final caption = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            height: 20 / 14,
            fontWeight: FontWeight.w500,
            letterSpacing: 0,
          ),
        ),
        if (description != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              description,
              style: const TextStyle(
                fontSize: 12,
                height: 1.625,
                color: Color(0xff9ca3af),
              ),
            ),
          ),
      ],
    );
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        border: last
            ? null
            : Border(
                bottom: BorderSide(
                  color: Theme.of(context).colorScheme.outline
                      .withValues(alpha: .5),
                ),
              ),
      ),
      child: MediaQuery.sizeOf(context).width < 640
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [caption, const SizedBox(height: 12), control],
            )
          : Row(
              children: [
                Expanded(child: caption),
                const SizedBox(width: 16),
                control,
              ],
            ),
    );
  }

  Widget choice(
    String title,
    String key,
    Map<String, String> options, {
    String? description,
  }) => row(
    title,
    AppSelect<String>(
      label: title,
      value: c.general[key] as String? ?? options.keys.first,
      options: options,
      onChanged: (value) => c.setSetting(key, value),
    ),
    description: description,
  );
  Widget toggle(String title, String key, {String? description}) => row(
    title,
    ToggleSwitch(
      label: title,
      checked: c.general[key] == true,
      onChanged: (value) => c.setSetting(key, value),
    ),
    description: description,
  );
  Widget appearance() => Column(
    children: [
      choice('主题模式', 'themeMode', const {
        'system': '跟随系统',
        'light': '亮色',
        'dark': '暗色',
      }, description: '可跟随操作系统自动切换'),
      row(
        '主题色',
        SizedBox(
          width: MediaQuery.sizeOf(context).width < 640
              ? MediaQuery.sizeOf(context).width - 77
              : 316,
          child: Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final entry in const {
                'black': ('黑色', 0xff111827),
                'blue': ('蓝色', 0xff2563eb),
                'indigo': ('靛青', 0xff4f46e5),
                'violet': ('紫色', 0xff7c3aed),
                'magenta': ('洋红', 0xffc026d3),
                'red': ('红色', 0xffdc2626),
                'orange': ('橙色', 0xffea580c),
                'green': ('绿色', 0xff16a34a),
                'cyan': ('青色', 0xff0891b2),
              }.entries)
                Tooltip(
                  message: entry.value.$1,
                  child: GestureDetector(
                    onTap: () => c.setSetting('primaryColor', entry.key),
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color(entry.value.$2),
                        boxShadow: c.general['primaryColor'] == entry.key
                            ? [
                                const BoxShadow(
                                  color: Color(0xff9ca3af),
                                  spreadRadius: 4,
                                ),
                                BoxShadow(
                                  color:
                                      Theme.of(context).brightness ==
                                          Brightness.dark
                                      ? const Color(0xff111827)
                                      : Colors.white,
                                  spreadRadius: 2,
                                ),
                              ]
                            : null,
                      ),
                      child: c.general['primaryColor'] == entry.key
                          ? const UiIcon(
                              LucideIcons.check,
                              size: 14,
                              color: Colors.white,
                            )
                          : null,
                    ),
                  ),
                ),
            ],
          ),
        ),
        description: '用于按钮、链接和交互高亮',
      ),
      row(
        '对话字号',
        AppSliderWithInput(
          label: '对话字号',
          min: 12,
          max: 20,
          value: (c.general['chatFontSize'] as num).toDouble(),
          onChanged: (value) => c.setSetting('chatFontSize', value.round()),
        ),
        description: '影响 AI 回复正文，不影响导航栏',
      ),
      choice('界面密度', 'density', const {
        'compact': '紧凑',
        'comfortable': '默认',
        'spacious': '宽松',
      }),
      toggle('减少动画', 'reduceMotion', description: '关闭大部分装饰性动画'),
      choice('代码高亮主题', 'codeTheme', const {
        'one': 'One',
        'vscode': 'VS Code',
        'material': 'Material',
        'gruvbox': 'Gruvbox',
        'solarized': 'Solarized',
        'github': 'GitHub',
        'dracula': 'Dracula',
        'night-owl': 'Night Owl',
        'nord': 'Nord',
        'duotone': 'Duotone',
      }, description: '代码主题会自动匹配亮色和暗色模式'),
      choice('代码块明暗模式', 'codeColorMode', const {
        'auto': '跟随界面',
        'light': '固定亮色',
        'dark': '固定暗色',
      }, description: '可在亮色界面中固定使用暗色代码块，或反过来'),
      toggle('显示代码行号', 'codeLineNumbers'),
      toggle('代码自动换行', 'codeWrap'),
      row(
        '长代码折叠阈值',
        AppNumberInput(
          label: '长代码折叠阈值',
          value: (c.general['codeCollapseLines'] as num).toDouble(),
          onChanged: (value) =>
              c.setSetting('codeCollapseLines', value.round()),
        ),
        description: '设为 0 表示永不自动折叠',
        last: true,
      ),
    ],
  );
  Widget chat() => Column(
    children: [
      toggle('流式输出自动滚动', 'autoScroll'),
      choice('回复动画', 'responseAnimation', const {
        'none': '关闭',
        'fade': '淡入',
        'smooth': '平滑',
      }),
      toggle(
        '覆盖旧回答',
        'overwriteRegeneratedResponse',
        description: '关闭后，重新生成会保留旧回答并提供版本切换',
      ),
      choice('思考面板', 'thinkingDisplay', const {
        'auto': '自动',
        'collapsed': '默认折叠',
        'expanded': '始终展开',
      }, description: '“自动”会在生成时展开，结束后保留面板'),
      toggle('显示 Token 与耗时统计', 'showMessageStats'),
      choice('翻译模型', 'translationModelKey', {
        '__system__': '系统默认',
        '': '跟随消息模型',
        for (final m in c.models) m.key: '${m.label} · ${m.provider}',
      }, description: '系统默认由服务端配置；也可以跟随消息或固定到指定模型'),
      toggle('默认启用联网搜索', 'defaultWebSearch'),
      choice('发送快捷键', 'sendShortcut', const {
        'enter': 'Enter 发送',
        'mod-enter': 'Ctrl / Cmd + Enter',
      }),
      choice('命令中心快捷键', 'commandCenterShortcut', const {
        'mod-k': 'Ctrl / Cmd + K',
        'mod-shift-k': 'Ctrl / Cmd + Shift + K',
        'mod-slash': 'Ctrl / Cmd + /',
      }, description: 'Windows 和 Linux 使用 Ctrl，macOS 使用 Cmd'),
      toggle('默认宽屏对话', 'wideChatMode'),
    ],
  );
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: c,
    builder: (context, _) {
      final mobile = MediaQuery.sizeOf(context).width < 640;
      final main = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            height: 63,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        sections[section]!,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        c.settingsSaveState == 'error'
                            ? '云端同步失败，本地设置已经生效'
                            : c.settingsSaveState == 'saving'
                            ? '正在恢复默认设置…'
                            : c.settingsSaveState == 'saved'
                            ? '已应用 · 自动保存'
                            : '修改会立即应用并自动保存',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xff9ca3af),
                        ),
                      ),
                    ],
                  ),
                ),
                ActionIcon('关闭设置', LucideIcons.x, () => Navigator.pop(context)),
              ],
            ),
          ),
          const Divider(),
          if (mobile) ...[
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  for (final entry in sections.entries)
                    Padding(
                      padding: const EdgeInsets.only(right: 4),
                      child: TextButton(
                        onPressed: () => setState(() => section = entry.key),
                        style: TextButton.styleFrom(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          backgroundColor: section == entry.key
                              ? Theme.of(context)
                                    .colorScheme
                                    .surfaceContainerHighest
                              : Colors.transparent,
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          textStyle: const TextStyle(
                            fontFamily: 'Noto Sans SC',
                            fontSize: 14,
                            letterSpacing: 0,
                            height: 20 / 14,
                          ),
                        ),
                        child: Text(entry.value),
                      ),
                    ),
                ],
              ),
            ),
            const Divider(),
          ],
          RecoveryNotice(controller: c),
          Expanded(
            child: RawScrollbar(
              controller: scroll,
              thumbVisibility: true,
              thickness: 6,
              radius: const Radius.circular(3),
              padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 2),
              thumbColor: const Color(0xffbcbcc8),
              child: SingleChildScrollView(
                controller: scroll,
                padding: EdgeInsets.only(
                  left: mobile ? 20 : 32,
                  right: mobile ? 31 : 32,
                ),
                child: switch (section) {
                  'appearance' => appearance(),
                  'chat' => chat(),
                  'providers' => ProviderSettings(controller: c),
                  _ => row(
                    '默认音色',
                    AppSelect<String>(
                      label: '默认音色',
                      height: 40,
                      value:
                          jsonMap(c.settings['speech'])['voice'] as String? ??
                          '__system__',
                      options: {
                        '__system__': '系统默认',
                        for (final v in speechVoices)
                          v['value']!: '${v['label']} · ${v['value']}',
                      },
                      onChanged: (value) =>
                          c.setSectionSetting('speech', 'voice', value),
                    ),
                    description: '用于消息语音朗读，修改后会自动保存',
                    last: true,
                  ),
                },
              ),
            ),
          ),
        ],
      );
      final content = Material(
        color: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xff151515)
            : Colors.white,
        child: Row(
          children: [
            if (!mobile)
              Container(
                width: 224,
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    const SizedBox(
                      height: 48,
                      child: Row(
                        children: [
                          UiIcon(LucideIcons.settings2, size: 18),
                          SizedBox(width: 8),
                          Text('设置'),
                        ],
                      ),
                    ),
                    for (final entry in sections.entries)
                      Material(
                        color: Colors.transparent,
                        child: ListTile(
                          dense: true,
                          selected: entry.key == section,
                          title: Text(entry.value),
                          onTap: () => setState(() => section = entry.key),
                        ),
                      ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: () async {
                        if (await confirmAction(
                          context,
                          '恢复全部默认设置？',
                          '外观、对话和语音设置会恢复为初始值，此操作会立即应用。',
                        )) {
                          await c.resetSettings();
                        }
                      },
                      icon: const UiIcon(LucideIcons.rotateCcw, size: 14),
                      label: const Text('恢复默认'),
                    ),
                  ],
                ),
              ),
            Expanded(child: main),
          ],
        ),
      );
      return mobile
          ? SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  12,
                  0,
                  12,
                  MediaQuery.viewInsetsOf(context).bottom,
                ),
                child: Container(
                  padding: const EdgeInsets.all(1),
                  color: Theme.of(context).colorScheme.outline,
                  child: content,
                ),
              ),
            )
          : Dialog(
              insetPadding: const EdgeInsets.all(32),
              child: SizedBox(
                width: 1024,
                height: (MediaQuery.sizeOf(context).height * .9).clamp(0, 760),
                child: content,
              ),
            );
    },
  );
}
