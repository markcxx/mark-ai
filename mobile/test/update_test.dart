import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/updates/update_service.dart';
import 'package:markai_mobile/features/updates/update_preview.dart';
import 'package:markai_mobile/features/updates/update_widgets.dart';
import 'package:markai_mobile/core/theme/markai_theme.dart';

import 'support/fake_workspace.dart';

Map<String, dynamic> manifest(List<int> bytes) => {
  'versionName': '1.0.2',
  'versionCode': 3,
  'minSdk': 24,
  'packageName': 'com.markai.markai_mobile',
  'size': bytes.length,
  'sha256': sha256.convert(bytes).toString(),
  'releaseNotes': '修复已知问题',
  'downloadUrl': '/api/public/android-update/download?versionCode=3',
};

class BytesAdapter implements HttpClientAdapter {
  final List<int> bytes;
  BytesAdapter(this.bytes);
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => ResponseBody(
    Stream.value(Uint8List.fromList(bytes)),
    200,
    headers: {
      Headers.contentLengthHeader: ['${bytes.length}'],
    },
  );
  @override
  void close({bool force = false}) {}
}

class RouteAdapter implements HttpClientAdapter {
  final ResponseBody Function(RequestOptions) respond;
  final List<RequestOptions> requests = [];
  RouteAdapter(this.respond);
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody jsonResponse(Object value, [int status = 200]) =>
    ResponseBody.fromString(
      jsonEncode(value),
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );

Map<String, dynamic> releaseFixture(String version, int code) {
  final data = {
    ...manifest([1, 2, 3]),
    'versionName': version,
    'versionCode': code,
    'downloadUrl': '/api/public/android-update/download?versionCode=$code',
    'downloads': [
      {
        'id': 'mirror',
        'url': '$updateMirrorBase/android/$version/MarkAI-$version.apk',
      },
      {
        'id': 'github',
        'url':
            'https://github.com/$updateRepository/releases/download/android-v$version/MarkAI-$version.apk',
      },
    ],
  };
  return {
    'tag_name': 'android-v$version',
    'draft': false,
    'prerelease': false,
    'body': '修复问题\n\n<!-- markai-android-update\n${jsonEncode(data)}\n-->',
    'assets': [
      {
        'name': 'MarkAI-$version.apk',
        'state': 'uploaded',
        'size': 3,
        'digest': 'sha256:${data['sha256']}',
      },
    ],
  };
}

class FakeUpdates extends UpdateService {
  bool debug = false, offline = false, permission = true;
  int checks = 0, downloads = 0, installs = 0, permissionRequests = 0;
  int installedCode = 2;
  AndroidUpdate? available = AndroidUpdate.fromJson(manifest([1, 2, 3]));
  Completer<File>? downloadGate;
  CancelToken? downloadToken;
  String? lastChannel;
  @override
  Future<Map<String, dynamic>> info() async => {
    'versionName': '1.0.1',
    'versionCode': installedCode,
    'sdk': 36,
    'debug': debug,
  };
  @override
  Future<void> cleanCache() async {}
  @override
  Future<AndroidUpdate?> check() async {
    checks++;
    if (offline) throw Exception('offline');
    return available;
  }

  @override
  Future<File> download(
    AndroidUpdate update,
    CancelToken token,
    void Function(int, int) progress, {
    String? channelId,
  }) async {
    downloads++;
    lastChannel = channelId;
    downloadToken = token;
    progress(1, 3);
    return downloadGate == null
        ? File('/tmp/test-update.apk')
        : await downloadGate!.future;
  }

  @override
  Future<bool> canInstall() async => permission;
  @override
  Future<void> requestPermission() async {
    permissionRequests++;
  }

  @override
  Future<void> install(File file, AndroidUpdate update) async {
    installs++;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'GitHub API is queried directly and newest numeric Android version wins',
    () async {
      final adapter = RouteAdapter(
        (_) => jsonResponse([
          {...releaseFixture('99.0.0', 99), 'tag_name': 'v99.0.0'},
          {...releaseFixture('9.0.0', 9), 'draft': true},
          {...releaseFixture('8.0.0', 8), 'prerelease': true},
          releaseFixture('1.0.9', 1000009),
          releaseFixture('1.0.10', 1000010),
        ]),
      );
      final service = UpdateService(dio: Dio()..httpClientAdapter = adapter);
      final update = (await service.check())!;
      expect(update.versionName, '1.0.10');
      expect(update.notes, '修复问题');
      expect(update.downloads.map((d) => d.label), ['加速下载', 'GitHub']);
      expect(adapter.requests.single.uri.host, 'api.github.com');
      expect(
        adapter.requests.single.headers.containsKey('Authorization'),
        false,
      );
      expect(compareUpdateVersions('1.10.0', '1.9.9'), greaterThan(0));
    },
  );

  test(
    'GitHub rate limit falls back to the published snapshot, never app backend',
    () async {
      final release = releaseFixture('1.0.3', 1000003);
      final embedded = RegExp(r'<!-- markai-android-update\s*([\s\S]*?)\s*-->')
          .firstMatch(release['body'] as String)!;
      final data = {
        ...Map<String, dynamic>.from(jsonDecode(embedded.group(1)!)),
        'repository': updateRepository,
        'published': true,
      };
      final adapter = RouteAdapter(
        (request) => request.uri.host == 'api.github.com'
            ? jsonResponse({'message': 'rate limited'}, 403)
            : jsonResponse(data),
      );
      final service = UpdateService(dio: Dio()..httpClientAdapter = adapter);
      expect((await service.check())!.versionName, '1.0.3');
      expect(
        adapter.requests.last.uri.toString(),
        '$updateMirrorBase/android/latest.json',
      );
    },
  );

  test(
    'mismatched GitHub APK digest fails instead of falling back to stale data',
    () async {
      final release = releaseFixture('1.0.3', 1000003);
      (release['assets'] as List).first['digest'] = 'sha256:bad';
      final adapter = RouteAdapter((_) => jsonResponse([release]));
      await expectLater(
        UpdateService(dio: Dio()..httpClientAdapter = adapter).check(),
        throwsFormatException,
      );
      expect(adapter.requests.length, 1);
    },
  );
  testWidgets(
    'local preview uses real dialog with simulated download and no installer',
    (tester) async {
      final service = PreviewUpdateService();
      final update = (await service.check())!;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: UpdateDialog(service: service, update: update),
          ),
        ),
      );
      expect(find.text('发现新版本 1.0.3'), findsOneWidget);
      await tester.tap(find.text('下载更新'));
      await tester.pump();
      for (var step = 0; step < 21; step++) {
        await tester.pump(const Duration(milliseconds: 150));
      }
      await tester.pumpAndSettle();
      expect(find.textContaining('本次没有下载安装包'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  test('local preview download honors cancellation', () async {
    final service = PreviewUpdateService();
    final token = CancelToken()..cancel();
    await expectLater(
      service.download((await service.check())!, token, (_, _) {
        fail('Cancelled download must not report progress');
      }),
      throwsA(isA<DioException>()),
    );
  });
  test(
    'manifest rejects unexpected download targets, packages and versions',
    () {
      for (final change in [
        {'downloadUrl': 'https://example.com/file.apk'},
        {'packageName': 'other'},
        {'versionCode': 0},
        {'sha256': 'bad'},
        {'size': -1},
      ]) {
        expect(
          () => AndroidUpdate.fromJson({
            ...manifest([1]),
            ...change,
          }),
          throwsFormatException,
        );
      }
    },
  );

  group('download integrity', () {
    late Directory temp;
    setUp(() async {
      temp = await Directory.systemTemp.createTemp('markai-update-test-');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            (_) async => temp.path,
          );
    });
    tearDown(() async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/path_provider'),
            null,
          );
      await temp.delete(recursive: true);
    });
    test('verified download is promoted from partial to APK', () async {
      final bytes = utf8.encode('fixture APK content');
      final service = UpdateService(
        dio: Dio()..httpClientAdapter = BytesAdapter(bytes),
      );
      final file = await service.download(
        AndroidUpdate.fromJson(manifest(bytes)),
        CancelToken(),
        (_, _) {},
      );
      expect(await file.readAsBytes(), bytes);
      expect(await File('${file.path}.part').exists(), false);
    });
    test(
      'checksum mismatch removes partial download and never creates APK',
      () async {
        final service = UpdateService(
          dio: Dio()..httpClientAdapter = BytesAdapter([4, 5, 6]),
        );
        await expectLater(
          service.download(
            AndroidUpdate.fromJson(manifest([1, 2, 3])),
            CancelToken(),
            (_, _) {},
          ),
          throwsFormatException,
        );
        expect(
          await Directory('${temp.path}/updates').list().toList(),
          isEmpty,
        );
      },
    );
  });

  Future<void> host(
    WidgetTester tester,
    FakeUpdates service,
    MemoryStore local, {
    Brightness brightness = Brightness.light,
  }) async {
    final navigator = GlobalKey<NavigatorState>();
    await tester.pumpWidget(
      MaterialApp(
        theme: markaiTheme(brightness),
        navigatorKey: navigator,
        builder: (context, child) => UpdateHost(
          navigator: navigator,
          local: local,
          enabled: true,
          service: service,
          child: child!,
        ),
        home: const Scaffold(body: UpdateSettings()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('user can select GitHub before download', (tester) async {
    final service = FakeUpdates();
    service.available = UpdateService().parseRelease(
      releaseFixture('1.0.3', 1000003),
    );
    await host(tester, service, MemoryStore());
    await tester.tap(find.text('加速下载'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('GitHub'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('下载更新'));
    await tester.pumpAndSettle();
    expect(service.lastChannel, 'github');
    expect(service.downloads, 1);
  });

  for (final width in [320.0, 390.0]) {
    for (final brightness in Brightness.values) {
      testWidgets('update dialog fits $width $brightness with long notes', (
        tester,
      ) async {
        tester.view.physicalSize = Size(width, 844);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final service = FakeUpdates();
        service.available = AndroidUpdate.fromJson({
          ...manifest([1, 2, 3]),
          'releaseNotes': List.filled(30, '修复消息输出与工具调用的显示问题。').join('\n'),
        });
        await host(tester, service, MemoryStore(), brightness: brightness);
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.text('下载更新'));
        await tester.pumpAndSettle();
        expect(find.text('下载更新').hitTestable(), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  }

  testWidgets(
    'automatic update waits for boot and an open route, then offers later',
    (tester) async {
      final navigator = GlobalKey<NavigatorState>();
      final ready = ValueNotifier(false);
      final service = FakeUpdates();
      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: navigator,
          theme: markaiTheme(Brightness.light),
          builder: (context, child) => ValueListenableBuilder<bool>(
            valueListenable: ready,
            builder: (_, value, _) => UpdateHost(
              navigator: navigator,
              local: MemoryStore(),
              enabled: true,
              ready: value,
              service: service,
              child: child!,
            ),
          ),
          home: const Scaffold(body: Text('工作空间')),
        ),
      );
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 1));
      expect(service.checks, 1);
      expect(find.text('发现新版本 1.0.2'), findsNothing);
      navigator.currentState!.push(
        MaterialPageRoute<void>(
          builder: (_) => const Scaffold(body: Text('其他页面')),
        ),
      );
      ready.value = true;
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('发现新版本 1.0.2'), findsNothing);
      navigator.currentState!.pop();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
      expect(find.text('发现新版本 1.0.2'), findsOneWidget);
      await tester.tap(find.text('稍后再说'));
      await tester.pumpAndSettle();
      expect(service.downloads, 0);
      expect(find.text('工作空间'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      ready.dispose();
    },
  );

  testWidgets('every cold startup checks even after a recent dismissal', (
    tester,
  ) async {
    final service = FakeUpdates(), local = MemoryStore();
    await local.write('android-update-check', {
      'at': DateTime.now().millisecondsSinceEpoch,
    });
    await host(tester, service, local);
    expect(find.text('发现新版本 1.0.2'), findsOneWidget);
    expect(find.text('MarkAI'), findsOneWidget);
    await tester.tap(find.text('稍后再说'));
    await tester.pumpAndSettle();
    await tester.pumpWidget(const SizedBox());
    await host(tester, service, local);
    expect(service.checks, 2);
    expect(find.text('发现新版本 1.0.2'), findsOneWidget);
    await tester.tap(find.text('稍后再说'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('检查更新'));
    await tester.pumpAndSettle();
    expect(service.checks, 3);
    expect(find.text('发现新版本 1.0.2'), findsOneWidget);
  });

  testWidgets(
    'offline startup stays quiet and manual check has actionable error',
    (tester) async {
      final service = FakeUpdates()..offline = true;
      await host(tester, service, MemoryStore());
      expect(find.textContaining('暂时无法'), findsNothing);
      await tester.tap(find.text('检查更新'));
      await tester.pumpAndSettle();
      expect(find.text('暂时无法检查更新，请检查网络后重试。'), findsOneWidget);
    },
  );

  testWidgets('debug build skips release network checks', (tester) async {
    final service = FakeUpdates()..debug = true;
    await host(tester, service, MemoryStore());
    await tester.tap(find.text('检查更新'));
    await tester.pumpAndSettle();
    expect(service.checks, 0);
    expect(find.textContaining('当前为调试版本'), findsOneWidget);
  });

  testWidgets('same or older version is never offered for installation', (
    tester,
  ) async {
    final service = FakeUpdates()..installedCode = 4;
    await host(tester, service, MemoryStore());
    await tester.tap(find.text('检查更新'));
    await tester.pumpAndSettle();
    expect(find.text('当前已是最新版本。'), findsOneWidget);
    expect(find.text('下载更新'), findsNothing);
    await tester.tap(find.text('我知道了'));
    await tester.pumpAndSettle();
    expect(find.text('当前已是最新版本。'), findsNothing);
  });

  testWidgets(
    'permission denial keeps download for retry, then launches installer',
    (tester) async {
      final service = FakeUpdates()..permission = false;
      await host(tester, service, MemoryStore());
      await tester.tap(find.text('下载更新'));
      await tester.pumpAndSettle();
      expect(service.permissionRequests, 1);
      expect(service.installs, 0);
      service.permission = true;
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(service.installs, 1);
      expect(service.downloads, 1);
    },
  );

  testWidgets(
    'closing during download cancels and never invokes installation',
    (tester) async {
      final service = FakeUpdates()..downloadGate = Completer<File>();
      await host(tester, service, MemoryStore());
      await tester.tap(find.text('下载更新'));
      await tester.pump();
      expect(find.text('正在下载 33%'), findsOneWidget);
      await tester.tap(find.text('取消下载'));
      await tester.pumpAndSettle();
      expect(service.downloadToken!.isCancelled, true);
      service.downloadGate!.complete(File('/tmp/test.apk'));
      await tester.pumpAndSettle();
      expect(service.installs, 0);
    },
  );
}
