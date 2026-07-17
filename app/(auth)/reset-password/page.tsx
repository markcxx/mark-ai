"use client";

import { useState } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forget-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo: "/login" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "发送失败");
      } else {
        toast.success("重置链接已发送");
        setSent(true);
      }
    } catch {
      toast.error("发送失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#191919]">
        <h2 className="mb-3 text-center text-base font-semibold text-gray-950 dark:text-gray-50">
          邮件已发送
        </h2>
        <p className="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">
          我们已向 <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>{" "}
          发送了重置密码链接，请查收邮件。
        </p>
        <Link
          href="/login"
          className="block text-center text-sm text-primary hover:underline dark:text-blue-400"
        >
          返回登录
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#191919]">
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />

      <h2 className="mb-2 text-center text-base font-semibold text-gray-950 dark:text-gray-50">
        重置密码
      </h2>
      <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
        输入注册时的邮箱，我们将发送重置链接
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
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
          {loading ? "发送中..." : "发送重置链接"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <Link href="/login" className="text-primary hover:underline dark:text-blue-400">
          返回登录
        </Link>
      </p>
    </div>
  );
}
