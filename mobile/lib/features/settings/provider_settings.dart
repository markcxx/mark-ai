import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../shared/models/chat.dart';
import '../../shared/widgets/common.dart';
import '../../shared/widgets/toggle_switch.dart';
import '../../shared/widgets/ui_icon.dart';
import '../chat/application/workspace_controller.dart';

class ProviderSettings extends StatefulWidget {
  final WorkspaceController controller;
  const ProviderSettings({super.key, required this.controller});
  @override
  State<ProviderSettings> createState() => _ProviderSettingsState();
}

class _ProviderSettingsState extends State<ProviderSettings> {
  final cancel = CancelToken();
  List<Json> templates = [], providers = [], site = [];
  bool cloud = true, loading = true, saving = false, revealKey = false;
  String? error, toggling;
  Json? form;
  final fields = {
    for (final name in ['name', 'provider', 'baseUrl', 'apiKey', 'models'])
      name: TextEditingController(),
  };
  WorkspaceController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final data = await c.api.request(
        'GET',
        '/api/model-providers',
        cancel: cancel,
      );
      if (!mounted) return;
      setState(() {
        templates = jsonList(data['templates']);
        providers = jsonList(data['providers']);
        site = jsonList(data['siteProviders']);
        cloud = data['cloudPersistence'] == true;
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> reloadModels() async {
    final data = await c.api.request('GET', '/api/models', cancel: cancel);
    c.models = jsonList(data['models']).map(ModelRef.fromJson).toList();
    c.model =
        c.models.where((m) => m.key == c.model?.key).firstOrNull ??
        c.models.firstOrNull;
    c.setDraft(c.draft);
  }

  void edit(Json item, {bool template = false}) {
    final id = (template ? item['id'] : item['provider']) as String;
    final siteItem = site.where((p) => p['provider'] == id).firstOrNull;
    final modelValues = template
        ? (siteItem?['models'] ?? item['defaultModels'])
        : item['models'];
    form = {
      'provider': id,
      'name': item['name'],
      'baseUrl': template ? item['defaultBaseUrl'] : item['baseUrl'],
      'apiKey': '',
      'enabled': template ? true : item['enabled'],
      'models': (modelValues as List? ?? []).join('\n'),
      'runtime': item['runtime'] ?? 'openai-compatible',
    };
    for (final entry in fields.entries) {
      entry.value.text = form![entry.key] as String? ?? '';
    }
    setState(() {
      error = null;
      revealKey = false;
    });
  }

  Future<void> save() async {
    setState(() {
      saving = true;
      error = null;
    });
    try {
      final body = {
        ...form!,
        for (final entry in fields.entries) entry.key: entry.value.text,
        'models': fields['models']!.text
            .split(RegExp(r'[\n,]'))
            .map((s) => s.trim())
            .where((s) => s.isNotEmpty)
            .toList(),
      };
      final data = await c.api.request(
        'PUT',
        '/api/model-providers',
        body: body,
        cancel: cancel,
      );
      if (!mounted) return;
      setState(() {
        providers = jsonList(data['providers']);
        form = null;
        fields['apiKey']!.clear();
      });
      await reloadModels();
      c.message('模型提供商已保存');
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> toggle(String id, bool enabled) async {
    final configured = providers.where((p) => p['provider'] == id).firstOrNull;
    final template = templates.where((p) => p['id'] == id).firstOrNull;
    if (enabled &&
        !site.any((p) => p['provider'] == id) &&
        configured?['hasApiKey'] != true) {
      if (template != null) {
        edit(template, template: true);
      } else {
        c.message('请先配置这个提供商');
      }
      return;
    }
    setState(() => toggling = id);
    try {
      final custom = configured?['isCustom'] == true;
      final data = await c.api.request(
        custom ? 'PUT' : 'PATCH',
        '/api/model-providers',
        body: custom
            ? {...configured!, 'apiKey': '', 'enabled': enabled}
            : {'provider': id, 'enabled': enabled},
        cancel: cancel,
      );
      if (mounted) setState(() => providers = jsonList(data['providers']));
      await reloadModels();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => toggling = null);
    }
  }

  Future<void> remove(Json provider) async {
    if (!await confirmAction(
      context,
      '删除用户提供商配置？',
      '“${provider['name']}” 的用户配置会被删除。若存在同名默认配置，将自动恢复。',
    )) {
      return;
    }
    try {
      await c.api.request(
        'DELETE',
        '/api/model-providers?provider=${Uri.encodeQueryComponent(provider['provider'] as String)}',
        cancel: cancel,
      );
      await load();
      await reloadModels();
      if (mounted) setState(() => form = null);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  @override
  void dispose() {
    cancel.cancel();
    for (final field in fields.values) {
      field.dispose();
    }
    super.dispose();
  }

  Widget field(String label, String key, {int lines = 1}) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 14)),
        const SizedBox(height: 8),
        TextField(
          controller: fields[key],
          minLines: lines,
          maxLines: lines,
          enabled:
              !saving &&
              !(key == 'provider' &&
                  (templates.any((p) => p['id'] == form?['provider']) ||
                      providers.any(
                        (p) => p['provider'] == form?['provider'],
                      ))),
          obscureText: key == 'apiKey' && !revealKey,
          autocorrect: key != 'apiKey',
          enableSuggestions: key != 'apiKey',
          onChanged: key == 'provider'
              ? (value) {
                  final text = value.toLowerCase().replaceAll(
                    RegExp('[^a-z0-9-]'),
                    '-',
                  );
                  if (text != value) {
                    fields[key]!.value = TextEditingValue(
                      text: text,
                      selection: TextSelection.collapsed(offset: text.length),
                    );
                  }
                }
              : null,
          style: TextStyle(
            fontSize: 14,
            letterSpacing: 0,
            fontFamily: key == 'models' ? 'monospace' : 'Noto Sans SC',
          ),
          decoration: InputDecoration(
            hintText: key == 'apiKey'
                ? providers.any(
                        (p) =>
                            p['provider'] == form?['provider'] &&
                            p['hasApiKey'] == true,
                      )
                      ? '留空表示保留现有 API Key'
                      : '请输入 API Key'
                : null,
            suffixIcon: key == 'apiKey'
                ? IconButton(
                    tooltip: revealKey ? '隐藏 API Key' : '显示 API Key',
                    onPressed: () => setState(() => revealKey = !revealKey),
                    icon: UiIcon(
                      revealKey ? LucideIcons.eyeOff : LucideIcons.eye,
                      size: 16,
                    ),
                  )
                : null,
          ),
        ),
      ],
    ),
  );
  Widget providerCard(Json template, {bool isSite = false}) {
    final id = (isSite ? template['provider'] : template['id']) as String;
    final configured = providers.where((p) => p['provider'] == id).firstOrNull,
        inherited = site.where((p) => p['provider'] == id).firstOrNull;
    final overrides =
        configured?['enabled'] == true &&
        configured?['hasApiKey'] == true &&
        (configured?['models'] as List? ?? []).isNotEmpty;
    final enabled =
        configured?['enabled'] != false && (overrides || inherited != null);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: !cloud || isSite
                  ? null
                  : () => configured != null
                        ? edit(configured)
                        : edit(template, template: true),
              child: Row(
                children: [
                  ModelBrand(model: id, provider: id, size: 23, plain: true),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 8,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              template['name'] as String? ?? id,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            Text(
                              configured?['enabled'] == false
                                  ? '已关闭'
                                  : overrides
                                  ? '个人配置'
                                  : inherited != null
                                  ? '已启用'
                                  : '未配置',
                              style: const TextStyle(
                                fontSize: 10,
                                color: Color(0xff9ca3af),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          configured?['enabled'] == false
                              ? '当前用户不显示此提供商的任何模型'
                              : overrides
                              ? '${(configured?['models'] as List).length} 个个人模型'
                              : inherited != null
                              ? '${(inherited['models'] as List).length} 个模型可用'
                              : template['description'] as String? ?? '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xff9ca3af),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (cloud && !isSite)
                    const UiIcon(LucideIcons.chevronRight, size: 16),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          ToggleSwitch(
            label: '${template['name']}启用状态',
            checked: enabled,
            onChanged: !cloud || toggling == id
                ? null
                : (value) => toggle(id, value),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (form != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: saving
                    ? null
                    : () => setState(() {
                        form = null;
                        fields['apiKey']!.clear();
                      }),
                child: const Text('← 返回 AI 提供商'),
              ),
            ),
            const SizedBox(height: 16),
            field('显示名称', 'name'),
            field('提供商 ID', 'provider'),
            field('Base URL', 'baseUrl'),
            field('API Key', 'apiKey'),
            field('模型 ID（每行一个，也支持逗号分隔）', 'models', lines: 7),
            Row(
              children: [
                ToggleSwitch(
                  label: '启用此提供商',
                  checked: form!['enabled'] == true,
                  onChanged: saving
                      ? null
                      : (value) => setState(() => form!['enabled'] = value),
                ),
                const SizedBox(width: 12),
                const Text('启用此提供商', style: TextStyle(fontSize: 14)),
              ],
            ),
            if (error != null)
              Text(error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: saving ? null : save,
                child: Text(saving ? '保存中…' : '保存配置'),
              ),
            ),
          ],
        ),
      );
    }
    final markai = site.where((p) => p['provider'] == 'markai').firstOrNull;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (loading) const LinearProgressIndicator(),
          if (error != null)
            TextButton(onPressed: load, child: Text('$error · 重试')),
          if (!cloud)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xfffffbeb),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                '当前为本地 SQLite 模式：可以使用管理员预置的模型；登录云端模式后，可保存自己的 API Key 并覆盖同名提供商。',
                style: TextStyle(fontSize: 12, color: Color(0xffb45309)),
              ),
            ),
          Container(
            margin: const EdgeInsets.only(bottom: 24),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary
                  .withValues(alpha: .035),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: Theme.of(context).colorScheme.primary
                    .withValues(alpha: .15),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('MarkAI', style: TextStyle(fontSize: 12)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Brand(size: 32),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'MarkAI 模型服务',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            markai == null
                                ? '暂未配置可用模型'
                                : '${(markai['models'] as List).length} 个专属模型可用',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xff9ca3af),
                            ),
                          ),
                        ],
                      ),
                    ),
                    ToggleSwitch(
                      label: 'MarkAI 模型服务',
                      checked:
                          markai != null &&
                          !providers.any(
                            (p) =>
                                p['provider'] == 'markai' &&
                                p['enabled'] == false,
                          ),
                      onChanged:
                          !cloud || markai == null || toggling == 'markai'
                          ? null
                          : (value) => toggle('markai', value),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Text(
            '内置 AI 提供商',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          const Text(
            '每个提供商都可以独立启用、关闭或填写个人配置。',
            style: TextStyle(fontSize: 12, color: Color(0xff9ca3af)),
          ),
          const SizedBox(height: 12),
          for (final template in templates) providerCard(template),
          for (final item in site.where(
            (p) =>
                p['provider'] != 'markai' &&
                !templates.any((t) => t['id'] == p['provider']),
          ))
            providerCard(item, isSite: true),
          for (final item in providers.where((p) => p['isCustom'] == true))
            ListTile(
              onTap: () => edit(item),
              title: Text(item['name'] as String),
              subtitle: Text(
                '${(item['models'] as List).length} 个模型 · ${item['baseUrl']}',
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ToggleSwitch(
                    label: '${item['name']}启用状态',
                    checked: item['enabled'] == true,
                    onChanged: toggling == item['provider']
                        ? null
                        : (value) => toggle(item['provider'] as String, value),
                  ),
                  MessageAction(
                    '删除提供商',
                    LucideIcons.trash2,
                    () => remove(item),
                  ),
                ],
              ),
            ),
          if (cloud)
            OutlinedButton(
              onPressed: () => edit({
                'provider': 'custom-provider',
                'name': '自定义提供商',
                'baseUrl': 'https://',
                'enabled': true,
                'models': <String>[],
                'runtime': 'openai-compatible',
              }),
              child: const Text('+ 添加 OpenAI 兼容提供商'),
            ),
        ],
      ),
    );
  }
}
