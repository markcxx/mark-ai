import 'package:flutter/foundation.dart';

const appApiUrl = String.fromEnvironment(
  'MARKAI_API_URL',
  defaultValue: 'https://chatai.markqq.com',
);

// Release builds always use the compiled endpoint, never a saved debug address.
String resolveAppEndpoint(
  String? debugAddress, {
  bool release = kReleaseMode,
}) => release ? appApiUrl : debugAddress ?? appApiUrl;
