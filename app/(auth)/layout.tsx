"use client";

import { FluentEmoji } from "@lobehub/fluent-emoji";
import Image from "next/image";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";

const AUTH_EMOJIS = ["🙂", "😊", "😄", "😁", "🤗", "🤩", "😎", "🫡", "😉"];

function AuthGuide({ compact = false }: { compact?: boolean }) {
  const [emoji, setEmoji] = useState("🙂");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setEmoji(AUTH_EMOJIS[Math.floor(Math.random() * AUTH_EMOJIS.length)]);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={compact ? "mb-7 flex items-center gap-3 md:hidden" : "max-w-sm"}>
      <div
        className={
          compact
            ? "auth-emoji-float flex h-14 w-14 shrink-0 items-center justify-center"
            : "auth-emoji-float flex h-28 w-28 items-center justify-center"
        }
      >
        <span className="auth-emoji-swap" key={emoji}>
          <FluentEmoji cdn="aliyun" emoji={emoji} size={compact ? 52 : 96} type="3d" />
        </span>
      </div>
      <div>
        <p className={compact ? "text-sm font-semibold" : "text-2xl font-semibold"}>
          很高兴见到你
        </p>
        <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
          登录后继续你的对话、文件与工具。
        </p>
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh bg-gray-100 p-2 dark:bg-black">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#111]">
        <header className="flex h-16 shrink-0 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <Image alt="MarkAI" height={34} priority src="/images/markai.svg" width={34} />
            <span className="text-lg font-semibold text-gray-950 dark:text-gray-50">MarkAI</span>
          </div>
          <ThemeToggle />
        </header>

        <main className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(280px,0.9fr)_minmax(440px,1.1fr)]">
          <aside className="hidden items-center justify-center border-r border-gray-100 bg-gray-50/70 px-10 dark:border-white/[0.07] dark:bg-white/[0.02] md:flex">
            <AuthGuide />
          </aside>
          <section className="flex items-center justify-center px-4 py-8 sm:px-8">
            <div className="w-full max-w-[440px]">
              <AuthGuide compact />
              {children}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
