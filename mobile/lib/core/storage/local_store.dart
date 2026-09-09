import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../shared/models/chat.dart';

abstract class LocalStore {
  Future<Json> read(String key);
  Future<void> write(String key, Json value);
  Future<void> remove(String key);
}

class SecureLocalStore implements LocalStore {
  final FlutterSecureStorage storage = const FlutterSecureStorage();
  @override
  Future<Json> read(String key) async {
    final text = await storage.read(key: 'markai:$key');
    return text == null ? {} : jsonMap(jsonDecode(text));
  }

  @override
  Future<void> write(String key, Json value) =>
      storage.write(key: 'markai:$key', value: jsonEncode(value));
  @override
  Future<void> remove(String key) => storage.delete(key: 'markai:$key');
}
