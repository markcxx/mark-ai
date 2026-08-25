"use client";

import { useSettingsStore } from "@/stores/useSettingsStore";

import { AgentAvatar } from "./AgentAvatar";

export function FirstTokenLoader() {
  const reduceMotion = useSettingsStore((state) => state.general.reduceMotion);

  return (
    <div
      aria-label="模型正在生成回复"
      className="flex h-8 w-10 items-center justify-center"
      role="status"
    >
      <AgentAvatar
        ambient={false}
        animate
        className="text-gray-400 dark:text-[#2496e8]"
        reduceMotion={reduceMotion}
        size={40}
        state="thinking"
      />
    </div>
  );
}
