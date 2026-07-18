"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Github,
  LoaderCircle,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

import { signIn, signUp } from "@/lib/auth-client";

type Step = "email" | "code" | "account";
type RegistrationMode = "closed" | "loading" | "open" | "waitlist";

const EMAIL_DOMAINS = ["@qq.com", "@163.com", "@126.com", "@outlook.com", "@gmail.com"];
const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-400/50";

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

export default function RegisterPage() {
  const router = useRouter();
  const domainMenuRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("email");
  const [emailInput, setEmailInput] = useState("");
  const [emailDomain, setEmailDomain] = useState("@qq.com");
  const [domainMenuOpen, setDomainMenuOpen] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [registrationToken, setRegistrationToken] = useState("");
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("loading");
  const [invitationToken, setInvitationToken] = useState("");
  const [invitedName, setInvitedName] = useState("");
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistMessage, setWaitlistMessage] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const email = useMemo(() => {
    const value = emailInput.trim();
    return value.includes("@") ? value : `${value}${emailDomain}`;
  }, [emailDomain, emailInput]);

  useEffect(() => {
    let cancelled = false;
    const loadRegistration = async () => {
      try {
        const response = await fetch("/api/public/registration", { cache: "no-store" });
        const data = await response.json();
        if (!cancelled) setRegistrationMode(data.mode || "closed");

        const token = new URLSearchParams(window.location.search).get("invite") || "";
        if (!token || cancelled) return;
        const invitationResponse = await fetch(
          `/api/waitlist/invitations/${encodeURIComponent(token)}`,
          { method: "POST" },
        );
        const invitation = await invitationResponse.json();
        if (!invitationResponse.ok) throw new Error(invitation.error || "邀请链接无效");
        if (cancelled) return;
        setEmailInput(invitation.email);
        setInvitedName(invitation.fullName || "");
        setInvitationToken(token);
        setRegistrationToken(invitation.registrationToken);
        setStep("account");
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "注册配置加载失败");
      }
    };
    void loadRegistration();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (!domainMenuOpen) return;
    const close = (event: PointerEvent) => {
      if (!domainMenuRef.current?.contains(event.target as Node)) setDomainMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [domainMenuOpen]);

  const sendCode = async () => {
    const response = await fetch("/api/auth/send-code", {
      body: JSON.stringify({ email }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "验证码发送失败");
    setCountdown(60);
  };

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!emailInput.trim() || !email.includes("@")) return toast.error("请输入有效的邮箱地址");
    setLoading(true);
    try {
      await sendCode();
      setStep("code");
      toast.success("验证码已发送，请查看邮箱");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送失败");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) return toast.error("请输入 6 位验证码");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-code", {
        body: JSON.stringify({ code, email }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "验证失败");
      setRegistrationToken(data.registrationToken || "");
      setStep("account");
      toast.success("邮箱验证成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "验证失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return toast.error("请完成全部密码要求");
    }
    if (!registrationToken) {
      setStep("code");
      return toast.error("邮箱验证已失效");
    }
    setLoading(true);
    try {
      const result = await signUp.email(
        { email, name: invitedName || email.split("@")[0], password },
        {
          headers: {
            "x-markai-email-verification": registrationToken,
            ...(invitationToken ? { "x-markai-waitlist-invitation": invitationToken } : {}),
          },
        },
      );
      if (result.error) throw new Error(result.error.message || "注册失败");
      toast.success("账户创建成功");
      router.push("/onboarding/avatar");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  const handleWaitlistSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!emailInput.trim() || !email.includes("@")) return toast.error("请输入有效的邮箱地址");
    setLoading(true);
    try {
      const response = await fetch("/api/waitlist", {
        body: JSON.stringify({ email, fullName: waitlistName, message: waitlistMessage }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "申请提交失败");
      setWaitlistSubmitted(true);
      toast.success("申请已提交");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "申请提交失败");
    } finally {
      setLoading(false);
    }
  };

  const invited = !!invitationToken && step === "account";
  const heading = invited
    ? "欢迎加入 MarkAI"
    : registrationMode === "waitlist"
      ? "申请加入 MarkAI"
      : registrationMode === "closed"
        ? "注册暂未开放"
        : step === "email"
          ? "创建你的 MarkAI 账户"
          : step === "code"
            ? "输入邮箱验证码"
            : "设置账户密码";
  const description = invited
    ? `邀请邮箱已验证：${email}`
    : registrationMode === "waitlist"
      ? "提交申请后，管理员会通过邮件通知你审批结果"
      : registrationMode === "closed"
        ? "管理员目前没有开放新账户注册"
        : step === "email"
          ? "开始构建属于你的智能工作空间"
          : step === "code"
            ? `我们已向 ${email} 发送 6 位验证码`
            : "使用安全密码保护你的对话和文件";

  return (
    <div className="w-full">
      <Toaster
        containerStyle={{ top: 24, zIndex: 99999 }}
        position="top-center"
        toastOptions={{ duration: 3000 }}
      />
      <div className="flex min-h-[500px] flex-col">
        <div className="mb-8">
          <h2 className="text-[28px] font-bold leading-[1.4] text-gray-950 dark:text-gray-50">
            {heading}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
        </div>

        {registrationMode === "loading" && (
          <div className="space-y-4">
            <div className="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-white/[0.06]" />
            <div className="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-white/[0.06]" />
          </div>
        )}

        {registrationMode === "closed" && !invited && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <Clock3 className="mx-auto text-gray-400" size={28} />
            <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
              请稍后再来，或联系管理员了解开放时间。
            </p>
          </div>
        )}

        {registrationMode === "waitlist" &&
          !invited &&
          (waitlistSubmitted ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <MailCheck className="mx-auto text-emerald-600 dark:text-emerald-400" size={30} />
              <h3 className="mt-3 font-semibold text-gray-900 dark:text-gray-100">申请已收到</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                如果该邮箱可以加入等候名单，我们会向你发送后续通知。
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleWaitlistSubmit}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                邮箱地址
                <input
                  autoFocus
                  className={`${fieldClass} mt-2`}
                  onChange={(event) => setEmailInput(event.target.value)}
                  placeholder="name@example.com"
                  type="email"
                  value={emailInput}
                />
              </label>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                你的称呼
                <input
                  className={`${fieldClass} mt-2`}
                  maxLength={60}
                  onChange={(event) => setWaitlistName(event.target.value)}
                  placeholder="选填"
                  value={waitlistName}
                />
              </label>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                申请说明
                <textarea
                  className="mt-2 min-h-24 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 dark:border-white/10 dark:bg-white/[0.04]"
                  maxLength={1000}
                  onChange={(event) => setWaitlistMessage(event.target.value)}
                  placeholder="选填，简单介绍你希望如何使用 MarkAI"
                  value={waitlistMessage}
                />
              </label>
              <PrimaryButton loading={loading}>
                提交申请
                <ArrowRight size={16} />
              </PrimaryButton>
            </form>
          ))}

        {registrationMode === "open" && step === "email" && (
          <div className="relative">
            <div className="mb-5 grid grid-cols-2 gap-3">
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
                onClick={() =>
                  signIn.social({ provider: "google", callbackURL: "/onboarding/avatar" })
                }
                type="button"
              >
                <GoogleIcon />
                Google
              </button>
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
                onClick={() =>
                  signIn.social({ provider: "github", callbackURL: "/onboarding/avatar" })
                }
                type="button"
              >
                <Github size={18} />
                GitHub
              </button>
            </div>
            <div className="mb-5 flex items-center gap-3 text-xs text-gray-400">
              <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
              或使用邮箱
              <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
            </div>
            <form className="space-y-5" onSubmit={handleSendCode}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                邮箱地址
                <div className="mt-2 flex rounded-lg border border-gray-200 bg-white transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 dark:border-white/10 dark:bg-white/[0.04]">
                  <input
                    autoFocus
                    className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-gray-400"
                    onChange={(event) => setEmailInput(event.target.value)}
                    placeholder="邮箱账号或完整邮箱"
                    value={emailInput}
                  />
                  {!emailInput.includes("@") && (
                    <div className="relative" ref={domainMenuRef}>
                      <button
                        aria-expanded={domainMenuOpen}
                        className="flex h-11 min-w-[116px] items-center justify-between gap-2 border-l border-gray-200 px-3 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                        onClick={() => setDomainMenuOpen((open) => !open)}
                        type="button"
                      >
                        {emailDomain}
                        <ChevronDown
                          className={`transition-transform ${domainMenuOpen ? "rotate-180" : ""}`}
                          size={14}
                        />
                      </button>
                      {domainMenuOpen && (
                        <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-40 origin-top-right animate-[menu-in_160ms_cubic-bezier(0.22,1,0.36,1)] rounded-lg border border-gray-200 bg-white p-1 shadow-[0_10px_32px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#1c1c1c]">
                          {EMAIL_DOMAINS.map((domain) => (
                            <button
                              className={`flex h-9 w-full items-center justify-between rounded-md px-3 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.07] ${emailDomain === domain ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-200"}`}
                              key={domain}
                              onClick={() => {
                                setEmailDomain(domain);
                                setDomainMenuOpen(false);
                              }}
                              type="button"
                            >
                              {domain}
                              {emailDomain === domain && <Check size={14} />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <span className="mt-2 block text-xs font-normal text-gray-400">
                  你也可以直接输入完整邮箱地址
                </span>
              </label>
              <PrimaryButton loading={loading}>
                发送验证码
                <ArrowRight size={16} />
              </PrimaryButton>
            </form>
          </div>
        )}

        {registrationMode === "open" && step === "code" && (
          <form className="relative space-y-5" onSubmit={handleVerifyCode}>
            <input
              autoFocus
              className={`${fieldClass} h-16 text-center font-mono text-2xl tracking-[0.5em]`}
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              value={code}
            />
            <PrimaryButton loading={loading}>
              确认验证码
              <ShieldCheck size={17} />
            </PrimaryButton>
            <div className="flex items-center justify-between text-xs">
              <button
                className="flex items-center gap-1 text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-white"
                onClick={() => setStep("email")}
                type="button"
              >
                <ArrowLeft size={13} />
                修改邮箱
              </button>
              <button
                className="text-blue-600 disabled:text-gray-400 dark:text-blue-400"
                disabled={countdown > 0 || loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    await sendCode();
                    toast.success("验证码已重新发送");
                  } catch {
                    toast.error("发送失败");
                  } finally {
                    setLoading(false);
                  }
                }}
                type="button"
              >
                {countdown > 0 ? `${countdown}s 后重发` : "重新发送"}
              </button>
            </div>
          </form>
        )}

        {step === "account" && (registrationMode === "open" || invited) && (
          <form className="relative space-y-5" onSubmit={handleRegister}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              密码
              <input
                autoFocus
                className={`${fieldClass} mt-2`}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入一个安全密码"
                type="password"
                value={password}
              />
            </label>
            <div className="space-y-2 px-1 text-xs">
              <PasswordRule met={password.length >= 8}>至少 8 位字符</PasswordRule>
              <PasswordRule met={/[A-Za-z]/.test(password)}>包含英文字母</PasswordRule>
              <PasswordRule met={/\d/.test(password)}>包含数字</PasswordRule>
            </div>
            <PrimaryButton loading={loading}>
              创建账户
              <ArrowRight size={16} />
            </PrimaryButton>
          </form>
        )}

        <p className="mt-auto pt-8 text-sm text-gray-500 dark:text-gray-400">
          已有账户？{" "}
          <Link
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            href="/login"
          >
            直接登录
          </Link>
        </p>
      </div>
    </div>
  );
}

function PasswordRule({ children, met }: { children: React.ReactNode; met: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 transition-colors ${met ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full ${met ? "bg-emerald-500 text-white" : "border border-gray-300 dark:border-gray-600"}`}
      >
        {met && <Check size={10} strokeWidth={3} />}
      </span>
      {children}
    </div>
  );
}

function PrimaryButton({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-950 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
      disabled={loading}
      type="submit"
    >
      {loading && <LoaderCircle className="animate-spin" size={16} />}
      {children}
    </button>
  );
}
