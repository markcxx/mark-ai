import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SharedConversationContent } from "@/components/chat/SharedConversationContent";
import { getConversationShare } from "@/lib/chat/share-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = {
  title: "会话分享 · MarkAI",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharedConversationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await getConversationShare(token);
  return (
    <main className="flex h-dvh flex-col bg-[var(--chat-app-bg)] p-0 md:p-2">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--chat-panel-bg)] md:rounded-xl md:border md:border-gray-200 dark:md:border-white/10">
        <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-3 md:px-6 dark:border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="MarkAI" src="/images/markai.svg" className="size-7 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">
              {share?.snapshot.title || "会话分享"}
            </h1>
            <p className="mt-1 text-xs text-gray-400">
              {share
                ? `只读快照 · 有效至 ${share.expiresAt.toISOString().replace("T", " ").slice(0, 16)} UTC`
                : "链接不可用"}
            </p>
          </div>
          <ThemeToggle />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {share ? (
            <SharedConversationContent
              messages={share.snapshot.messages}
              token={token}
              expiresAt={share.expiresAt.getTime()}
            />
          ) : (
            <div className="px-6 py-24 text-center">
              <h2 className="text-base font-medium">分享链接已失效或不存在</h2>
              <p className="mt-3 text-sm text-gray-500">请联系分享者获取新的链接。</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
