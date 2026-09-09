import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:markai_mobile/core/network/api_client.dart';
import 'package:markai_mobile/shared/widgets/agent_avatar.dart';

import '../test/support/fake_workspace.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'emulator reaches real credential validation and paints animated avatar',
    (tester) async {
      final api = ApiClient(MemoryStore());
      await api.configure(
        const String.fromEnvironment(
          'MARKAI_API_URL',
          defaultValue: 'http://10.0.2.2:3000',
        ),
      );
      try {
        final info = await api.request('GET', '/api/public/mobile-config');
        expect(info['protocolVersion'], 1);
        // Deliberately invalid fixture credentials; never use a person's account.
        await expectLater(
          api.request(
            'POST',
            '/api/auth/sign-in/email',
            body: {
              'email': 'native-probe@example.invalid',
              'password': 'invalid-test-only',
            },
          ),
          throwsA(
            isA<ApiFailure>()
                .having(
                  (e) => e.status,
                  'credential validation status (not origin rejection)',
                  401,
                )
                .having((e) => e.message, 'Chinese feedback', '邮箱或密码不正确'),
          ),
        );
        await AgentAvatar.preload();
        await tester.pumpWidget(
          const MaterialApp(
            home: Scaffold(
              body: Column(
                children: [
                  AgentAvatar(size: 52, arriving: true),
                  Text('表单绘制保持正常'),
                ],
              ),
            ),
          ),
        );
        for (var i = 0; i < 40; i++) {
          await tester.pump(const Duration(milliseconds: 500));
          expect(tester.takeException(), isNull);
        }
        expect(find.text('表单绘制保持正常'), findsOneWidget);
        await tester.pumpWidget(const SizedBox());
      } finally {
        api.dio.close(force: true);
      }
    },
  );
}
