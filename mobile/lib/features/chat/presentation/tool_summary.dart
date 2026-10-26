import '../../../shared/models/chat.dart';

class ToolSummary {
  final String label;
  final String? detail;
  const ToolSummary(this.label, [this.detail]);
  String get text => detail == null ? label : '$label $detail';
}

String _clean(dynamic value) =>
    value is String ? value.replaceAll(RegExp(r'\s+'), ' ').trim() : '';
ToolSummary _withDetail(String label, dynamic detail) {
  final value = _clean(detail);
  return ToolSummary(
    label,
    value.isNotEmpty && !label.contains(value) ? value : null,
  );
}

String _pageTarget(Json data) {
  final result = jsonList(data['results']).firstOrNull ?? {};
  final title = _clean(data['title']).isNotEmpty
      ? _clean(data['title'])
      : _clean(result['title']);
  final url = _clean(data['url']).isNotEmpty
      ? _clean(data['url'])
      : _clean(result['url']).isNotEmpty
      ? _clean(result['url'])
      : data['tool'] == 'read_webpage'
      ? _clean(data['query'])
      : '';
  if (title.isNotEmpty &&
      !RegExp(r'^https?://', caseSensitive: false).hasMatch(title)) {
    return title;
  }
  final uri = Uri.tryParse(url.isNotEmpty ? url : title);
  if (uri != null && uri.host.isNotEmpty) {
    return '${uri.host.replaceFirst(RegExp(r'^www\.'), '')}${uri.path == '/' ? '' : uri.path}';
  }
  return title.isNotEmpty ? title : url;
}

ToolSummary webToolSummary(Json data) {
  final running = data['status'] == 'searching';
  final failed = data['status'] == 'error';
  switch (data['tool']) {
    case 'read_webpage':
      return _withDetail(
        running
            ? '正在读取'
            : failed
            ? '读取失败'
            : '已读取',
        _pageTarget(data),
      );
    case 'find_in_page':
      final label = running
          ? '正在查找'
          : failed
          ? '查找失败'
          : '已查找';
      final target = _pageTarget(data);
      final matches = jsonMap(data['page'])['matches'];
      return _withDetail(
        label,
        '${_clean(data['query'])}${target.isNotEmpty ? ' · $target' : ''}${!running && !failed && matches is List ? ' · ${matches.length} 处匹配' : ''}',
      );
    case 'show_images':
      return ToolSummary(
        running
            ? '正在整理图片'
            : failed
            ? '图片展示失败'
            : '已展示 ${jsonList(data['images']).length} 张图片',
      );
    default:
      return _withDetail(
        running
            ? '正在搜索'
            : failed
            ? '搜索失败'
            : '已搜索',
        data['query'],
      );
  }
}

const _actions = {
  'calculate_expression': ['正在计算表达式', '已完成表达式计算', '表达式计算失败'],
  'summarize_numbers': ['正在统计数值', '已完成数值统计', '数值统计失败'],
  'convert_units': ['正在换算单位', '已完成单位换算', '单位换算失败'],
  'create_excel_workbook': ['正在生成表格', '已生成表格', '表格生成失败'],
  'render_echarts_chart': ['正在校验图表', '已生成图表', '图表校验失败'],
  'word_document_begin': ['正在规划文档结构', '已规划文档结构', '文档规划失败'],
  'word_document_open': ['正在打开可编辑文档', '已打开可编辑文档', '打开文档失败'],
  'word_document_append': ['正在构建文档章节', '已构建文档章节', '章节构建失败'],
  'word_document_revise': ['正在修改文档内容', '已修改文档内容', '文档修改失败'],
  'word_document_restyle': ['正在修改文档样式', '已修改文档样式', '样式修改失败'],
  'word_document_inspect': ['正在检查文档结构与格式', '已检查文档结构与格式', '文档检查失败'],
  'word_document_finalize': ['正在打包 Word 文档', '已生成 Word 文档', '文档打包失败'],
};
ToolSummary generatedToolSummary(Json data, {String? toolLabel}) {
  final action = _actions[data['toolName']];
  final name = _clean(toolLabel).isNotEmpty
      ? _clean(toolLabel)
      : _clean(data['toolName']).isNotEmpty
      ? _clean(data['toolName'])
      : '工具';
  final progress = jsonMap(data['progress']);
  String base;
  if (data['status'] == 'running') {
    base = action == null ? '正在执行$name' : action[0];
  } else if (data['status'] == 'error') {
    base = action == null ? '$name执行失败' : action[2];
  } else {
    base = _clean(progress['label']).isNotEmpty
        ? _clean(progress['label'])
        : action == null
        ? '已执行$name'
        : action[1];
  }
  final detail = _clean(jsonMap(data['file'])['name']).isNotEmpty
      ? jsonMap(data['file'])['name']
      : _clean(progress['detail']).isNotEmpty
      ? progress['detail']
      : jsonMap(data['preview'])['title'];
  return _withDetail(base, detail);
}
