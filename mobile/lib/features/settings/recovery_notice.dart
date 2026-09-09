import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../shared/models/chat.dart';
import '../chat/application/workspace_controller.dart';

/// Only appears for an existing unsaved local checkpoint; ordinary settings keep the Web layout.
class RecoveryNotice extends StatefulWidget {
  final WorkspaceController controller;
  const RecoveryNotice({super.key, required this.controller});
  @override
  State<RecoveryNotice> createState() => _RecoveryNoticeState();
}

class _RecoveryNoticeState extends State<RecoveryNotice> {
  late Future<Json> recovery = widget.controller.local.read(
    widget.controller.recoveryKey,
  );
  bool busy = false;
  Future<void> recover() async {
    setState(() => busy = true);
    try {
      await widget.controller.recover();
      if (mounted) {
        setState(
          () => recovery = widget.controller.local.read(
            widget.controller.recoveryKey,
          ),
        );
      }
    } catch (error) {
      widget.controller.report(error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Json>(
    future: recovery,
    builder: (context, snapshot) => snapshot.data?.isNotEmpty != true
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '有尚未同步的消息',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const Text(
                  '恢复前会检查服务端版本；版本冲突时可导出副本。',
                  style: TextStyle(fontSize: 12, color: Color(0xff9ca3af)),
                ),
                Row(
                  children: [
                    TextButton(
                      onPressed: busy ? null : recover,
                      child: Text(busy ? '正在恢复…' : '恢复消息'),
                    ),
                    TextButton(
                      onPressed: () async {
                        try {
                          await FilePicker.saveFile(
                            dialogTitle: '导出恢复副本',
                            fileName: 'markai-recovery.json',
                            bytes: Uint8List.fromList(
                              utf8.encode(
                                const JsonEncoder.withIndent('  ')
                                    .convert(snapshot.data),
                              ),
                            ),
                          );
                        } catch (error) {
                          widget.controller.report(error);
                        }
                      },
                      child: const Text('导出副本'),
                    ),
                  ],
                ),
              ],
            ),
          ),
  );
}
