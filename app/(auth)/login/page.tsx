"use client";

import { Github, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

import { getSocialErrorCallbackURL, signIn, type SocialProvider } from "@/lib/auth-client";

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary/45 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-white/30";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "你已取消第三方登录",
  email_not_found: "第三方账号没有提供可用邮箱，请改用邮箱登录",
  invalid_code: "第三方登录凭证无效或已过期，请重新尝试",
  oauth_failed: "第三方登录失败，请重新尝试",
  oauth_provider_not_found: "第三方登录服务尚未正确配置",
  registration_closed: "当前未开放新账户注册",
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" height="19" viewBox="0 0 24 24" width="19">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.87 0-5.3-1.94-6.17-4.54H2.18v2.84A11 11 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.83 14.09A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.65-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15A10.55 10.55 0 0 0 12 1a11 11 0 0 0-9.82 6.07l3.65 2.84C6.7 7.31 9.13 5.38 12 5.38Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCallback = searchParams.get("callbackUrl") || "/";
  const callbackUrl =
    requestedCallback.startsWith("/") && !requestedCallback.startsWith("//")
      ? requestedCallback
      : "/";
  const oauthError = searchParams.get("oauthError") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!oauthError) return;
    toast.error(OAUTH_ERROR_MESSAGES[oauthError] || OAUTH_ERROR_MESSAGES.oauth_failed);
    const nextUrl =
      callbackUrl === "/" ? "/login" : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    router.replace(nextUrl, { scroll: false });
  }, [callbackUrl, oauthError, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message || "邮箱或密码不正确");
      toast.success("登录成功");
      router.push(callbackUrl);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    setLoading(true);
    try {
      const result = await signIn.social({
        provider,
        callbackURL: callbackUrl,
        errorCallbackURL: getSocialErrorCallbackURL(provider, callbackUrl),
      });
      if (result?.error) throw new Error(result.error.message || "第三方登录失败");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "第三方登录失败，请稍后重试");
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <Toaster containerStyle={{ top: 24, zIndex: 99999 }} position="top-center" />
      <div className="mb-8">
        <h1 className="text-[28px] font-bold leading-[1.4] text-gray-950 dark:text-gray-50">
          登录你的账户
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
          继续你的对话、文件和个性化工作空间
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
          disabled={loading}
          onClick={() => void handleSocialLogin("google")}
          type="button"
        >
          <GoogleIcon /> Google
        </button>
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
          disabled={loading}
          onClick={() => void handleSocialLogin("github")}
          type="button"
        >
          <Github size={18} /> GitHub
        </button>
      </div>

      <div className="mb-5 flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
        或使用邮箱
        <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          邮箱地址
          <input
            autoComplete="email"
            className={`${fieldClass} mt-2`}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
            type="email"
            value={email}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          <span className="flex items-center justify-between">
            密码
            <Link
              className="text-xs font-normal text-gray-500 hover:text-gray-950 dark:hover:text-white"
              href="/reset-password"
            >
              忘记密码？
            </Link>
          </span>
          <input
            autoComplete="current-password"
            className={`${fieldClass} mt-2`}
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="输入账户密码"
            required
            type="password"
            value={password}
          />
        </label>
        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
          disabled={loading}
          type="submit"
        >
          {loading && <LoaderCircle className="animate-spin" size={16} />}
          {loading ? "正在登录…" : "登录"}
        </button>
      </form>

      <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
        还没有账户？{" "}
        <Link
          className="font-medium text-gray-950 hover:underline dark:text-white"
          href="/register"
        >
          创建账户
        </Link>
      </p>
    </div>
  );
}
