import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/models/chat.dart';
import '../../../shared/widgets/ui_icon.dart';
import '../application/workspace_controller.dart';

class SessionSearch extends StatefulWidget {
  final WorkspaceController controller;
  const SessionSearch({super.key, required this.controller});
  @override
  State<SessionSearch> createState() => _SessionSearchState();
}

class _SessionSearchState extends State<SessionSearch> {
  final input = TextEditingController();
  Timer? debounce;
  CancelToken? request;
  int revision = 0;
  List<Json> results = [];
  String? cursor, error;
  bool loading = false, loadingMore = false;
  void changed(String value) {
    debounce?.cancel();
    request?.cancel();
    revision++;
    setState(() {
      results = [];
      cursor = null;
      error = null;
      loading = value.trim().isNotEmpty;
      loadingMore = false;
    });
    if (value.trim().isEmpty) return;
    debounce = Timer(const Duration(milliseconds: 220), () => load());
  }

  Future<void> load({bool more = false}) async {
    if (more && (loadingMore || loading || cursor == null)) return;
    final id = revision, query = input.text.trim(), token = CancelToken();
    request = token;
    if (more) setState(() => loadingMore = true);
    try {
      final params = Uri(
        queryParameters: {
          'q': query,
          'limit': '30',
          if (more) 'cursor': cursor!,
        },
      ).query;
      final data = await widget.controller.api.request(
        'GET',
        '/api/sessions?$params',
        cancel: token,
      );
      if (!mounted || id != revision || token.isCancelled) return;
      setState(() {
        final rows = jsonList(data['sessions']);
        results = more
            ? {
                ...{for (final r in results) r['id']: r},
                ...{for (final r in rows) r['id']: r},
              }.values.toList()
            : rows;
        cursor = data['nextCursor'] as String?;
      });
    } catch (e) {
      if (mounted && id == revision && !token.isCancelled) {
        setState(() => error = '搜索会话失败，请重试');
      }
    } finally {
      if (mounted && id == revision) {
        setState(() {
          loading = false;
          loadingMore = false;
        });
      }
    }
  }

  @override
  void dispose() {
    debounce?.cancel();
    request?.cancel();
    input.dispose();
    super.dispose();
  }

  Widget highlight(String text, TextStyle style) {
    final query = input.text.trim().toLowerCase(), lower = text.toLowerCase();
    final spans = <TextSpan>[];
    var start = 0;
    if (query.isEmpty) return Text(text, style: style);
    while (start < text.length) {
      final index = lower.indexOf(query, start);
      if (index < 0) {
        spans.add(TextSpan(text: text.substring(start)));
        break;
      }
      spans.add(TextSpan(text: text.substring(start, index)));
      spans.add(
        TextSpan(
          text: text.substring(index, index + query.length),
          style: TextStyle(
            backgroundColor: Theme.of(context).colorScheme.primary
                .withValues(alpha: .15),
          ),
        ),
      );
      start = index + query.length;
    }
    return Text.rich(
      TextSpan(children: spans),
      style: style,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context),
        dark = Theme.of(context).brightness == Brightness.dark;
    final decoration = BoxDecoration(
      color: dark ? const Color(0xff191919) : Colors.white,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: Theme.of(context).colorScheme.outline),
      boxShadow: const [
        BoxShadow(
          color: Color(0x29000000),
          blurRadius: 36,
          offset: Offset(0, 16),
        ),
      ],
    );
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          12,
          math.max(72, media.size.height * .3),
          12,
          12 + media.viewInsets.bottom,
        ),
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: Material(
              color: Colors.transparent,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    height: 54,
                    decoration: decoration,
                    padding: const EdgeInsets.only(left: 16, right: 4),
                    child: Row(
                      children: [
                        const UiIcon(
                          LucideIcons.search,
                          size: 18,
                          color: Color(0xff9ca3af),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: input,
                            autofocus: true,
                            onChanged: changed,
                            style: const TextStyle(
                              fontSize: 15,
                              letterSpacing: 0,
                            ),
                            decoration: const InputDecoration(
                              hintText: '搜索会话标题或消息内容',
                              isDense: true,
                              filled: false,
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              contentPadding: EdgeInsets.zero,
                            ),
                          ),
                        ),
                        if (input.text.isNotEmpty)
                          SizedBox(
                            width: 40,
                            height: 40,
                            child: IconButton(
                              tooltip: '清除搜索',
                              onPressed: () {
                                input.clear();
                                changed('');
                              },
                              icon: const UiIcon(LucideIcons.x, size: 16),
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (input.text.trim().isNotEmpty)
                    Flexible(
                      child: Container(
                        margin: const EdgeInsets.only(top: 8),
                        constraints: BoxConstraints(
                          maxHeight: math.min(media.size.height * .62, 520),
                        ),
                        decoration: decoration,
                        child: NotificationListener<ScrollNotification>(
                          onNotification: (event) {
                            if (event.metrics.extentAfter <= 120) {
                              load(more: true);
                            }
                            return false;
                          },
                          child: ListView(
                            shrinkWrap: true,
                            padding: const EdgeInsets.all(8),
                            children: [
                              if (loading)
                                for (var i = 0; i < 4; i++)
                                  Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          width: 130,
                                          height: 16,
                                          color: Theme.of(context)
                                              .colorScheme
                                              .surfaceContainerHighest,
                                        ),
                                        const SizedBox(height: 8),
                                        Container(
                                          width: 260,
                                          height: 12,
                                          color: Theme.of(context)
                                              .colorScheme
                                              .surfaceContainerHighest,
                                        ),
                                      ],
                                    ),
                                  )
                              else if (error != null)
                                TextButton(onPressed: load, child: Text(error!))
                              else if (results.isEmpty)
                                const SizedBox(
                                  height: 144,
                                  child: Center(
                                    child: Text(
                                      '没有找到相关会话',
                                      style: TextStyle(
                                        fontSize: 14,
                                        color: Color(0xff9ca3af),
                                      ),
                                    ),
                                  ),
                                )
                              else
                                for (final result in results)
                                  InkWell(
                                    borderRadius: BorderRadius.circular(8),
                                    onTap: () =>
                                        Navigator.pop(context, result['id']),
                                    child: Padding(
                                      padding: const EdgeInsets.all(12),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          highlight(
                                            result['title'] as String? ?? '新对话',
                                            const TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                          if (result['searchSnippet'] != null)
                                            Padding(
                                              padding: const EdgeInsets.only(
                                                top: 4,
                                              ),
                                              child: highlight(
                                                (result['searchSnippet']
                                                        as String)
                                                    .replaceAll(
                                                      RegExp(r'\s+'),
                                                      ' ',
                                                    )
                                                    .trim(),
                                                const TextStyle(
                                                  fontSize: 12,
                                                  height: 20 / 12,
                                                  color: Color(0xff6b7280),
                                                ),
                                              ),
                                            ),
                                          const SizedBox(height: 6),
                                          Text(
                                            '${result['messageCount'] ?? 0} 条消息 · ${DateTime.fromMillisecondsSinceEpoch((result['updatedAt'] as num? ?? 0).toInt())}',
                                            style: const TextStyle(
                                              fontFamily: 'Plus Jakarta Sans',
                                              fontSize: 11,
                                              color: Color(0xff9ca3af),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                              if (loadingMore)
                                const SizedBox(
                                  height: 40,
                                  child: Center(
                                    child: SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    ),
                                  ),
                                ),
                              if (!loading &&
                                  !loadingMore &&
                                  results.isNotEmpty &&
                                  cursor == null)
                                const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 12),
                                  child: Center(
                                    child: Text(
                                      '已显示全部结果',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Color(0xff9ca3af),
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
              ),
            ),
          ),
        ),
      ),
    );
  }
}
