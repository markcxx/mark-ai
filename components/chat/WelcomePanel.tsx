"use client";

import { useEffect, useState, type ReactNode } from "react";

import { useSettingsStore } from "@/stores/useSettingsStore";

import { AgentAvatar } from "./AgentAvatar";

const WELCOME_TEXT = "你好，我是 MarkAI。今天想聊点什么？";

function AnimatedAgentLogo() {
  const reduceMotion = useSettingsStore((state) => state.general.reduceMotion);
  return (
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
  );
}

function TypewriterText({ text }: { text: string }) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVisibleLength((length) => {
        if (length >= text.length) {
          window.clearInterval(interval);
          return length;
        }

        return length + 1;
      });
    }, 58);

    return () => window.clearInterval(interval);
  }, [text]);

  return (
    <p aria-label={text} className="mt-2 min-h-6 text-[15px] text-gray-500 dark:text-gray-400">
      <span aria-hidden="true">{text.slice(0, visibleLength)}</span>
      <span
        aria-hidden="true"
        className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-gray-400 dark:bg-gray-500"
      />
    </p>
  );
}

export function WelcomePanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full max-w-[840px] flex-col items-center px-0 md:px-4">
      <div className="mb-6 flex items-center gap-3 md:mb-8 md:gap-4">
        <AnimatedAgentLogo />
        <div className="min-w-0">
          <h1 className="font-jakarta text-2xl font-semibold text-gray-950 dark:text-gray-50 md:text-3xl">
            MARKAI
          </h1>
          <TypewriterText text={WELCOME_TEXT} />
        </div>
      </div>
      {children}
    </div>
  );
}
