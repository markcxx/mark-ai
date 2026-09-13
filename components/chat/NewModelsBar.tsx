"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ConfiguredModel } from "@/lib/chat/types";
import { getModelDisplayName, getModelKey } from "@/lib/chat/helpers";
import { getNewModels, getNewModelToken, hasUndismissedModels } from "@/lib/model-presentation";
import { useModelPresentationTime } from "@/hooks/useModelPresentationTime";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/IconButton";
import { ModelBrandIcon } from "./ModelBrandIcon";

const STORAGE_KEY = "markai:dismissed-model-launches";

export function NewModelsBar({
  models,
  selectedModelKey,
  onSelect,
}: {
  models: ConfiguredModel[];
  selectedModelKey: string;
  onSelect: (key: string) => void;
}) {
  const now = useModelPresentationTime(models);
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        setDismissed(Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);
      } catch {
        setDismissed([]);
      }
    };
    read();
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) read();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const modelsToShow = getNewModels(models, now);
  if (dismissed === null || !modelsToShow.length || !hasUndismissedModels(modelsToShow, dismissed))
    return null;
  return (
    <div
      className="relative z-10 -mt-3 flex min-h-[54px] w-full min-w-0 items-center gap-2 rounded-b-xl border border-t-0 border-gray-200 bg-[var(--chat-input-bg)] px-3 pb-1 pt-4 text-sm dark:border-white/10"
      aria-label="上新模型"
    >
      <span className="shrink-0 text-[13px] text-gray-500 dark:text-gray-400">上新</span>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {modelsToShow.map((model) => {
          const key = getModelKey(model);
          const name = model.presentation?.displayName || getModelDisplayName(model.id);
          return (
            <button
              type="button"
              key={key}
              aria-label={`选择 ${name}（${model.provider}）`}
              aria-pressed={key === selectedModelKey}
              data-markai-tooltip={model.presentation?.description || `${name} · ${model.provider}`}
              onClick={() => onSelect(key)}
              className={cn(
                "flex min-h-11 max-w-[220px] shrink-0 items-center gap-2 rounded-lg px-2.5 text-gray-700 transition-colors hover:bg-gray-100 md:min-h-8 dark:text-gray-200 dark:hover:bg-white/[0.06]",
                key === selectedModelKey && "bg-gray-100 dark:bg-white/[0.08]",
              )}
            >
              <ModelBrandIcon model={model.id} provider={model.provider} size={20} />
              <span className="truncate font-jakarta text-[13px] font-medium">{name}</span>
            </button>
          );
        })}
      </div>
      <IconButton
        aria-label="关闭本批上新"
        data-markai-tooltip="关闭本批上新"
        shape="rounded"
        size="sm"
        className="shrink-0"
        onClick={() => {
          const next = [...new Set([...dismissed, ...modelsToShow.map(getNewModelToken)])];
          setDismissed(next);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            /* Remains closed for this visit. */
          }
        }}
      >
        <X size={15} />
      </IconButton>
    </div>
  );
}
