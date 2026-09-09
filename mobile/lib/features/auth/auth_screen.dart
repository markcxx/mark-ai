import 'auth_icon.dart';

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../shared/widgets/agent_avatar.dart';
import '../../shared/widgets/common.dart';
import '../chat/application/workspace_controller.dart';

enum AuthPage { login, register, reset }

/// Mirrors app/(auth)/layout.tsx and the email authentication pages.
class AuthScreen extends StatefulWidget {
  final WorkspaceController controller;
  final AuthPage page;
  const AuthScreen({
    super.key,
    required this.controller,
    this.page = AuthPage.login,
  });
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final email = TextEditingController(), password = TextEditingController();
  final code = TextEditingController(),
      name = TextEditingController(),
      message = TextEditingController();
  final form = GlobalKey<FormState>();
  late AuthPage page = widget.page;
  String mode = 'loading', step = 'email', token = '', domain = '@qq.com';
  bool busy = false, visible = false, sent = false;
  int countdown = 0;
  Timer? timer;
  Timer? toastTimer;
  OverlayEntry? toast;
  WorkspaceController get c => widget.controller;
  bool get dark => Theme.of(context).brightness == Brightness.dark;
  Color get muted => dark ? const Color(0xff9ca3af) : const Color(0xff6b7280);
  Color get ink => dark ? const Color(0xfff9fafb) : const Color(0xff030712);
  String get fullEmail => email.text.trim().contains('@')
      ? email.text.trim()
      : '${email.text.trim()}$domain';

  @override
  void initState() {
    super.initState();
    if (page == AuthPage.register) loadMode();
  }

  @override
  void dispose() {
    for (final controller in [email, password, code, name, message]) {
      controller.dispose();
    }
    timer?.cancel();
    toastTimer?.cancel();
    toast?.remove();
    super.dispose();
  }

  Future<void> loadMode() async {
    try {
      final result = await c.api.request('GET', '/api/public/registration');
      if (mounted) setState(() => mode = result['mode'] as String? ?? 'closed');
    } catch (e) {
      if (mounted) {
        setState(() => mode = 'error');
        notice(e.toString());
      }
    }
  }

  void navigate(AuthPage value) {
    FocusScope.of(context).unfocus();
    setState(() {
      page = value;
      sent = false;
    });
    if (value == AuthPage.register && mode == 'loading') loadMode();
  }

  void notice(String text) {
    toastTimer?.cancel();
    toast?.remove();
    final top = MediaQuery.paddingOf(context).top + 24;
    toast = OverlayEntry(
      builder: (context) => Positioned(
        top: top,
        left: 16,
        right: 16,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 350),
            child: Material(
              color: Colors.white,
              elevation: 6,
              shadowColor: const Color(0x26000000),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                child: Semantics(
                  liveRegion: true,
                  child: Text(
                    text,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      letterSpacing: 0,
                      fontFamily: 'Noto Sans SC',
                      fontSize: 14,
                      height: 1.5,
                      color: Color(0xff363636),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    Overlay.of(context).insert(toast!);
    toastTimer = Timer(const Duration(seconds: 3), () {
      toast?.remove();
      toast = null;
    });
  }

  Future<void> submit(Future<void> Function() action) async {
    if (busy || !(form.currentState?.validate() ?? true)) return;
    setState(() => busy = true);
    try {
      await action();
    } catch (e) {
      if (mounted) notice(e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> sendCode() async {
    await c.api.request(
      'POST',
      '/api/auth/send-code',
      body: {'email': fullEmail},
    );
    if (!mounted) return;
    setState(() {
      step = 'code';
      countdown = 60;
    });
    timer?.cancel();
    timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted || countdown <= 1) {
        t.cancel();
      }
      if (mounted) setState(() => countdown = (countdown - 1).clamp(0, 60));
    });
    notice('验证码已发送，请查看邮箱');
  }

  Widget field(
    TextEditingController controller,
    String hint, {
    bool secret = false,
    bool mail = false,
    int lines = 1,
  }) => DecoratedBox(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(8),
      boxShadow: secret && !dark
          ? const [
              BoxShadow(
                color: Color(0x0d000000),
                offset: Offset(0, 1),
                blurRadius: 2,
              ),
            ]
          : const [],
    ),
    child: TextFormField(
      controller: controller,
      obscureText: secret && !visible,
      autofillHints: secret
          ? const [AutofillHints.password]
          : mail
          ? const [AutofillHints.email]
          : null,
      keyboardType: mail
          ? TextInputType.emailAddress
          : lines > 1
          ? TextInputType.multiline
          : TextInputType.text,
      textInputAction: secret ? TextInputAction.done : TextInputAction.next,
      onFieldSubmitted: secret && page == AuthPage.login
          ? (_) => login()
          : null,
      minLines: lines,
      maxLines: lines,
      style: TextStyle(letterSpacing: 0, fontSize: 14, height: 1.4, color: ink),
      validator: (value) {
        if (mail &&
            ((value ?? '').trim().isEmpty ||
                !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(
                  page == AuthPage.register ? fullEmail : value!.trim(),
                ))) {
          return '请输入有效的邮箱地址';
        }
        if (secret && (value ?? '').length < 8) return '密码至少需要 8 位字符';
        return null;
      },
      decoration: InputDecoration(
        constraints: const BoxConstraints(minHeight: 44),
        hintText: hint,
        hintStyle: const TextStyle(
          letterSpacing: 0,
          color: Color(0xff9ca3af),
          fontSize: 14,
        ),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 11,
        ),
        fillColor: dark ? const Color(0x0affffff) : Colors.white,
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: ink.withValues(alpha: .45)),
        ),
        suffixIcon: secret
            ? IconButton(
                tooltip: visible ? '隐藏密码' : '显示密码',
                style: IconButton.styleFrom(
                  fixedSize: const Size(40, 40),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: () => setState(() => visible = !visible),
                icon: AuthIcon(
                  visible ? LucideIcons.eyeOff : LucideIcons.eye,
                  size: 15,
                  color: const Color(0xff9ca3af),
                ),
              )
            : null,
        suffixIconConstraints: const BoxConstraints(
          minWidth: 40,
          minHeight: 40,
        ),
      ),
    ),
  );

  Widget label(String title, Widget child, {Widget? trailing}) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Row(
        children: [
          Text(
            title,
            style: TextStyle(
              letterSpacing: 0,
              fontSize: 14,
              height: 1.4,
              color: dark ? const Color(0xffe5e7eb) : const Color(0xff374151),
              fontWeight: FontWeight.w500,
            ),
          ),
          const Spacer(),
          ?trailing,
        ],
      ),
      const SizedBox(height: 8),
      child,
    ],
  );

  Widget link(
    String title,
    VoidCallback action, {
    double size = 14,
    Color? color,
  }) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: busy ? null : action,
    child: Semantics(
      button: true,
      child: Text(
        title,
        style: TextStyle(
          letterSpacing: 0,
          fontSize: size,
          height: 20 / 14,
          color: color ?? ink,
        ),
      ),
    ),
  );

  Widget button(String title, VoidCallback action) => SizedBox(
    height: 44,
    width: double.infinity,
    child: FilledButton(
      onPressed: busy ? null : action,
      style: FilledButton.styleFrom(
        backgroundColor: dark ? Colors.white : const Color(0xff030712),
        foregroundColor: dark ? const Color(0xff030712) : Colors.white,
        padding: EdgeInsets.zero,
        minimumSize: const Size(0, 44),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      child: Text(
        busy ? '正在处理…' : title,
        style: const TextStyle(
          letterSpacing: 0,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
    ),
  );

  void login() => submit(() async {
    await c.login(email.text, password.text);
    if (mounted) Navigator.pop(context);
  });

  Widget heading(String title, String description) => Padding(
    padding: const EdgeInsets.only(bottom: 32),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            letterSpacing: 0,
            fontSize: 28,
            height: 1.4,
            fontWeight: FontWeight.w700,
            color: ink,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          description,
          style: TextStyle(
            letterSpacing: 0,
            fontSize: 14,
            height: 24 / 14,
            color: muted,
          ),
        ),
      ],
    ),
  );

  Widget social() => Column(
    children: [
      Row(
        children: [
          for (final provider in ['Google', 'GitHub']) ...[
            if (provider == 'GitHub') const SizedBox(width: 12),
            Expanded(
              child: SizedBox(
                height: 44,
                child: OutlinedButton(
                  onPressed: busy
                      ? null
                      : () => notice('安卓端第三方登录尚未接通，请先使用邮箱登录'),
                  style: OutlinedButton.styleFrom(
                    padding: EdgeInsets.zero,
                    side: BorderSide(
                      color: Theme.of(context).colorScheme.outline,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (provider == 'Google')
                        SvgPicture.asset(
                          'assets/images/google-auth.svg',
                          width: 19,
                          height: 19,
                        )
                      else
                        SvgPicture.asset(
                          'assets/images/github-auth.svg',
                          width: 18,
                          height: 18,
                          colorFilter: ColorFilter.mode(ink, BlendMode.srcIn),
                        ),
                      const SizedBox(width: 8),
                      Text(
                        provider,
                        style: TextStyle(
                          letterSpacing: 0,
                          fontSize: 14,
                          height: 1.4,
                          fontWeight: FontWeight.w500,
                          color: ink,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
      const SizedBox(height: 20),
      Row(
        children: [
          const Expanded(child: Divider()),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              '或使用邮箱',
              style: TextStyle(
                letterSpacing: 0,
                fontSize: 12,
                height: 16 / 12,
                color: dark ? muted : const Color(0xff9ca3af),
              ),
            ),
          ),
          const Expanded(child: Divider()),
        ],
      ),
      const SizedBox(height: 20),
    ],
  );

  Widget loginForm() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      heading('登录你的账户', '继续你的对话、文件和个性化工作空间'),
      social(),
      label('邮箱地址', field(email, 'name@example.com', mail: true)),
      const SizedBox(height: 20),
      label(
        '密码',
        field(password, '输入账户密码', secret: true),
        trailing: link(
          '忘记密码？',
          () => navigate(AuthPage.reset),
          size: 12,
          color: muted,
        ),
      ),
      const SizedBox(height: 20),
      button('登录', login),
      const SizedBox(height: 32),
      Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 4,
        children: [
          Text(
            '还没有账户？',
            style: TextStyle(
              letterSpacing: 0,
              fontSize: 14,
              height: 20 / 14,
              color: muted,
            ),
          ),
          link('创建账户', () => navigate(AuthPage.register)),
        ],
      ),
    ],
  );

  Widget resetForm() => Container(
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(
      border: Border.all(color: Theme.of(context).colorScheme.outline),
      borderRadius: BorderRadius.circular(12),
      color: dark ? const Color(0xff191919) : Colors.white,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          sent ? '邮件已发送' : '重置密码',
          textAlign: TextAlign.center,
          style: TextStyle(
            letterSpacing: 0,
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: ink,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          sent
              ? '我们已向 ${email.text.trim()} 发送了重置密码链接，请查收邮件。'
              : '输入注册时的邮箱，我们将发送重置链接',
          textAlign: TextAlign.center,
          style: TextStyle(letterSpacing: 0, fontSize: 14, color: muted),
        ),
        const SizedBox(height: 24),
        if (!sent) ...[
          label('邮箱', field(email, 'you@example.com', mail: true)),
          const SizedBox(height: 12),
          button(
            '发送重置链接',
            () => submit(() async {
              await c.api.request(
                'POST',
                '/api/auth/forget-password',
                body: {'email': email.text.trim(), 'redirectTo': '/login'},
              );
              if (mounted) setState(() => sent = true);
            }),
          ),
          const SizedBox(height: 16),
        ],
        Center(child: link('返回登录', () => navigate(AuthPage.login))),
      ],
    ),
  );

  Widget registerForm() {
    final title = mode == 'closed'
        ? '注册暂未开放'
        : mode == 'waitlist'
        ? '申请加入 MarkAI'
        : step == 'code'
        ? '输入邮箱验证码'
        : step == 'account'
        ? '设置账户密码'
        : '创建你的 MarkAI 账户';
    final description = mode == 'closed'
        ? '管理员目前没有开放新账户注册'
        : mode == 'waitlist'
        ? '提交申请后，管理员会通过邮件通知你审批结果'
        : step == 'code'
        ? '我们已向 $fullEmail 发送 6 位验证码'
        : step == 'account'
        ? '使用安全密码保护你的对话和文件'
        : '开始构建属于你的智能工作空间';
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 500),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          heading(title, description),
          if (mode == 'loading') ...[
            for (var i = 0; i < 2; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Container(
                  height: 44,
                  decoration: BoxDecoration(
                    color: Theme.of(context)
                        .colorScheme
                        .surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
          ],
          if (mode == 'error') button('重试加载注册配置', loadMode),
          if (mode == 'closed')
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                border: Border.all(
                  color: Theme.of(context).colorScheme.outline,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  AuthIcon(LucideIcons.clock3, size: 28, color: muted),
                  const SizedBox(height: 12),
                  Text(
                    '请稍后再来，或联系管理员了解开放时间。',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      letterSpacing: 0,
                      fontSize: 14,
                      height: 24 / 14,
                      color: muted,
                    ),
                  ),
                ],
              ),
            ),
          if (mode == 'waitlist') ...[
            if (sent)
              const Text('申请已收到\n如果该邮箱可以加入等候名单，我们会向你发送后续通知。')
            else ...[
              label('邮箱地址', field(email, 'name@example.com', mail: true)),
              const SizedBox(height: 16),
              label('你的称呼', field(name, '选填')),
              const SizedBox(height: 16),
              label('申请说明', field(message, '选填，简单介绍你希望如何使用 MarkAI', lines: 3)),
              const SizedBox(height: 16),
              button(
                '提交申请',
                () => submit(() async {
                  await c.api.request(
                    'POST',
                    '/api/waitlist',
                    body: {
                      'email': fullEmail,
                      'fullName': name.text,
                      'message': message.text,
                    },
                  );
                  if (mounted) setState(() => sent = true);
                }),
              ),
            ],
          ],
          if (mode == 'open' && step == 'email') ...[
            social(),
            label('邮箱地址', field(email, '邮箱账号或完整邮箱', mail: true)),
            ListenableBuilder(
              listenable: email,
              builder: (context, _) => email.text.contains('@')
                  ? const SizedBox()
                  : Align(
                      alignment: Alignment.centerRight,
                      child: DropdownButton<String>(
                        value: domain,
                        onChanged: (v) => setState(() => domain = v!),
                        items: [
                          for (final value in [
                            '@qq.com',
                            '@163.com',
                            '@126.com',
                            '@outlook.com',
                            '@gmail.com',
                          ])
                            DropdownMenuItem(
                              value: value,
                              child: Text(
                                value,
                                style: const TextStyle(
                                  letterSpacing: 0,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
            ),
            const SizedBox(height: 8),
            Text(
              '你也可以直接输入完整邮箱地址',
              style: TextStyle(letterSpacing: 0, fontSize: 12, color: muted),
            ),
            const SizedBox(height: 20),
            button('发送验证码', () => submit(sendCode)),
          ],
          if (mode == 'open' && step == 'code') ...[
            TextFormField(
              controller: code,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 24, letterSpacing: 12),
              decoration: const InputDecoration(hintText: '000000'),
              validator: (v) => v?.length == 6 ? null : '请输入 6 位验证码',
            ),
            const SizedBox(height: 20),
            button(
              '确认验证码',
              () => submit(() async {
                final result = await c.api.request(
                  'POST',
                  '/api/auth/verify-code',
                  body: {'email': fullEmail, 'code': code.text},
                );
                if (mounted) {
                  setState(() {
                    token = result['registrationToken'] as String? ?? '';
                    step = 'account';
                  });
                }
              }),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                link(
                  '修改邮箱',
                  () => setState(() => step = 'email'),
                  size: 12,
                  color: muted,
                ),
                TextButton(
                  onPressed: countdown > 0 || busy
                      ? null
                      : () => submit(sendCode),
                  child: Text(countdown > 0 ? '${countdown}s 后重发' : '重新发送'),
                ),
              ],
            ),
          ],
          if (mode == 'open' && step == 'account') ...[
            label('密码', field(password, '输入一个安全密码', secret: true)),
            const SizedBox(height: 20),
            const Text(
              '至少 8 位字符\n包含英文字母\n包含数字',
              style: TextStyle(letterSpacing: 0, fontSize: 12, height: 2),
            ),
            const SizedBox(height: 20),
            button(
              '创建账户',
              () => submit(() async {
                if (!RegExp(r'[A-Za-z]').hasMatch(password.text) ||
                    !RegExp(r'\d').hasMatch(password.text)) {
                  throw Exception('请完成全部密码要求');
                }
                await c.api.raw(
                  'POST',
                  '/api/auth/sign-up/email',
                  body: {
                    'email': fullEmail,
                    'name': fullEmail.split('@').first,
                    'password': password.text,
                  },
                  extraHeaders: {'x-markai-email-verification': token},
                );
                await c.login(fullEmail, password.text);
                if (mounted) Navigator.pop(context);
              }),
            ),
          ],
          const SizedBox(height: 32),
          Wrap(
            spacing: 4,
            children: [
              Text(
                '已有账户？',
                style: TextStyle(letterSpacing: 0, fontSize: 14, color: muted),
              ),
              link('直接登录', () => navigate(AuthPage.login)),
            ],
          ),
        ],
      ),
    );
  }

  Widget guide({bool compact = true}) => Row(
    children: [
      SizedBox(
        width: compact ? 56 : 112,
        height: compact ? 56 : 112,
        child: Center(
          child: AgentAvatar(size: compact ? 52 : 104, arriving: true),
        ),
      ),
      const SizedBox(width: 12),
      Flexible(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '很高兴见到你',
              style: TextStyle(
                letterSpacing: 0,
                fontSize: compact ? 14 : 24,
                fontWeight: FontWeight.w600,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '登录后继续你的对话、文件与工具。',
              style: TextStyle(
                letterSpacing: 0,
                fontSize: 14,
                height: 24 / 14,
                color: muted,
              ),
            ),
          ],
        ),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: page == AuthPage.login,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) navigate(AuthPage.login);
    },
    child: Scaffold(
      backgroundColor: dark ? Colors.black : const Color(0xfff3f4f6),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: dark ? const Color(0xff111111) : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Theme.of(context).colorScheme.outline),
            ),
            child: Column(
              children: [
                SizedBox(
                  height: 64,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: [
                        const Brand(size: 34),
                        const SizedBox(width: 10),
                        const Text(
                          'MarkAI',
                          style: TextStyle(
                            letterSpacing: 0,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const Spacer(),
                        IconButton(
                          tooltip: '切换主题',
                          style: IconButton.styleFrom(
                            fixedSize: const Size(40, 40),
                            minimumSize: const Size(40, 40),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          onPressed: () => c.setSetting(
                            'themeMode',
                            dark ? 'light' : 'dark',
                          ),
                          icon: AuthIcon(
                            dark ? LucideIcons.sun : LucideIcons.moon,
                            size: 20,
                            color: muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: LayoutBuilder(
                    builder: (context, box) {
                      final desktop = box.maxWidth >= 768;
                      final content = LayoutBuilder(
                        builder: (context, section) => SingleChildScrollView(
                          keyboardDismissBehavior:
                              ScrollViewKeyboardDismissBehavior.onDrag,
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              minHeight: section.maxHeight,
                            ),
                            child: Padding(
                              padding: EdgeInsets.symmetric(
                                horizontal: section.maxWidth >= 640 ? 32 : 16,
                                vertical: 32,
                              ),
                              child: Center(
                                child: ConstrainedBox(
                                  constraints: const BoxConstraints(
                                    maxWidth: 440,
                                  ),
                                  child: AutofillGroup(
                                    child: Form(
                                      key: form,
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        crossAxisAlignment:
                                            CrossAxisAlignment.stretch,
                                        children: [
                                          if (!desktop) ...[
                                            guide(),
                                            const SizedBox(height: 28),
                                          ],
                                          switch (page) {
                                            AuthPage.login => loginForm(),
                                            AuthPage.reset => resetForm(),
                                            AuthPage.register => registerForm(),
                                          },
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                      return desktop
                          ? Row(
                              children: [
                                Expanded(
                                  flex: 9,
                                  child: Container(
                                    color: dark
                                        ? const Color(0x05ffffff)
                                        : const Color(0xfff9fafb),
                                    padding: const EdgeInsets.all(40),
                                    child: Center(child: guide(compact: false)),
                                  ),
                                ),
                                Expanded(flex: 11, child: content),
                              ],
                            )
                          : content;
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
