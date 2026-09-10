import 'package:flutter_test/flutter_test.dart';
import 'package:markai_mobile/features/chat/application/smooth_text_buffer.dart';

void main() {
  testWidgets('smooth output retains cadence, Unicode and flush ordering', (
    tester,
  ) async {
    final chunks = <String>[];
    final buffer = SmoothTextBuffer(chunks.add);
    buffer.push('你好🌍');
    await tester.pump(const Duration(milliseconds: 16));
    expect(chunks, isEmpty);
    await tester.pump(const Duration(milliseconds: 16));
    expect(chunks, ['你']);
    buffer.push('🚀world');
    buffer.flush();
    expect(chunks.join(), '你好🌍🚀world');
    final large = '😀中' * 2000;
    chunks.clear();
    buffer.push(large);
    final done = buffer.finish();
    await tester.pump(const Duration(seconds: 30));
    await done;
    expect(chunks.join(), large);
    expect(chunks.any((part) => part.runes.contains(0xfffd)), isFalse);
  });
}
