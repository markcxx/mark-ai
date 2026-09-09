import 'package:flutter/material.dart';

import 'auth_screen.dart';

import '../../shared/widgets/common.dart';
import '../chat/application/workspace_controller.dart';

class ConnectionScreen extends StatefulWidget {
  final WorkspaceController controller;
  const ConnectionScreen({super.key, required this.controller});
  @override
  State<ConnectionScreen> createState() => _ConnectionScreenState();
}

class _ConnectionScreenState extends State<ConnectionScreen> {
  final address = TextEditingController(
    text: const String.fromEnvironment(
      'MARKAI_API_URL',
      defaultValue: 'http://10.0.2.2:3000',
    ),
  );
  @override
  void dispose() {
    address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Center(child: Brand(size: 48)),
                const SizedBox(height: 24),
                const Text(
                  '连接 MarkAI',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                const Text(
                  '输入你现有 MarkAI 的服务地址，继续使用相同的模型与会话。',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: address,
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                  decoration: const InputDecoration(labelText: '服务地址'),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: widget.controller.booting
                      ? null
                      : () => widget.controller.start(address.text),
                  child: Text(widget.controller.booting ? '正在连接…' : '连接'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

Future<void> showLogin(BuildContext context, WorkspaceController c) async {
  FocusScope.of(context).unfocus();
  await Navigator.of(context)
      .push<void>(MaterialPageRoute(builder: (_) => AuthScreen(controller: c)));
}
