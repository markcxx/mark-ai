"use client";

import { Atom } from "lucide-react";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import type { ConfiguredModel } from "@/lib/chat/types";
import { resolveThinkingEnabled } from "@/lib/model-thinking";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";

export function ThinkingToggle({
  model,
  disabled,
}: {
  model?: ConfiguredModel;
  disabled: boolean;
}) {
  const mode = useSettingsStore((s) => s.general.thinkingMode);
  const updateGeneral = useSettingsStore((s) => s.updateGeneral);
  const enabled = resolveThinkingEnabled(model?.thinking, mode);
  if (enabled === undefined) return null;
  const label = enabled ? "关闭深度思考" : "开启深度思考";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      data-markai-tooltip={label}
      disabled={disabled}
      onClick={() => updateGeneral({ thinkingMode: enabled ? "disabled" : "enabled" })}
      className={cn(
        "flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 md:h-9",
        enabled
          ? "text-primary hover:bg-primary/5"
          : "text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5",
      )}
    >
      <Atom size={18} />
      <span className="hidden text-sm lg:inline">深度思考</span>
      <span aria-hidden="true" className="hidden sm:inline-flex">
        <ToggleSwitch checked={enabled} disabled={disabled} />
      </span>
    </button>
  );
}
