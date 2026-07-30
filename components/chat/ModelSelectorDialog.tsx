"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Image,
  LayoutGrid,
  MessageSquareText,
  Paintbrush,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { AppDialog } from "@/components/ui/AppDialog";
import type { ConfiguredModel } from "@/lib/chat/types";
import { getModelDisplayName, getModelKey } from "@/lib/chat/helpers";
import { formatTokenCount, getModelMetadata, hasKnownContextWindow } from "@/lib/model-metadata";
import { isImageGenerationModel } from "@/lib/chat/image-models";
import { compareModelProviders, sortModelsByFamily } from "@/lib/model-sorting";
import { cn } from "@/lib/utils";

import { ModelBrandIcon } from "./ModelBrandIcon";

type ModelGroup = {
  displayName: string;
  models: ConfiguredModel[];
  provider: string;
};

type ModelSection = {
  groups: ModelGroup[];
  key: "image" | "text";
  label: string;
};

type ModelTypeFilter = "all" | "image" | "text";

const MODEL_TYPE_FILTERS = [
  {
    activeClassName: "bg-gray-200 text-gray-800 dark:bg-white/[0.12] dark:text-gray-100",
    icon: LayoutGrid,
    inactiveClassName:
      "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]",
    key: "all",
    label: "全部",
    tagClassName: "bg-gray-200/80 text-gray-600 dark:bg-white/[0.09] dark:text-gray-300",
  },
  {
    activeClassName:
      "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-400/20 dark:text-blue-300 dark:ring-blue-400/20",
    icon: MessageSquareText,
    inactiveClassName:
      "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-400/10",
    key: "text",
    label: "文本生成",
    tagClassName: "bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300",
  },
  {
    activeClassName:
      "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-400/20 dark:text-violet-300 dark:ring-violet-400/20",
    icon: Sparkles,
    inactiveClassName:
      "text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-400/10",
    key: "image",
    label: "图片生成",
    tagClassName: "bg-violet-100 text-violet-700 dark:bg-violet-400/20 dark:text-violet-300",
  },
] satisfies Array<{
  activeClassName: string;
  icon: typeof LayoutGrid;
  inactiveClassName: string;
  key: ModelTypeFilter;
  label: string;
  tagClassName: string;
}>;

export function ModelSelectorDialog({
  availableModels,
  modelSearchKeyword,
  onClose,
  open,
  providerNames,
  selectedModelKey,
  setModelSearchKeyword,
  setSelectedModelKey,
}: {
  availableModels: ConfiguredModel[];
  modelSearchKeyword: string;
  onClose: () => void;
  open: boolean;
  providerNames: Record<string, string>;
  selectedModelKey: string;
  setModelSearchKeyword: (keyword: string) => void;
  setSelectedModelKey: (key: string) => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);
  const [modelTypeFilter, setModelTypeFilter] = useState<ModelTypeFilter>("all");

  useEffect(() => {
    if (!open) {
      setModelTypeFilter("all");
      return;
    }
    requestAnimationFrame(() => {
      if (selectedItemRef.current) {
        selectedItemRef.current.scrollIntoView({ block: "center" });
      }
      searchInputRef.current?.focus();
    });
  }, [open]);

  const keyword = modelSearchKeyword.trim().toLowerCase();

  const sections = useMemo(() => {
    const filteredModels = availableModels.filter((model) => {
      const imageModel = isImageGenerationModel(model.id);
      if (modelTypeFilter === "image" && !imageModel) return false;
      if (modelTypeFilter === "text" && imageModel) return false;
      if (
        keyword &&
        !model.id.toLowerCase().includes(keyword) &&
        !getModelDisplayName(model.id).toLowerCase().includes(keyword)
      )
        return false;
      return true;
    });

    const buildGroups = (models: ConfiguredModel[]) => {
      const providerOrder: string[] = [];
      const providerMap = new Map<string, ConfiguredModel[]>();
      for (const model of models) {
        const provider = model.provider;
        if (!providerMap.has(provider)) {
          providerOrder.push(provider);
          providerMap.set(provider, []);
        }
        providerMap.get(provider)!.push(model);
      }
      return providerOrder.sort(compareModelProviders).map((provider): ModelGroup => ({
        displayName: providerNames[provider] || provider,
        models: sortModelsByFamily(providerMap.get(provider)!),
        provider,
      }));
    };

    return [
      {
        groups: buildGroups(filteredModels.filter((model) => isImageGenerationModel(model.id))),
        key: "image",
        label: "图片生成模型",
      },
      {
        groups: buildGroups(filteredModels.filter((model) => !isImageGenerationModel(model.id))),
        key: "text",
        label: "文本生成模型",
      },
    ].filter((section) => section.groups.length > 0) as ModelSection[];
  }, [availableModels, providerNames, keyword, modelTypeFilter]);

  const selectModelTypeFilter = (filter: ModelTypeFilter) => {
    setModelTypeFilter(filter);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const totalFiltered = sections.reduce(
    (total, section) => total + section.groups.reduce((sum, group) => sum + group.models.length, 0),
    0,
  );
  const activeFilter = MODEL_TYPE_FILTERS.find((filter) => filter.key === modelTypeFilter)!;
  const ActiveFilterIcon = activeFilter.icon;

  return (
    <AppDialog
      bodyClassName="flex min-h-0 flex-1 flex-col"
      height="min(80dvh, 600px)"
      onClose={onClose}
      open={open}
      title="选择模型"
      width={448}
      zIndex={50}
    >
      <div className="shrink-0 border-b border-gray-100 dark:border-white/[0.06]">
        <div className="flex h-11 items-center px-3">
          <div className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-gray-400 focus-within:bg-gray-50 dark:focus-within:bg-white/[0.04]">
            <Search className="shrink-0" size={15} />
            {modelTypeFilter !== "all" && (
              <button
                aria-label="清除模型类型筛选"
                className={cn(
                  "inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-opacity hover:opacity-80",
                  activeFilter.tagClassName,
                )}
                data-markai-tooltip="清除模型类型筛选"
                onClick={() => selectModelTypeFilter("all")}
                type="button"
              >
                <ActiveFilterIcon size={11} />
                {activeFilter.label}
                <X size={11} />
              </button>
            )}
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
              onChange={(e) => setModelSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={modelTypeFilter === "all" ? "搜索模型..." : "在筛选结果中搜索..."}
              ref={searchInputRef}
              value={modelSearchKeyword}
            />
          </div>
        </div>
        <div className="flex min-h-10 items-center gap-1 px-3 pb-2">
          {MODEL_TYPE_FILTERS.map((filter) => {
            const active = modelTypeFilter === filter.key;
            const FilterIcon = filter.icon;
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                  active ? filter.activeClassName : filter.inactiveClassName,
                )}
                key={filter.key}
                onClick={() => selectModelTypeFilter(filter.key)}
                type="button"
              >
                <FilterIcon size={13} />
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {totalFiltered > 0 ? (
          sections.map((section) => (
            <section key={section.key}>
              <div className="flex h-10 items-center gap-2 px-4 text-xs font-semibold text-gray-600 dark:text-gray-300">
                {section.key === "image" ? (
                  <Sparkles className="text-fuchsia-500 dark:text-fuchsia-400" size={14} />
                ) : (
                  <MessageSquareText className="text-emerald-500 dark:text-emerald-400" size={14} />
                )}
                {section.label}
              </div>
              {section.groups.map((group) => (
                <div key={`${section.key}-${group.provider}`}>
                  <div className="sticky top-0 z-10 flex h-8 items-center gap-2 bg-gray-50/90 px-4 backdrop-blur-sm dark:bg-[#1f1f1f]/90">
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                      {group.displayName}
                    </span>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-white/[0.06]" />
                    <span className="text-[11px] tabular-nums text-gray-300 dark:text-gray-600">
                      {group.models.length}
                    </span>
                  </div>
                  <div className="px-1.5 pb-1">
                    {group.models.map((model) => {
                      const key = getModelKey(model);
                      const isSelected = key === selectedModelKey;
                      const metadata = getModelMetadata(model.id);
                      const imageGenerationModel = isImageGenerationModel(model.id);

                      return (
                        <button
                          className={cn(
                            "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors",
                            isSelected
                              ? "bg-gray-100 text-gray-950 dark:bg-white/[0.08] dark:text-gray-50"
                              : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]",
                          )}
                          key={key}
                          onClick={() => {
                            setSelectedModelKey(key);
                            setModelSearchKeyword("");
                            onClose();
                          }}
                          ref={isSelected ? selectedItemRef : undefined}
                          type="button"
                        >
                          <ModelBrandIcon model={model.id} provider={model.provider} size={20} />
                          <span className="min-w-0 flex-1 truncate">
                            {getModelDisplayName(model.id)}
                          </span>
                          {imageGenerationModel && (
                            <>
                              <Image
                                aria-label="支持图片生成"
                                className="shrink-0 text-fuchsia-500 dark:text-fuchsia-400"
                                data-markai-tooltip="支持图片生成"
                                size={14}
                              />
                              <Paintbrush
                                aria-label="支持图片编辑"
                                className="shrink-0 text-amber-500 dark:text-amber-400"
                                data-markai-tooltip="支持图片编辑与多轮修改"
                                size={14}
                              />
                            </>
                          )}
                          {!imageGenerationModel && metadata?.supportsVision && (
                            <Image
                              aria-label="支持图片理解"
                              className="shrink-0 text-sky-500 dark:text-sky-400"
                              data-markai-tooltip="支持图片理解"
                              size={14}
                            />
                          )}
                          {hasKnownContextWindow(metadata) && (
                            <span
                              className="shrink-0 text-[11px] tabular-nums text-gray-400 dark:text-gray-500"
                              title={[
                                `上下文 ${metadata.contextWindowTokens.toLocaleString()} tokens`,
                                metadata.maxOutputTokens
                                  ? `最大输出 ${metadata.maxOutputTokens.toLocaleString()} tokens`
                                  : "",
                                metadata.knowledgeCutoff
                                  ? `知识截止 ${metadata.knowledgeCutoff}`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join("\n")}
                            >
                              {formatTokenCount(metadata.contextWindowTokens)}
                            </span>
                          )}
                          {isSelected && <Check className="shrink-0 text-gray-400" size={16} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))
        ) : (
          <div className="px-4 py-8 text-center text-sm text-gray-400">没有匹配的模型</div>
        )}
      </div>
    </AppDialog>
  );
}
