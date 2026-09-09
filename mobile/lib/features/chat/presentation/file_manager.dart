import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/common.dart';
import '../../../shared/widgets/ui_icon.dart';
import '../../previews/file_service.dart';
import '../../previews/file_preview.dart';
import 'managed_file_row.dart';
import '../application/workspace_controller.dart';

Future<void> showFileManager(BuildContext context, WorkspaceController c) =>
    Navigator.push(
      context,
      PageRouteBuilder<void>(
        pageBuilder: (_, _, _) => FileManager(controller: c),
        transitionDuration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 340),
        transitionsBuilder: (_, animation, _, child) => SlideTransition(
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

class FileManager extends StatefulWidget {
  final WorkspaceController controller;
  const FileManager({super.key, required this.controller});
  @override
  State<FileManager> createState() => _FileManagerState();
}

class _FileManagerState extends State<FileManager> {
  final cancel = CancelToken();
  final search = TextEditingController();
  final selected = <String>{};
  Json? data;
  String? error, uploading;
  bool busy = false;
  WorkspaceController get c => widget.controller;
  List<Json> get files => jsonList(data?['files'])
      .where(
        (f) => (f['name'] as String).toLowerCase().contains(
          search.text.toLowerCase().trim(),
        ),
      )
      .toList();
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load({bool clearError = true}) async {
    if (mounted && clearError) setState(() => error = null);
    try {
      final result = await c.api.request('GET', '/api/files', cancel: cancel);
      if (mounted) setState(() => data = result);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  Future<void> upload() async {
    final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: [
        'png',
        'jpg',
        'jpeg',
        'webp',
        'gif',
        'pdf',
        'txt',
        'md',
        'csv',
        'doc',
        'docx',
        'xlsx',
        'pptx',
      ],
    );
    if (!mounted || picked.isEmpty) return;
    for (final file in picked) {
      if (!mounted) break;
      setState(() => uploading = file.name);
      try {
        await FileService(c.api).upload(file, cancel, (_) {});
      } catch (e) {
        if (mounted) setState(() => error = e.toString());
      }
    }
    if (mounted) {
      setState(() => uploading = null);
      await load(clearError: false);
    }
  }

  Future<void> remove(List<String> ids) async {
    if (busy ||
        !await confirmAction(
          context,
          ids.length == 1 ? '删除文件？' : '批量删除文件？',
          '删除后无法恢复，引用这些文件的对话也将无法访问附件。',
        )) {
      return;
    }
    if (!mounted) return;
    setState(() => busy = true);
    try {
      // Server caps a bulk request at 50; preserve exact server acknowledgments.
      for (var offset = 0; offset < ids.length; offset += 50) {
        final batch = ids.skip(offset).take(50).toList();
        final result = await c.api.request(
          'DELETE',
          '/api/files',
          body: {'fileIds': batch},
          cancel: cancel,
        );
        final deleted = (result['deletedIds'] as List? ?? [])
            .cast<String>()
            .toSet();
        c.attachments.removeWhere((f) => deleted.contains(f['id']));
        selected.removeAll(deleted);
      }
      c.setDraft(c.draft);
      await load();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void addToChat() {
    final ids = c.attachments.map((f) => f['id']).toSet();
    final candidates = files
        .where((f) => selected.contains(f['id']) && !ids.contains(f['id']))
        .toList();
    final added = candidates
        .take((4 - c.attachments.length).clamp(0, 4))
        .toList();
    if (added.isEmpty) {
      c.message(c.attachments.length >= 4 ? '当前对话最多添加 4 个附件' : '所选文件已在输入框中');
      return;
    }
    c.attachments = [...c.attachments, ...added];
    c.setDraft(c.draft);
    c.message('${added.length} 个文件已加入当前对话');
    Navigator.pop(context);
  }

  @override
  void dispose() {
    cancel.cancel();
    search.dispose();
    super.dispose();
  }

  Widget stat(String label, String value) => Padding(
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: Color(0xff6b7280)),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ],
    ),
  );
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark,
        scheme = Theme.of(context).colorScheme;
    final usage = jsonMap(data?['usage']), limits = jsonMap(data?['limits']);
    final used = usage['size'] as num? ?? 0,
        capacity = limits['maxStorageBytes'] as num?;
    return Scaffold(
      backgroundColor: dark ? const Color(0xff0e0f11) : const Color(0xfff8f8f8),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              height: 64,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              color: scheme.surface,
              child: Row(
                children: [
                  const Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '文件管理',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          '管理已上传的附件',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xff6b7280),
                          ),
                        ),
                      ],
                    ),
                  ),
                  FilledButton.icon(
                    onPressed: uploading == null ? upload : null,
                    icon: const UiIcon(LucideIcons.plus, size: 17),
                    label: const Text('上传'),
                  ),
                  const SizedBox(width: 8),
                  ActionIcon(
                    '关闭文件管理',
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
                        Container(
                          decoration: BoxDecoration(
                            color: scheme.surface,
                            border: Border.symmetric(
                              horizontal: BorderSide(color: scheme.outline),
                            ),
                          ),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: stat(
                                      '文件',
                                      '${usage['count'] ?? '-'} / ${limits['maxFileCount'] ?? '不限'}',
                                    ),
                                  ),
                                  Expanded(
                                    child: stat(
                                      '存储空间',
                                      '${data == null ? '-' : formatFileBytes(used)} / ${capacity == null ? '不限' : formatFileBytes(capacity)}',
                                    ),
                                  ),
                                ],
                              ),
                              const Divider(),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 12,
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: LinearProgressIndicator(
                                        minHeight: 6,
                                        value: capacity == null || capacity == 0
                                            ? 0
                                            : (used / capacity)
                                                  .clamp(0, 1)
                                                  .toDouble(),
                                        color: const Color(0xff2563eb),
                                        backgroundColor: scheme.outline,
                                        borderRadius: BorderRadius.circular(3),
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    Text(
                                      '单个最大 ${limits['maxFileBytes'] == null ? '-' : formatFileBytes(limits['maxFileBytes'] as num)}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xff6b7280),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (uploading != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 16),
                            child: Text(
                              '正在上传 $uploading',
                              style: const TextStyle(fontSize: 14),
                            ),
                          ),
                        const SizedBox(height: 24),
                        SizedBox(
                          height: 40,
                          child: TextField(
                            controller: search,
                            onChanged: (_) => setState(selected.clear),
                            style: const TextStyle(
                              fontSize: 14,
                              letterSpacing: 0,
                            ),
                            decoration: InputDecoration(
                              hintText: '搜索文件名',
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              prefixIcon: const UiIcon(
                                LucideIcons.search,
                                size: 17,
                              ),
                              suffixIcon: search.text.isEmpty
                                  ? null
                                  : IconButton(
                                      tooltip: '清除搜索',
                                      onPressed: () => setState(() {
                                        search.clear();
                                        selected.clear();
                                      }),
                                      icon: const UiIcon(
                                        LucideIcons.x,
                                        size: 16,
                                      ),
                                    ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          alignment: WrapAlignment.spaceBetween,
                          children: [
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Checkbox(
                                  value:
                                      files.isNotEmpty &&
                                      selected.length == files.length,
                                  onChanged: files.isEmpty
                                      ? null
                                      : (checked) => setState(() {
                                          selected.clear();
                                          if (checked == true) {
                                            selected.addAll(
                                              files.map(
                                                (f) => f['id'] as String,
                                              ),
                                            );
                                          }
                                        }),
                                ),
                                Text(
                                  '已选择 ${selected.length} 个文件',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    color: Color(0xff6b7280),
                                  ),
                                ),
                              ],
                            ),
                            if (selected.isNotEmpty)
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextButton(
                                    onPressed: addToChat,
                                    child: const Text('加入对话'),
                                  ),
                                  TextButton(
                                    onPressed: busy
                                        ? null
                                        : () => remove(selected.toList()),
                                    child: const Text(
                                      '批量删除',
                                      style: TextStyle(color: Colors.red),
                                    ),
                                  ),
                                ],
                              ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        const Divider(),
                        if (error != null)
                          SizedBox(
                            height: 320,
                            child: Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(error!, textAlign: TextAlign.center),
                                  TextButton(
                                    onPressed: load,
                                    child: const Text('重试'),
                                  ),
                                ],
                              ),
                            ),
                          )
                        else if (data == null)
                          const SizedBox(
                            height: 320,
                            child: Center(
                              child: SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                            ),
                          )
                        else if (files.isEmpty)
                          SizedBox(
                            height: 320,
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color:
                                        Theme.of(context).brightness ==
                                            Brightness.dark
                                        ? const Color(0x0fffffff)
                                        : const Color(0xfff3f4f6),
                                  ),
                                  child: Center(
                                    child: UiIcon(
                                      search.text.isEmpty
                                          ? LucideIcons.cloudUpload
                                          : LucideIcons.search,
                                      size: search.text.isEmpty ? 22 : 21,
                                      color: const Color(0xff9ca3af),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  search.text.isEmpty ? '还没有上传文件' : '没有匹配的文件',
                                  style: TextStyle(
                                    fontSize: 14,
                                    height: 20 / 14,
                                    fontWeight: FontWeight.w500,
                                    color:
                                        Theme.of(context).brightness ==
                                            Brightness.dark
                                        ? const Color(0xffe5e7eb)
                                        : const Color(0xff374151),
                                  ),
                                ),
                                if (search.text.isEmpty)
                                  const SizedBox(height: 6),
                                if (search.text.isEmpty)
                                  const Text(
                                    '上传后可在对话中继续使用',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Color(0xff9ca3af),
                                    ),
                                  ),
                              ],
                            ),
                          )
                        else
                          for (final entry in files.indexed)
                            ManagedFileMobileRow(
                              file: entry.$2,
                              index: entry.$1,
                              selected: selected.contains(entry.$2['id']),
                              onPreview: supportsNativeFilePreview(entry.$2) ? () => showFilePreview(context, c.api, entry.$2) : null,
                              onSelected: (checked) => setState(() {
                                checked
                                    ? selected.add(entry.$2['id'] as String)
                                    : selected.remove(entry.$2['id']);
                              }),
                              onDownload: () async {
                                try {
                                  await FileService(c.api).saveFile(entry.$2);
                                } catch (error) {
                                  c.report(error);
                                }
                              },
                              onDelete: busy
                                  ? null
                                  : () => remove([entry.$2['id'] as String]),
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
