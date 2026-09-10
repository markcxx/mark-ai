// Debug-only fixture for reviewing the real update dialog without publishing a release.
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../../core/storage/local_store.dart';
import '../../shared/models/chat.dart';
import 'update_service.dart';

const updatePreviewEnabled =
    kDebugMode && bool.fromEnvironment('MARKAI_PREVIEW_UPDATE');

class PreviewUpdateStore implements LocalStore {
  final Map<String, Json> values = {};
  @override
  Future<Json> read(String key) async => values[key] ?? {};
  @override
  Future<void> write(String key, Json value) async {
    values[key] = value;
  }

  @override
  Future<void> remove(String key) async {
    values.remove(key);
  }
}

class PreviewUpdateService extends UpdateService {
  @override
  Future<Map<String, dynamic>> info() async => {
    'versionName': '1.0.2',
    'versionCode': 1000002,
    'sdk': 36,
    'debug': false,
  };
  @override
  Future<AndroidUpdate?> check() async => AndroidUpdate.fromJson({
    'versionName': '1.0.3',
    'versionCode': 1000003,
    'packageName': 'com.markai.markai_mobile',
    'minSdk': 24,
    'size': 85 * 1024 * 1024,
    'sha256': '0' * 64,
    'releaseNotes':
        '【本地效果预览，非真实版本】\n\n'
        '• 优化消息输出与工具调用的显示效果\n'
        '• 改善附件上传和对话交互\n'
        '• 修复已知问题\n\n'
        '点击“下载更新”可体验模拟进度，不会下载或安装 APK。',
    'downloadUrl': '/api/public/android-update/download?versionCode=1000003',
    'downloads': [
      {
        'id': 'mirror',
        'url': 'https://markai-s3.mark79.cn/android/1.0.3/MarkAI-1.0.3.apk',
      },
      {
        'id': 'github',
        'url': 'https://github.com/markcxx/mark-ai/releases/download/android-v1.0.3/MarkAI-1.0.3.apk',
      },
    ],
  });
  @override
  Future<void> cleanCache() async {}
  @override
  Future<File> download(
    AndroidUpdate update,
    CancelToken token,
    void Function(int, int) progress, {
    String? channelId,
  }) async {
    for (var step = 1; step <= 20; step++) {
      await Future<void>.delayed(const Duration(milliseconds: 150));
      if (token.isCancelled) throw token.cancelError!;
      progress(update.size * step ~/ 20, update.size);
    }
    return File('markai-update-preview.apk'); // No file is created or read.
  }

  @override
  Future<bool> canInstall() async => true;
  @override
  Future<void> requestPermission() async {}
  @override
  Future<void> install(File file, AndroidUpdate update) async {
    throw PlatformException(
      code: 'PREVIEW',
      message: '预览结束：正式更新会在此打开 Android 系统安装确认界面。本次没有下载安装包。',
    );
  }
}
