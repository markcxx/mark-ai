"use client";

import { useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { ConfiguredModel } from "@/lib/chat/types";
import { getModelKey } from "@/lib/chat/helpers";
import { ModelBrandIcon } from "./ModelBrandIcon";
import { ModelSelectorDialog, type ModelSelectionOption } from "./ModelSelectorDialog";

/** Form field using the same searchable picker, grouping and model details as the composer. */
export function ModelSelect({
  value,
  onChange,
  models,
  providerNames,
  options,
  loading = false,
  label = "选择模型",
}: {
  value: string;
  onChange: (value: string) => void;
  models: ConfiguredModel[];
  providerNames: Record<string, string>;
  options?: ModelSelectionOption[];
  loading?: boolean;
  label?: string;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const selected = models.find((model) => getModelKey(model) === value);
  const option = options?.find((item) => item.key === value);
  const name = selected?.id || option?.label || value || "选择模型";
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={`${label}：${name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-black/10 bg-[var(--chat-panel-bg)] px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.025] dark:border-white/10 dark:hover:bg-white/5 sm:w-[300px]"
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <ModelBrandIcon model={selected.id} provider={selected.provider} size={20} />
        ) : (
          <SlidersHorizontal size={20} className="shrink-0 text-gray-400" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{name}</span>
          {selected && (
            <span className="block truncate text-xs text-gray-400">
              {providerNames[selected.provider] || selected.provider}
            </span>
          )}
          {loading && <span className="block text-xs text-gray-400">正在加载模型…</span>}
        </span>
        <ChevronDown size={14} className="shrink-0 text-gray-400" />
      </button>
      <ModelSelectorDialog
        anchorRef={anchor}
        open={open}
        onClose={() => {
          setOpen(false);
          setKeyword("");
        }}
        availableModels={models}
        providerNames={providerNames}
        selectedModelKey={value}
        setSelectedModelKey={onChange}
        modelSearchKeyword={keyword}
        setModelSearchKeyword={setKeyword}
        selectionOptions={options}
      />
    </>
  );
}
