import 'dart:async';

import 'package:flutter/material.dart';

class WelcomeCaption extends StatefulWidget {
  const WelcomeCaption({super.key});
  @override
  State<WelcomeCaption> createState() => _WelcomeCaptionState();
}

class _WelcomeCaptionState extends State<WelcomeCaption> {
  static const text = '你好，我是 MarkAI。今天想聊点什么？';
  Timer? timer;
  int length = 0;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    timer?.cancel();
    if (MediaQuery.disableAnimationsOf(context)) {
      length = text.length;
      return;
    }
    timer = Timer.periodic(const Duration(milliseconds: 58), (timer) {
      if (length == text.length) {
        timer.cancel();
        return;
      }
      setState(() => length++);
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: text,
    child: ExcludeSemantics(
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(text: text.substring(0, length)),
            WidgetSpan(
              child: Padding(
                padding: const EdgeInsets.only(left: 2),
                child: Transform.translate(
                  offset: const Offset(0, 2),
                  child: const SizedBox(
                    width: 1,
                    height: 16,
                    child: ColoredBox(color: Color(0xff9ca3af)),
                  ),
                ),
              ),
            ),
          ],
        ),
        style: const TextStyle(
          fontSize: 15,
          height: 1.5,
          letterSpacing: 0,
          color: Color(0xff6b7280),
        ),
      ),
    ),
  );
}
