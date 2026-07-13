'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Github } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { signIn, signUp } from '@/lib/auth-client';

type Step = 'email' | 'code' | 'password';

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [registrationToken, setRegistrationToken] = useState('');

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '发送失败');
        return;
      }
      toast.success('验证码已发送到你的邮箱');
      setStep('code');
      setCountdown(60);
    } catch {
      toast.error('发送失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '发送失败');
        return;
      }
      toast.success('验证码已重新发送');
      setCountdown(60);
    } catch {
      toast.error('发送失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error('请输入 6 位验证码');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '验证失败');
        return;
      }
      toast.success('验证通过');
      setRegistrationToken(data.registrationToken || '');
      setStep('password');
    } catch {
      toast.error('验证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('密码至少需要 8 位字符');
      return;
    }
    if (!registrationToken) {
      toast.error('邮箱验证已失效，请重新验证');
      setStep('code');
      return;
    }

    setLoading(true);
    try {
      const result = await signUp.email({
        email: email.trim(),
        password,
        name: name.trim() || email.split('@')[0],
      }, {
        headers: { 'x-markai-email-verification': registrationToken },
      });
      if (result.error) {
        toast.error(result.error.message || '注册失败');
        return;
      }
      toast.success('注册成功！');
      router.push('/');
    } catch {
      toast.error('注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    await signIn.social({ provider, callbackURL: '/' });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#191919]">
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />

      <h2 className="mb-6 text-center text-base font-semibold text-gray-950 dark:text-gray-50">
        创建新账户
      </h2>

      {step === 'email' && (
        <>
          <div className="mb-4 flex gap-3">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.06]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin('github')}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.06]"
            >
              <Github size={18} />
              GitHub
            </button>
          </div>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-gray-400 dark:bg-[#191919] dark:text-gray-500">或使用邮箱</span>
            </div>
          </div>

          <form onSubmit={handleSendCode} className="space-y-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm text-gray-700 dark:text-gray-300">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#191919] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-white/20 dark:focus:ring-white/[0.06]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-lg bg-gray-950 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
            >
              {loading ? '发送中...' : '发送验证码'}
            </button>
          </form>
        </>
      )}

      {step === 'code' && (
        <form onSubmit={handleVerifyCode} className="space-y-3">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            验证码已发送至 <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>
          </p>
          <div>
            <label htmlFor="code" className="mb-1 block text-sm text-gray-700 dark:text-gray-300">
              验证码
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              placeholder="6 位数字验证码"
              autoFocus
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-center text-lg font-mono tracking-[0.5em] text-gray-900 outline-none transition-colors placeholder:text-sm placeholder:tracking-normal placeholder:text-gray-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#191919] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-white/20 dark:focus:ring-white/[0.06]"
            />
          </div>
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="h-10 w-full rounded-lg bg-gray-950 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
          >
            {loading ? '验证中...' : '验证'}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(''); }}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              修改邮箱
            </button>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={countdown > 0 || loading}
              className="text-primary hover:underline disabled:cursor-not-allowed disabled:text-gray-400 dark:text-blue-400 dark:disabled:text-gray-500"
            >
              {countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送'}
            </button>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={handleRegister} className="space-y-3">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            邮箱 <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span> 已验证
          </p>
          <div>
            <label htmlFor="name" className="mb-1 block text-sm text-gray-700 dark:text-gray-300">
              昵称 <span className="text-gray-400">(可选)</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的昵称"
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#191919] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-white/20 dark:focus:ring-white/[0.06]"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-gray-700 dark:text-gray-300">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="至少 8 位字符"
              autoFocus
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#191919] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-white/20 dark:focus:ring-white/[0.06]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-lg bg-gray-950 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
          >
            {loading ? '注册中...' : '完成注册'}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        已有账户？{' '}
        <Link href="/login" className="text-primary hover:underline dark:text-blue-400">
          登录
        </Link>
      </p>
    </div>
  );
}
