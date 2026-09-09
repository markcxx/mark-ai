import 'chat.dart';
import 'model_metadata_data.dart';

String modelDisplayName(String id) => id.split('/').last;
bool isImageGenerationModel(String id) =>
    imageGenerationModelIds.contains(id.trim().toLowerCase());
Map<String, dynamic>? metadataForModel(String id) {
  final normalized =
      id
          .trim()
          .toLowerCase()
          .split('/')
          .where((p) => p.isNotEmpty)
          .lastOrNull ??
      id;
  for (final entry in modelMetadata) {
    for (final candidate in [entry['id'], ...entry['aliases'] as List? ?? []]) {
      final key = candidate.toString().toLowerCase();
      if (normalized == key ||
          normalized.startsWith('$key-20') ||
          normalized.startsWith('$key-preview-') ||
          normalized == '$key-latest' ||
          normalized.startsWith('$key:')) {
        return entry;
      }
    }
  }
  return null;
}

String formatTokenCount(num tokens) {
  if (tokens >= 1000000) {
    return '${(tokens % 1000000 == 0 ? (tokens / 1000000).toStringAsFixed(0) : (tokens / 1000000).toStringAsFixed(2).replaceFirst(RegExp(r'0+$'), ''))}M';
  }
  if (tokens >= 1000) {
    return '${(tokens / 1000).toStringAsFixed(tokens % 1000 == 0 ? 0 : 1)}K';
  }
  return '$tokens';
}

String modelFamily(String id) {
  final value = modelDisplayName(id).toLowerCase();
  for (final family in [
    'deepseek',
    'doubao',
    'qwen',
    'gemini',
    'claude',
    'gpt',
    'kimi',
    'moonshot',
    'minimax',
    'glm',
    'grok',
    'mimo',
    'llama',
    'mistral',
    'command',
    'yi',
    'phi',
    'ernie',
    'hunyuan',
    'baichuan',
  ]) {
    if (RegExp(
      '(?:${['gpt', 'glm', 'yi', 'phi'].contains(family) ? '^|[-_.]' : ''})$family${['gpt', 'glm', 'yi', 'phi'].contains(family) ? '(?:[-_.]|\$)' : ''}',
    ).hasMatch(value)) {
      return family;
    }
  }
  if (RegExp(r'^o\d').hasMatch(value)) return 'openai-o';
  return RegExp('[a-z]+').firstMatch(value)?.group(0) ?? value;
}

List<ModelRef> sortModelsByFamily(List<ModelRef> models) {
  final groups = <String, List<ModelRef>>{};
  for (final model in models) {
    (groups[modelFamily(model.id)] ??= []).add(model);
  }
  List<int> version(String id, String family) {
    var value = modelDisplayName(id).toLowerCase();
    final index = value.indexOf(family);
    if (index >= 0) value = value.substring(index + family.length);
    for (final match in RegExp(r'[vkmr]?(\d+(?:[.-]\d+)?)').allMatches(value)) {
      var raw = match.group(1)!;
      final next = match.end < value.length ? value[match.end] : '';
      if (next == 'b' || next == 'k') {
        if (RegExp('[.-]').hasMatch(raw)) {
          raw = raw.replaceFirst(RegExp(r'[.-]\d+$'), '');
        } else {
          continue;
        }
      }
      return raw.split(RegExp('[.-]')).map(int.parse).toList();
    }
    return [];
  }

  int natural(String a, String b) {
    final aa = RegExp(r'\d+|\D+')
            .allMatches(a.toLowerCase())
            .map((m) => m.group(0)!)
            .toList(),
        bb = RegExp(r'\d+|\D+')
            .allMatches(b.toLowerCase())
            .map((m) => m.group(0)!)
            .toList();
    for (var i = 0; i < aa.length && i < bb.length; i++) {
      final an = int.tryParse(aa[i]), bn = int.tryParse(bb[i]);
      final result = an != null && bn != null
          ? an.compareTo(bn)
          : aa[i].compareTo(bb[i]);
      if (result != 0) return result;
    }
    return aa.length.compareTo(bb.length);
  }

  num parameters(String id) =>
      RegExp(r'(\d+(?:\.\d+)?)b(?:\b|[-_.])')
          .allMatches(id.toLowerCase())
          .fold<num>(0, (max, m) {
            final n = num.parse(m.group(1)!);
            return n > max ? n : max;
          });
  int release(String id) {
    final full = RegExp(
      r'(?:^|[-_.])(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})(?:$|[-_.])',
    ).firstMatch(id);
    if (full != null) {
      return int.parse('${full.group(1)}${full.group(2)}${full.group(3)}');
    }
    return int.tryParse(
          RegExp(r'(?:^|[-_.])((?:20)?\d{2}(?:0[1-9]|1[0-2]))(?:$|[-_.])')
                  .firstMatch(id)
                  ?.group(1) ??
              '',
        ) ??
        0;
  }

  int tier(String id) {
    const scores = {
      'pro': 100,
      'max': 95,
      'ultra': 90,
      'opus': 85,
      'plus': 80,
      'sonnet': 75,
      'thinking': 70,
      'reasoner': 70,
      'coder': 65,
      'code': 65,
      'turbo': 60,
      'flash': 50,
      'mini': 40,
      'lite': 30,
      'nano': 20,
    };
    return id
        .toLowerCase()
        .split(RegExp('[^a-z0-9]+'))
        .fold(
          0,
          (score, token) =>
              (scores[token] ?? 0) > score ? scores[token]! : score,
        );
  }

  for (final entry in groups.entries) {
    entry.value.sort((a, b) {
      final av = version(a.id, entry.key), bv = version(b.id, entry.key);
      for (var i = 0; i < av.length || i < bv.length; i++) {
        final d = (i < bv.length ? bv[i] : 0) - (i < av.length ? av[i] : 0);
        if (d != 0) return d;
      }
      for (final d in [
        parameters(b.id).compareTo(parameters(a.id)),
        release(b.id) - release(a.id),
        tier(b.id) - tier(a.id),
        natural(b.id, a.id),
      ]) {
        if (d != 0) return d;
      }
      return 0;
    });
  }
  return groups.values.expand((m) => m).toList();
}
