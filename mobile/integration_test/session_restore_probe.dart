// Manual two-process regression: run this entry, force-stop the QA package,
// then start the same installed APK again. No real account is used.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:markai_mobile/core/network/api_client.dart';
import 'package:markai_mobile/core/storage/local_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = SecureLocalStore();
  final previous = await store.read('qa-session-restore-probe');
  final api = ApiClient(store);
  String status;
  if (previous.isEmpty) {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    server.listen((request) async {
      request.response.headers.contentType = ContentType.json;
      request.response.cookies.add(
        Cookie('better-auth.session_token', 'qa-synthetic-session')
          ..maxAge = 172800
          ..httpOnly = true
          ..path = '/',
      );
      request.response.write(jsonEncode({'ok': true}));
      await request.response.close();
    });
    await api.configure('http://127.0.0.1:${server.port}');
    await api.request('POST', '/fixture-login');
    await store.write('qa-session-restore-probe', {'origin': api.baseUrl});
    await server.close(force: true);
    status = 'READY';
  } else {
    await api.configure(previous['origin'] as String);
    status =
        api.headers['Cookie'] ==
            'better-auth.session_token=qa-synthetic-session'
        ? 'PASSED'
        : 'FAILED';
  }
  api.dio.close(force: true);
  debugPrint('QA_SESSION_RESTORE: $status');
  runApp(
    MaterialApp(
      home: Scaffold(body: Center(child: Text('登录态进程重启验证：$status'))),
    ),
  );
}
