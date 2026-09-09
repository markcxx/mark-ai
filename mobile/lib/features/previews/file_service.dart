import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:mime/mime.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/network/api_client.dart';
import '../../shared/models/chat.dart';

class FileService {
  final ApiClient api;
  FileService(this.api);
  Future<Json> upload(
    PlatformFile file,
    CancelToken cancel,
    void Function(double) progress, {
    String kind = 'attachment',
  }) async {
    final type = lookupMimeType(file.name) ?? 'application/octet-stream';
    final size = await file.length();
    final task = await api.request(
      'POST',
      '/api/files/presign',
      body: {
        'name': file.name,
        'size': size,
        'contentType': type,
        'kind': kind,
      },
      cancel: cancel,
    );
    final record = jsonMap(task['file']);
    try {
      final url = Uri.parse(api.baseUrl).resolve(task['uploadUrl'] as String);
      if (!['http', 'https'].contains(url.scheme)) throw ApiFailure('上传地址无效');
      await Dio().put(
        url.toString(),
        data: File(file.path!).openRead(),
        cancelToken: cancel,
        options: Options(
          headers: {'Content-Type': type, 'Content-Length': size},
          followRedirects: false,
        ),
        onSendProgress: (sent, total) => progress(total > 0 ? sent / total : 0),
      );
      final result = await api.request(
        'POST',
        '/api/files/complete',
        body: {'id': record['id']},
        cancel: cancel,
      );
      return jsonMap(result['file']);
    } catch (_) {
      await api
          .request('DELETE', '/api/files/${record['id']}')
          .catchError((_) => <String, dynamic>{});
      rethrow;
    }
  }

  Future<Uint8List> bytes(Json file) async {
    final response = await api.raw(
      'GET',
      '/api/files/${file['id']}/download',
      type: ResponseType.bytes,
      allowDownloadRedirect: true,
    );
    final location = response.headers.value('location');
    if (location != null) {
      final uri = Uri.parse(api.baseUrl).resolve(location);
      if (!['https', 'http'].contains(uri.scheme) || uri.userInfo.isNotEmpty) {
        throw ApiFailure('下载地址无效');
      }
      final remote = await Dio().get<List<int>>(
        uri.toString(),
        options: Options(
          responseType: ResponseType.bytes,
          followRedirects: false,
        ),
      );
      return Uint8List.fromList(remote.data!);
    }
    return Uint8List.fromList((response.data as List).cast<int>());
  }

  Future<void> saveFile(Json file) async {
    final data = await bytes(file);
    await FilePicker.saveFile(
      fileName: (file['name'] as String? ?? '文件').replaceAll(
        RegExp(r'[/\\]'),
        '_',
      ),
      bytes: data,
      mimeType: file['contentType'] as String? ?? 'application/octet-stream',
    );
  }

  Future<void> shareFile(Json file) async {
    final data = await bytes(file);
    final dir = await getTemporaryDirectory();
    final name = (file['name'] as String? ?? '文件').replaceAll(
      RegExp(r'[/\\]'),
      '_',
    );
    final output = File(
      '${dir.path}/${DateTime.now().microsecondsSinceEpoch}-$name',
    );
    await output.writeAsBytes(data);
    await SharePlus.instance.share(
      ShareParams(files: [XFile(output.path)], title: name),
    );
  }
}
