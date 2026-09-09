import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() => integrationDriver(
  onScreenshot: (name, bytes, [args]) async {
    await Directory('qa').create(recursive: true);
    await File('qa/$name.png').writeAsBytes(bytes);
    return true;
  },
);
