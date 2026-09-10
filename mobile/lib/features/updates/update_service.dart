import 'dart:io';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/network/app_endpoint.dart';

const updateRepository = String.fromEnvironment(
  'MARKAI_GITHUB_REPOSITORY',
  defaultValue: 'markcxx/mark-ai',
);
const updateMirrorBase = String.fromEnvironment(
  'MARKAI_DOWNLOAD_BASE_URL',
  defaultValue: 'https://markai-s3.mark79.cn',
);

int compareUpdateVersions(String a, String b) {
  final pattern = RegExp(r'^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$');
  if (!pattern.hasMatch(a) || !pattern.hasMatch(b)) {
    throw const FormatException('版本号无效');
  }
  final x = a.split('.').map(int.parse).toList(),
      y = b.split('.').map(int.parse).toList();
  for (var i = 0; i < 3; i++) {
    if (x[i] != y[i]) return x[i].compareTo(y[i]);
  }
  return 0;
}

class UpdateDownload {
  final String id, label, url;
  UpdateDownload(this.id, this.label, this.url);
}

class AndroidUpdate {
  final String versionName, sha256Hash, notes, downloadUrl;
  final int versionCode, size, minSdk;
  late final List<UpdateDownload> downloads;
  AndroidUpdate.fromJson(Map<String, dynamic> json)
    : versionName = json['versionName'] as String,
      versionCode = json['versionCode'] as int,
      size = json['size'] as int,
      minSdk = json['minSdk'] as int,
      sha256Hash = json['sha256'] as String,
      notes = json['releaseNotes'] as String? ?? '修复问题并改善使用体验。',
      downloadUrl =
          json['downloadUrl'] as String? ??
          '/api/public/android-update/download?versionCode=${json['versionCode']}' {
    if (json['packageName'] != 'com.markai.markai_mobile' ||
        !RegExp(r'^\d+\.\d+\.\d+$').hasMatch(versionName) ||
        versionCode <= 0 ||
        versionCode > 2100000000 ||
        size <= 0 ||
        size > 1024 * 1024 * 1024 ||
        minSdk < 24 ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(sha256Hash) ||
        downloadUrl !=
            '/api/public/android-update/download?versionCode=$versionCode') {
      throw const FormatException('更新信息无效');
    }
    downloads = (json['downloads'] as List? ?? []).map((raw) {
      final d = Map<String, dynamic>.from(raw);
      final uri = Uri.tryParse(d['url'] as String? ?? '');
      final id = d['id'];
      if (!['mirror', 'github'].contains(id) ||
          uri == null ||
          uri.scheme != 'https' ||
          uri.host.isEmpty ||
          uri.userInfo.isNotEmpty) {
        throw const FormatException('下载渠道无效');
      }
      return UpdateDownload(
        id as String,
        id == 'mirror' ? '加速下载' : 'GitHub',
        uri.toString(),
      );
    }).toList();
    if (downloads.isEmpty) {
      downloads.add(UpdateDownload('server', '下载', '$appApiUrl$downloadUrl'));
    }
    if (downloads.map((d) => d.id).toSet().length != downloads.length) {
      throw const FormatException('下载渠道重复');
    }
  }
}

class UpdateService {
  static const channel = MethodChannel('markai/updates');
  final Dio dio;
  UpdateService({Dio? dio})
    : dio =
          dio ??
          Dio(
            BaseOptions(
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 45),
            ),
          );

  Future<Map<String, dynamic>> info() async => Map<String, dynamic>.from(
    (await channel.invokeMapMethod<String, dynamic>('info'))!,
  );

  Future<AndroidUpdate?> check() async {
    try {
      final releases = <Map<String, dynamic>>[];
      for (var page = 1; page <= 10; page++) {
        final response = await dio.get<List<dynamic>>(
          'https://api.github.com/repos/$updateRepository/releases?per_page=100&page=$page',
          options: Options(
            headers: {
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          ),
        );
        final rows = response.data!;
        releases.addAll(
          rows
              .map((r) => Map<String, dynamic>.from(r))
              .where(
                (r) =>
                    r['draft'] != true &&
                    r['prerelease'] != true &&
                    RegExp(r'^android-v\d+\.\d+\.\d+$')
                        .hasMatch(r['tag_name'] as String? ?? ''),
              ),
        );
        if (rows.length < 100) break;
        if (page == 10) throw const FormatException('版本记录过多');
      }
      if (releases.isEmpty) return null;
      releases.sort(
        (a, b) => compareUpdateVersions(
          (b['tag_name'] as String).substring(9),
          (a['tag_name'] as String).substring(9),
        ),
      );
      return parseRelease(releases.first);
    } on DioException {
      // The fallback is a snapshot written from GitHub only after the release is published.
      final response = await dio.get<Map<String, dynamic>>(
        '$updateMirrorBase/android/latest.json',
        options: Options(headers: {'Cache-Control': 'no-cache'}),
      );
      final data = response.data!;
      if (data['repository'] != updateRepository || data['published'] != true) {
        throw const FormatException('更新来源无效');
      }
      return AndroidUpdate.fromJson(data);
    }
  }

  AndroidUpdate parseRelease(Map<String, dynamic> release) {
    final body = release['body'] as String? ?? '';
    final match = RegExp(r'<!-- markai-android-update\s*([\s\S]*?)\s*-->')
        .firstMatch(body);
    if (match == null) throw const FormatException('版本清单不完整');
    final data = Map<String, dynamic>.from(jsonDecode(match.group(1)!));
    data['releaseNotes'] = body.replaceRange(match.start, match.end, '').trim();
    final update = AndroidUpdate.fromJson(data);
    if (release['tag_name'] != 'android-v${update.versionName}') {
      throw const FormatException('版本清单不匹配');
    }
    final assets = (release['assets'] as List).map(
      (a) => Map<String, dynamic>.from(a),
    );
    final apk = assets
        .where(
          (a) =>
              a['name'] == 'MarkAI-${update.versionName}.apk' &&
              a['state'] == 'uploaded',
        )
        .firstOrNull;
    if (apk == null || apk['size'] != update.size) {
      throw const FormatException('安装包尚未发布完成');
    }
    final expected =
        'https://github.com/$updateRepository/releases/download/android-v${update.versionName}/MarkAI-${update.versionName}.apk';
    if (!update.downloads.any((d) => d.id == 'github' && d.url == expected)) {
      throw const FormatException('GitHub 下载地址不匹配');
    }
    if (apk['digest'] != null &&
        apk['digest'] != 'sha256:${update.sha256Hash}') {
      throw const FormatException('安装包摘要不匹配');
    }
    return update;
  }

  Future<File> download(
    AndroidUpdate update,
    CancelToken token,
    void Function(int, int) progress, {
    String? channelId,
  }) async {
    final root = Directory('${(await getTemporaryDirectory()).path}/updates');
    await root.create(recursive: true);
    final file = File('${root.path}/${update.versionCode}.apk');
    final partial = File('${file.path}.part');
    try {
      await dio.download(
        update.downloads
            .firstWhere((d) => d.id == (channelId ?? update.downloads.first.id))
            .url,
        partial.path,
        cancelToken: token,
        deleteOnError: true,
        options: Options(receiveTimeout: const Duration(minutes: 3)),
        onReceiveProgress: (received, _) {
          if (received > update.size) token.cancel('安装包大小异常');
          progress(received, update.size);
        },
      );
      if (token.isCancelled) throw const FormatException('下载已取消');
      if (await partial.length() != update.size ||
          (await sha256.bind(partial.openRead()).first).toString() !=
              update.sha256Hash) {
        throw const FormatException('安装包校验失败，请重新下载');
      }
      if (token.isCancelled) throw const FormatException('下载已取消');
      return await partial.rename(file.path);
    } on DioException catch (error) {
      if (error.response?.statusCode == 409) {
        throw const FormatException('版本已变更，请关闭弹窗后重新检查更新。');
      }
      rethrow;
    } finally {
      if (await partial.exists()) await partial.delete();
    }
  }

  Future<void> cleanCache() async {
    final root = Directory('${(await getTemporaryDirectory()).path}/updates');
    if (await root.exists()) await root.delete(recursive: true);
  }

  Future<bool> canInstall() async =>
      await channel.invokeMethod<bool>('canInstall') ?? false;
  Future<void> requestPermission() => channel.invokeMethod('requestPermission');
  Future<void> install(File file, AndroidUpdate update) => channel.invokeMethod(
    'install',
    {'path': file.path, 'versionCode': update.versionCode},
  );
}
