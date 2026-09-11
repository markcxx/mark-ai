import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/sharing/incoming_shares.dart';
import 'package:markai_mobile/features/sharing/incoming_share_host.dart';

import 'support/fake_workspace.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('test/incoming_shares');
  testWidgets(
    'share preview preserves draft; confirm imports once without sending',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final c = await fixtureWorkspace();
      c.setDraft('原有草稿');
      final native = <Map<String, dynamic>>[
        {'id': 'one', 'text': 'https://example.com/article', 'files': []},
      ];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
        call,
      ) async {
        if (call.method == 'list') return List.of(native);
        if (call.method == 'remove') {
          native.removeWhere((s) => s['id'] == call.arguments['id']);
        }
        return null;
      });
      final inbox = IncomingShareInbox(channel: channel);
      await inbox.refresh();
      final navigator = GlobalKey<NavigatorState>();
      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: navigator,
          builder: (context, child) => IncomingShareHost(
            inbox: inbox,
            controller: c,
            navigator: navigator,
            child: child!,
          ),
          home: const Scaffold(body: Text('对话')),
        ),
      );
      await tester.pumpAndSettle();
      expect(c.draft, '原有草稿');
      await tester.tap(find.text('查看'));
      await tester.pumpAndSettle();
      expect(find.text('https://example.com/article'), findsOneWidget);
      expect(c.draft, '原有草稿');
      await tester.tap(find.text('添加到当前输入框'));
      await tester.pumpAndSettle();
      expect(c.draft, '原有草稿\n\nhttps://example.com/article');
      expect(inbox.items, isEmpty);
      expect(
        (c.api as FakeApi).requests.where((r) => r['path'] == '/api/chat'),
        isEmpty,
      );
      await inbox.refresh();
      expect(inbox.items, isEmpty);
      await tester.pumpWidget(const SizedBox());
      inbox.dispose();
      c.dispose();
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      );
    },
  );
  testWidgets(
    'failed acknowledgement retains share and draft; discard never uploads',
    (tester) async {
      final c = await fixtureWorkspace();
      c.setDraft('保留');
      var fail = true;
      final native = <Map<String, dynamic>>[
        {'id': 'two', 'text': '新内容', 'files': []},
      ];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
        call,
      ) async {
        if (call.method == 'list') return native;
        if (fail) throw PlatformException(code: 'IO');
        native.clear();
        return null;
      });
      final inbox = IncomingShareInbox(channel: channel);
      await inbox.refresh();
      final navigator = GlobalKey<NavigatorState>();
      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: navigator,
          builder: (context, child) => IncomingShareHost(
            inbox: inbox,
            controller: c,
            navigator: navigator,
            child: child!,
          ),
          home: const Scaffold(),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('查看'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('添加到当前输入框'));
      await tester.pumpAndSettle();
      expect(c.draft, '保留');
      expect(inbox.items, hasLength(1));
      expect(find.text('添加分享内容失败，请重试'), findsOneWidget);
      fail = false;
      await tester.tap(find.text('丢弃'));
      await tester.pumpAndSettle();
      expect(c.draft, '保留');
      expect(inbox.items, isEmpty);
      expect(
        (c.api as FakeApi).requests.where(
          (r) => r['path'].toString().startsWith('/api/files'),
        ),
        isEmpty,
      );
      await tester.pumpWidget(const SizedBox());
      inbox.dispose();
      c.dispose();
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      );
    },
  );
}
