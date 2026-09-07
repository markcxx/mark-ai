"use client";

import { Globe, LogIn, Paperclip, SendHorizontal, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AgentAvatar } from "@/components/chat/AgentAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUIStore } from "@/stores/useUIStore";

export function GuestChatApp() {
  const [draft, setDraft] = useState("");
  const reduceMotion = useSettingsStore((state) => state.general.reduceMotion);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const uiStore = useUIStore.getState();
    uiStore.setBootProgress(100, "加载完成");
    uiStore.setAppReady(true);
  }, []);

  const requestSignIn = () => {
    if (draft.trim()) window.localStorage.setItem("markai:guest-draft", draft.trim());
    window.location.assign("/login?callbackUrl=%2F");
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-[var(--chat-app-bg)] p-0 text-gray-900 dark:text-gray-100 md:p-2">
      <aside className="hidden w-[260px] shrink-0 flex-col px-3 pb-3 md:flex">
        <div className="flex h-16 items-center gap-3 px-2">
          <Image alt="MarkAI" height={32} priority src="/images/markai.svg" width={32} />
          <span className="text-lg font-bold">MarkAI</span>
        </div>
        <button
          className="mt-3 flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-200/70 text-sm font-medium transition-colors hover:bg-gray-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.1]"
          onClick={requestSignIn}
          type="button"
        >
          <LogIn size={17} />
          登录后查看历史
        </button>
        <div className="mt-auto px-2 pb-2 text-xs leading-5 text-gray-400">
          登录后可同步会话、文件、模型与个性化设置。
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--chat-panel-bg)] md:rounded-xl md:border md:border-gray-200 dark:md:border-white/10">
        <header className="flex h-14 shrink-0 items-center justify-between px-3 md:h-16 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Image alt="MarkAI" height={30} priority src="/images/markai.svg" width={30} />
            <span className="font-semibold">MarkAI</span>
          </div>
          <span className="hidden text-sm font-medium text-gray-500 md:block dark:text-gray-400">
            新对话
          </span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/[0.07]"
              href="/login?callbackUrl=%2F"
              onClick={(event) => {
                event.preventDefault();
                requestSignIn();
              }}
            >
              <LogIn size={17} />
              登录
            </Link>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center overflow-y-auto px-3 pb-6 md:px-8 md:pb-8">
          <div className="flex w-full max-w-[840px] flex-col items-center">
            <div className="mb-6 flex items-center gap-3 md:mb-8 md:gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center md:h-20 md:w-20">
                <AgentAvatar
                  ambient
                  animate
                  expression="mefiant"
                  followPointer
                  interactive
                  playful
                  reduceMotion={reduceMotion}
                  size={72}
                  state="idle"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold md:text-3xl">MARKAI</h1>
                <p className="mt-2 text-[15px] text-gray-500 dark:text-gray-400">
                  先问点什么，准备发送时再登录。
                </p>
              </div>
            </div>

            <div
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("Files")) event.preventDefault();
              }}
              onDrop={(event) => {
                if (!event.dataTransfer.types.includes("Files")) return;
                event.preventDefault();
                requestSignIn();
              }}
              className="w-full max-w-[760px] rounded-xl border border-gray-200 bg-[var(--chat-input-bg)] shadow-[0_12px_32px_rgba(0,0,0,0.06)] focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-950/10 dark:border-white/10 dark:focus-within:border-white/25 dark:focus-within:ring-white/[0.07]"
            >
              <textarea
                aria-label="输入消息"
                className="max-h-[36dvh] min-h-24 w-full resize-none bg-transparent px-4 py-4 text-[16px] outline-none placeholder:text-gray-400 md:min-h-28 md:text-[15px] dark:placeholder:text-gray-500"
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    requestSignIn();
                  }
                }}
                placeholder="尽管问，带图也行..."
                ref={textareaRef}
                value={draft}
              />
              <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
                <div className="flex items-center gap-1">
                  <button
                    aria-label="添加附件"
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.07]"
                    onClick={requestSignIn}
                    type="button"
                  >
                    <Paperclip size={20} />
                  </button>
                  <button
                    className="flex h-11 items-center gap-2 rounded-lg px-2.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.07]"
                    onClick={requestSignIn}
                    type="button"
                  >
                    <Globe size={18} />
                    <span className="hidden sm:inline">联网搜索</span>
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="flex h-11 items-center gap-2 rounded-lg px-2.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.07]"
                    onClick={requestSignIn}
                    type="button"
                  >
                    <SlidersHorizontal size={18} />
                    <span className="hidden sm:inline">选择模型</span>
                  </button>
                  <button
                    aria-label="发送消息"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-950 text-white disabled:bg-gray-300 disabled:text-gray-500 dark:bg-white dark:text-gray-950 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
                    disabled={!draft.trim()}
                    onClick={requestSignIn}
                    type="button"
                  >
                    <SendHorizontal size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
