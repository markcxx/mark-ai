import 'dart:convert';

typedef Json = Map<String, dynamic>;
Json jsonMap(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : {};
List<Json> jsonList(dynamic value) =>
    value is List ? value.map(jsonMap).toList() : [];
Json cloneJson(Json value) => jsonMap(jsonDecode(jsonEncode(value)));

class ModelRef {
  final String id;
  final String provider;
  final Json metadata;
  ModelRef(this.id, this.provider, [this.metadata = const {}]);
  factory ModelRef.fromJson(Json json) =>
      ModelRef(json['id'] as String, json['provider'] as String, json);
  String get key => '$provider:$id';
  String get label => metadata['name'] as String? ?? id;
  Json toJson() => {'id': id, 'provider': provider};
}

/// Retains all protocol fields, including newer segments unknown to this client.
/// Presentation reads typed accessors; persistence never drops server metadata.
class ChatMessage {
  final Json data;
  ChatMessage(Json data) : data = cloneJson(data);
  String get id => data['id'] as String;
  String get role => data['role'] as String;
  String get content => data['content'] as String? ?? '';
  set content(String value) => data['content'] = value;
  bool get isUser => role == 'user';
  bool get streaming => data['isStreaming'] == true;
  bool get interrupted => data['interrupted'] == true;
  List<Json> get segments => jsonList(data['segments']);
  set segments(List<Json> value) => data['segments'] = value;
  List<Json> get attachments => jsonList(data['attachments']);
  List<Json> get variants => jsonList(data['variants']);
  ChatMessage copy() => ChatMessage(data);
  Json toJson() => cloneJson(data);
  Json toPrompt() => {
    'role': role,
    'content': [
      ...segments.where((s) => s['type'] == 'quote').map((s) => s['content']),
      content,
    ].join('\n\n'),
    if (attachments.isNotEmpty) 'attachments': attachments,
    'generatedImageIds': segments
        .where((s) => s['type'] == 'generated-image')
        .map((s) => jsonMap(jsonMap(s['generatedImage'])['file'])['id'])
        .whereType<String>()
        .toList(),
  };
}

class ChatSession {
  final Json data;
  ChatSession(Json data) : data = cloneJson(data);
  String get id => data['id'] as String;
  String get title => data['title'] as String? ?? '新对话';
  int get revision => (data['revision'] as num?)?.toInt() ?? 0;
  bool get favorite => data['favorite'] == true;
  int get updatedAt => (data['updatedAt'] as num?)?.toInt() ?? 0;
}
