import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:path_provider/path_provider.dart';
import 'package:markai_mobile/core/theme/markai_theme.dart';
import 'package:markai_mobile/features/chat/presentation/chat_screen.dart';
import 'package:markai_mobile/features/sharing/incoming_shares.dart';
import 'package:markai_mobile/features/sharing/incoming_share_host.dart';

import '../test/support/fake_workspace.dart';

// Run with tool/screenshot_driver.dart. Send ACTION_SEND once SHARE_TEST_READY
// appears: text=share-native-text, STREAM=content://com.markai.markai_mobile.qa.updates/updates/share-fixture.txt
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'Android receives content URI and text; preview and discard are local',
    (tester) async {
      final c = await fixtureWorkspace();
      c.settings['general']['reduceMotion'] = true;
      c.setDraft('保留草稿');
      final cache = await getTemporaryDirectory();
      final source = File('${cache.path}/updates/share-fixture.txt');
      await source.parent.create(recursive: true);
      await source.writeAsString('本地分享测试文件');
      final inbox = IncomingShareInbox();
      inbox.start();
      final navigator = GlobalKey<NavigatorState>();
      Widget app(Brightness brightness) => MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: markaiTheme(brightness),
        navigatorKey: navigator,
        builder: (context, child) => IncomingShareHost(
          inbox: inbox,
          controller: c,
          navigator: navigator,
          child: child!,
        ),
        home: ChatScreen(controller: c),
      );
      await tester.pumpWidget(app(Brightness.light));
      await tester.pump(const Duration(milliseconds: 600));
      for (final old in List.of(inbox.items)) {
        await inbox.remove(old);
      }
      debugPrint('SHARE_TEST_READY');
      final deadline = DateTime.now().add(const Duration(seconds: 60));
      while (inbox.items.isEmpty && DateTime.now().isBefore(deadline)) {
        await Future<void>.delayed(const Duration(milliseconds: 250));
        await tester.pump();
      }
      expect(inbox.items, hasLength(1));
      final received = inbox.items.single;
      expect(received.error, isEmpty);
      expect(received.text, 'share-native-text');
      expect(received.files, hasLength(1));
      expect(await File(received.files.single.path).readAsString(), '本地分享测试文件');
      expect(received.files.single.name, 'share-fixture.txt');
      expect(c.draft, '保留草稿');
      await tester.tap(find.text('查看'));
      await tester.pump(const Duration(milliseconds: 600));
      await binding.convertFlutterSurfaceToImage();
      await tester.pump(const Duration(milliseconds: 600));
      await binding.takeScreenshot('incoming-share-native-light');
      navigator.currentState!.pop();
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pumpWidget(app(Brightness.dark));
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pump(const Duration(milliseconds: 600));
      await tester.tap(find.text('查看'));
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pump(const Duration(milliseconds: 600));
      await binding.takeScreenshot('incoming-share-native-dark');
      expect(find.text('share-fixture.txt'), findsOneWidget);
      await tester.tap(find.text('丢弃'));
      await tester.pump(const Duration(milliseconds: 600));
      expect(inbox.items, isEmpty);
      expect(await File(received.files.single.path).exists(), isFalse);
      expect(c.draft, '保留草稿');
      final drag = await tester.startGesture(const Offset(70, 360));
      await drag.moveBy(const Offset(30, 0));
      await tester.pump();
      await drag.moveBy(const Offset(90, 0));
      await tester.pump();
      await binding.takeScreenshot('sidebar-native-drag-dark');
      await drag.cancel();
      await tester.pump(const Duration(milliseconds: 300));
      expect(
        (c.api as FakeApi).requests.where(
          (r) => r['path'].toString().startsWith('/api/files'),
        ),
        isEmpty,
      );
      await tester.pumpWidget(const SizedBox());
      inbox.dispose();
      c.dispose();
    },
  );
}
