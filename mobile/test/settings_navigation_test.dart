import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/main.dart';
import 'package:markai_mobile/features/chat/presentation/workspace_sidebar.dart';
import 'package:markai_mobile/features/settings/settings_screen.dart';

import 'support/fake_workspace.dart';

void main() {
  testWidgets(
    'settings filters categories, shares navigation and preserves draft',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final c = await fixtureWorkspace();
      c.settings['general']['reduceMotion'] = true;
      c.setDraft('保留这条草稿');
      await tester.pumpWidget(MarkAIApp(controller: c, autoStart: false));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('展开侧栏'));
      await tester.pumpAndSettle();
      tester
          .widget<WorkspaceSidebar>(find.byType(WorkspaceSidebar))
          .onSettings();
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(find.byType(Dialog), findsNothing);
      expect(find.byTooltip('发送消息'), findsNothing);
      final settings = find.byKey(const ValueKey('settings-scroll'));
      for (final title in ['外观', '对话', '语音', 'AI 提供商', '应用更新']) {
        await tester.tap(find.byKey(ValueKey('settings-tab-$title')));
        await tester.pumpAndSettle();
        expect(
          find.descendant(of: settings, matching: find.text(title)),
          findsOneWidget,
        );
        expect(
          find.text('主题模式'),
          title == '外观' ? findsOneWidget : findsNothing,
        );
      }
      await tester.tap(find.byKey(const ValueKey('settings-tab-外观')));
      await tester.pumpAndSettle();
      await tester.dragFrom(const Offset(80, 250), const Offset(160, 0));
      await tester.pumpAndSettle();
      expect(find.text('开启新话题'), findsOneWidget);
      await tester.dragFrom(const Offset(210, 250), const Offset(-150, 0));
      await tester.pumpAndSettle();
      expect(find.byType(WorkspaceSidebar), findsNothing);
      expect(find.byType(SettingsScreen), findsOneWidget);
      await tester.tap(find.byTooltip('展开侧栏'));
      await tester.pumpAndSettle();
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(WorkspaceSidebar), findsNothing);
      expect(find.byType(SettingsScreen), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('settings-tab-应用更新')));
      await tester.pumpAndSettle();
      expect(find.text('检查更新').hitTestable(), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsNothing);
      expect(c.draft, '保留这条草稿');
      expect(tester.testTextInput.isVisible, isFalse);
      await tester.pumpWidget(const SizedBox());
      c.dispose();
    },
  );
}
