"use client";

import Link from "next/link";

export default function RankingsError({ reset }: { reset: () => void }) {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-[var(--chat-app-bg)] px-5 text-center">
      <h1 className="text-lg font-semibold">模型排名暂时无法加载</h1>
      <p className="text-sm text-gray-500">请重试，或稍后访问 Artificial Analysis 官方榜单。</p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-lg border border-gray-300 px-5 dark:border-white/20"
      >
        重新加载
      </button>
      <Link href="/" className="p-3 text-sm underline">
        返回对话
      </Link>
    </main>
  );
}
