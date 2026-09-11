import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

Future<Map<String, String>> loadClientIdentityHeaders() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return {};
  final headers = {'X-MarkAI-Platform': 'android'};
  try {
    // Reuse the native installed-package info used by the updater.
    final info = await const MethodChannel('markai/updates')
        .invokeMapMethod<String, dynamic>('info');
    final version = info?['versionName'];
    if (version is String && RegExp(r'^\d+\.\d+\.\d+$').hasMatch(version)) {
      headers['X-MarkAI-App-Version'] = version;
    }
  } catch (_) {
    // Version lookup must not prevent login or other network requests.
  }
  return headers;
}
