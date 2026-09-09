import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/features/chat/presentation/message_item.dart';
import 'package:markai_mobile/features/chat/presentation/code_highlighter.dart';
import 'package:markai_mobile/shared/models/chat.dart';

import '../test/support/fake_workspace.dart';
import '../test/support/ui_fixture.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('Android native layout, keyboard, menus and Prism runtime', (
    tester,
  ) async {
    Future<void> screenshot(String name) async {
      // SVG decoding uses real isolate I/O, which pumpAndSettle alone does not await.
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 350)),
      );
      await tester.pumpAndSettle();
      await binding.takeScreenshot(name);
    }

    final tokens = await CodeHighlighter.tokenize(
      'const answer = 42;',
      'javascript',
    );
    expect(tokens.map((t) => t['text']).join(), 'const answer = 42;');
    expect(
      tokens.any((t) => (t['classes'] as List).contains('keyword')),
      isTrue,
    );
    final c = await fixtureWorkspace();
    c.settings['general']['reduceMotion'] = true;
    c.user = jsonMap(uiFixture['user']);
    c.models = jsonList(uiFixture['models']).map(ModelRef.fromJson).toList();
    c.model = c.models.first;
    await tester.pumpWidget(MarkAIApp(controller: c, autoStart: false));
    await tester.pumpAndSettle();
    await binding.convertFlutterSurfaceToImage();
    await tester.pumpAndSettle();
    await screenshot('android-native-welcome');
    await tester.tap(find.byTooltip('会话操作'));
    await tester.pumpAndSettle();
    await screenshot('android-native-header-menu');
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('分享与导出'));
    await tester.pumpAndSettle();
    await screenshot('android-native-share-menu');
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('展开侧栏'));
    await tester.pumpAndSettle();
    await screenshot('android-native-sidebar');
    await tester.tap(find.text('测试用户'));
    await tester.pumpAndSettle();
    await screenshot('android-native-account-menu');
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('收起侧栏'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(TextField));
    await tester.enterText(find.byType(TextField), '检查键盘弹出后的输入框');
    await tester.pumpAndSettle();
    await screenshot('android-native-keyboard');
    await SystemChannels.textInput.invokeMethod<void>('TextInput.hide');
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    c.setDraft('');
    final api = c.api as FakeApi;
    api.sessions['qa-session'] = jsonList(uiFixture['sessions']).first;
    api.messages['qa-session'] = jsonList(uiFixture['messages']);
    await c.loadSessions();
    await c.openSession('qa-session');
    await tester.pumpAndSettle();
    await screenshot('android-native-conversation');
    await tester.tapAt(
      tester.getTopLeft(find.byType(MessageItem).last) + const Offset(20, 20),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('更多').last);
    await tester.pumpAndSettle();
    await screenshot('android-native-message-menu');
    await tester.tap(find.text('翻译'));
    await tester.pumpAndSettle();
    await screenshot('android-native-translation-menu');
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await tester.tapAt(
      tester.getTopLeft(find.byType(MessageItem).first) + const Offset(20, 20),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('编辑').first);
    await tester.pumpAndSettle();
    expect(find.text('取消'), findsOneWidget);
    await screenshot('android-native-message-editor');
    await tester.tap(find.text('取消'));
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('当前会话工具'));
    await tester.pumpAndSettle();
    await screenshot('android-native-tool-menu');
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('gpt-4o'));
    await tester.pumpAndSettle();
    await screenshot('android-native-model-selector');
    await tester.tap(find.byTooltip('关闭'));
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('切换主题'));
    await tester.pumpAndSettle();
    await screenshot('android-native-conversation-dark');
    await tester.tap(find.byTooltip('会话操作'));
    await tester.pumpAndSettle();
    await screenshot('android-native-header-menu-dark');
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await tester.tapAt(
      tester.getTopLeft(find.byType(MessageItem).last) + const Offset(20, 20),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('更多').last);
    await tester.pumpAndSettle();
    await screenshot('android-native-message-menu-dark');
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
}
