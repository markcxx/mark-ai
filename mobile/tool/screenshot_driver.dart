import 'dart:io';
import 'dart:convert';

import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() => integrationDriver(
  responseDataCallback: (data) async {
    if ((data?['exports'] as Map? ?? {}).isNotEmpty) {
      await Directory('qa').create(recursive: true);
    }
    for (final entry in (data?['exports'] as Map? ?? {}).entries) {
      final name = entry.key.toString();
      if (!RegExp(r'^[a-z0-9-]+\.png$').hasMatch(name)) continue;
      await File('qa/$name').writeAsBytes(base64Decode(entry.value as String));
    }
  },
  onScreenshot: (name, bytes, [args]) async {
    await Directory('qa').create(recursive: true);
    await File('qa/$name.png').writeAsBytes(bytes);
    return true;
  },
);
