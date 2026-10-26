"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, ChevronDown, Eye, ImagePlus, Info, Search, Wrench } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

import type { ConfiguredModel } from "@/lib/chat/types";
import { getModelDisplayName, getModelKey } from "@/lib/chat/helpers";
import { formatContextWindow, hasKnownContextWindow } from "@/lib/model-metadata";
import { getConfiguredModelMetadata } from "@/lib/model-catalog";
import { isImageGenerationModel } from "@/lib/chat/image-models";
import { compareModelProviders, sortModelsByFamily } from "@/lib/model-sorting";
import { isNewModel } from "@/lib/model-presentation";
import { useModelPresentationTime } from "@/hooks/useModelPresentationTime";
import { cn } from "@/lib/utils";

import { ModelDetailCard } from "./ModelDetailCard";
import { getModelVendor, ModelBrandIcon, VendorIcon, type ModelVendor } from "./ModelBrandIcon";

type ModelTypeFilter = "all" | "image" | "text";
type ModelGroup = { key: string; label: string; models: ConfiguredModel[] };
type ModelSection = { groups: ModelGroup[]; key: "image" | "text"; label: string };
type Placement = {
  detailLeft: number | null;
  height: number;
  left: number;
  top: number;
};

const LIST_WIDTH = 380;
const DETAIL_WIDTH = 320;
const GAP = 8;
const MARGIN = 12;

const TYPE_TABS: { label: string; value: ModelTypeFilter }[] = [
  { label: "全部", value: "all" },
  { label: "文本生成", value: "text" },
  { label: "图片生成", value: "image" },
];

const matchesKeyword = (model: ConfiguredModel, keyword: string) =>
  !keyword ||
  model.id.toLowerCase().includes(keyword) ||
  getModelDisplayName(model.id).toLowerCase().includes(keyword) ||
  Boolean(model.presentation?.displayName.toLowerCase().includes(keyword)) ||
  Boolean(model.presentation?.description.toLowerCase().includes(keyword)) ||
  Boolean(model.metadata?.displayName.toLowerCase().includes(keyword)) ||
  Boolean(model.metadata?.description.toLowerCase().includes(keyword));

const OTHER_VENDOR: ModelVendor = { key: "other", label: "其他", slug: "" };
const vendorOf = (model: ConfiguredModel) =>
  getModelVendor(model.id, model.provider) || OTHER_VENDOR;

export function ModelSelectorDialog({
  anchorRef,
  availableModels,
  modelSearchKeyword,
  onClose,
  open,
  providerNames,
  selectedModelKey,
  setModelSearchKeyword,
  setSelectedModelKey,
}: {
  /** Trigger the popover attaches to; without one it is centered in the viewport. */
  anchorRef?: RefObject<HTMLElement | null>;
  availableModels: ConfiguredModel[];
  modelSearchKeyword: string;
  onClose: () => void;
  open: boolean;
  providerNames: Record<string, string>;
  selectedModelKey: string;
  setModelSearchKeyword: (keyword: string) => void;
  setSelectedModelKey: (key: string) => void;
}) {
  const now = useModelPresentationTime(availableModels);
  const panelRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [typeFilter, setTypeFilter] = useState<ModelTypeFilter>("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [vendorMenuOpen, setVendorMenuOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(selectedModelKey);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [sheet, setSheet] = useState(false);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const detailModel = availableModels.find((model) => getModelKey(model) === detailKey);
  const keyword = modelSearchKeyword.trim().toLowerCase();
  const hasImageModels = availableModels.some((model) => isImageGenerationModel(model.id));

  const vendors = useMemo(() => {
    const counts = new Map<string, ModelVendor & { count: number }>();
    for (const model of availableModels) {
      const vendor = vendorOf(model);
      counts.set(vendor.key, { ...vendor, count: (counts.get(vendor.key)?.count || 0) + 1 });
    }
    return [...counts.values()].sort(
      (left, right) =>
        Number(left.key === "other") - Number(right.key === "other") ||
        right.count - left.count ||
        left.label.localeCompare(right.label),
    );
  }, [availableModels]);
  const activeVendor = vendors.find((vendor) => vendor.key === vendorFilter);

  const sections = useMemo(() => {
    const matches = availableModels.filter(
      (model) =>
        (vendorFilter === "all" || vendorOf(model).key === vendorFilter) &&
        matchesKeyword(model, keyword),
    );
    // Within each model type, group by the configured API provider.
    const buildGroups = (models: ConfiguredModel[]) => {
      const byProvider = new Map<string, ConfiguredModel[]>();
      for (const model of models) {
        byProvider.set(model.provider, [...(byProvider.get(model.provider) || []), model]);
      }
      return [...byProvider.keys()].sort(compareModelProviders).map((provider): ModelGroup => ({
        key: provider,
        label: providerNames[provider] || provider,
        models: sortModelsByFamily(byProvider.get(provider)!),
      }));
    };
    const result: ModelSection[] = [];
    if (typeFilter !== "image") {
      result.push({
        groups: buildGroups(matches.filter((model) => !isImageGenerationModel(model.id))),
        key: "text",
        label: "文本生成",
      });
    }
    if (typeFilter !== "text") {
      result.push({
        groups: buildGroups(matches.filter((model) => isImageGenerationModel(model.id))),
        key: "image",
        label: "图片生成",
      });
    }
    return result.filter((section) => section.groups.length > 0);
  }, [availableModels, keyword, providerNames, typeFilter, vendorFilter]);

  const orderedModels = useMemo(
    () => sections.flatMap((section) => section.groups.flatMap((group) => group.models)),
    [sections],
  );
  const orderedKeys = useMemo(() => orderedModels.map(getModelKey), [orderedModels]);
  const activeModel =
    orderedModels.find((model) => getModelKey(model) === activeKey) ||
    availableModels.find((model) => getModelKey(model) === selectedModelKey);

  useEffect(() => {
    if (open) {
      setActiveKey(selectedModelKey);
      return;
    }
    setTypeFilter("all");
    setVendorFilter("all");
    setVendorMenuOpen(false);
    setPlacement(null);
    setDetailKey(null);
  }, [open, selectedModelKey]);

  useEffect(() => {
    if (orderedKeys.length === 0 || orderedKeys.includes(activeKey)) return;
    setActiveKey(orderedKeys[0]);
  }, [activeKey, orderedKeys]);

  // Anchor to the trigger: open toward the larger free side, right edges aligned,
  // with the detail card on whichever side of the list has room.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const mobile = viewportWidth < 640;
      setSheet(mobile);
      if (mobile) {
        setPlacement({
          detailLeft: null,
          height: Math.round(viewportHeight * 0.78),
          left: 0,
          top: 0,
        });
        return;
      }
      const anchor = anchorRef?.current?.getBoundingClientRect();
      const maxHeight = Math.min(560, viewportHeight - MARGIN * 2);
      let left: number;
      let top: number;
      let height: number;
      if (anchor) {
        const spaceAbove = anchor.top - GAP - MARGIN;
        const spaceBelow = viewportHeight - anchor.bottom - GAP - MARGIN;
        const above = spaceAbove >= Math.min(maxHeight, 420) || spaceAbove > spaceBelow;
        height = Math.min(maxHeight, above ? spaceAbove : spaceBelow);
        top = above ? anchor.top - GAP - height : anchor.bottom + GAP;
        left = anchor.right - LIST_WIDTH;
      } else {
        height = maxHeight;
        top = (viewportHeight - height) / 2;
        left = (viewportWidth - LIST_WIDTH) / 2;
      }
      left = Math.max(MARGIN, Math.min(left, viewportWidth - LIST_WIDTH - MARGIN));
      const roomRight = viewportWidth - (left + LIST_WIDTH) - GAP - MARGIN;
      const roomLeft = left - GAP - MARGIN;
      const detailLeft =
        roomRight >= DETAIL_WIDTH
          ? left + LIST_WIDTH + GAP
          : roomLeft >= DETAIL_WIDTH
            ? left - GAP - DETAIL_WIDTH
            : null;
      setPlacement({ detailLeft, height, left, top });
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open || !placement) return;
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>('[data-model-selected="true"]')
        ?.scrollIntoView({ block: "center" });
      if (!sheet) searchInputRef.current?.focus();
    });
    // Only on open; filtering should not re-scroll to the selected row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, Boolean(placement)]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || detailRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [anchorRef, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const selectModel = (key: string) => {
    setSelectedModelKey(key);
    setModelSearchKeyword("");
    onClose();
  };

  const moveActive = (offset: number) => {
    if (orderedKeys.length === 0) return;
    const index = orderedKeys.indexOf(activeKey);
    const next = orderedKeys[Math.max(0, Math.min(orderedKeys.length - 1, index + offset))];
    setActiveKey(next);
    requestAnimationFrame(() =>
      listRef.current
        ?.querySelector<HTMLElement>(`[data-model-key="${CSS.escape(next)}"]`)
        ?.scrollIntoView({ block: "nearest" }),
    );
  };

  const surfaceClassName =
    "border border-gray-200 bg-[var(--chat-popover-bg)] shadow-[0_18px_60px_rgba(15,23,42,0.18)] dark:border-white/10 dark:shadow-[0_24px_70px_rgba(0,0,0,0.55)]";

  return createPortal(
    <>
      {sheet && (
        <div aria-hidden="true" className="fixed inset-0 z-[60] bg-black/25" onClick={onClose} />
      )}
      <div
        aria-label={detailModel ? "模型资料" : "选择模型"}
        className={cn(
          "fixed z-[61] flex flex-col overflow-hidden",
          surfaceClassName,
          sheet
            ? "inset-x-0 bottom-0 animate-[fade-up_220ms_cubic-bezier(0.22,1,0.36,1)] rounded-t-xl pb-[env(safe-area-inset-bottom)]"
            : "animate-[menu-in_150ms_cubic-bezier(0.22,1,0.36,1)] rounded-xl",
        )}
        ref={panelRef}
        role="dialog"
        style={
          sheet
            ? { height: placement?.height }
            : {
                height: placement?.height,
                left: placement?.left,
                top: placement?.top,
                visibility: placement ? "visible" : "hidden",
                width: LIST_WIDTH,
              }
        }
      >
        <div
          className="shrink-0 space-y-2 border-b border-gray-100 p-2 dark:border-white/[0.07]"
          inert={Boolean(detailModel)}
        >
          <label className="flex h-10 items-center gap-2 rounded-lg bg-gray-100/80 px-2.5 text-gray-400 focus-within:bg-gray-100 dark:bg-white/[0.06] dark:focus-within:bg-white/[0.08] md:h-9">
            <Search aria-hidden="true" className="shrink-0" size={15} />
            <input
              aria-activedescendant={activeKey ? `model-option-${activeKey}` : undefined}
              aria-controls="model-selector-list"
              aria-expanded="true"
              aria-label="搜索模型"
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500 md:text-sm"
              onChange={(event) => setModelSearchKeyword(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveActive(1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveActive(-1);
                } else if (event.key === "Enter" && orderedKeys.includes(activeKey)) {
                  event.preventDefault();
                  selectModel(activeKey);
                } else if (event.key === "Escape") {
                  if (vendorMenuOpen) setVendorMenuOpen(false);
                  else onClose();
                }
              }}
              placeholder="搜索模型..."
              ref={searchInputRef}
              role="combobox"
              value={modelSearchKeyword}
            />
          </label>
          <div className="flex items-center gap-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-0.5" role="tablist">
              {TYPE_TABS.filter((tab) => hasImageModels || tab.value !== "image").map((tab) => (
                <button
                  aria-selected={typeFilter === tab.value}
                  className={cn(
                    "h-9 shrink-0 rounded-md px-2.5 text-xs transition-colors md:h-7",
                    typeFilter === tab.value
                      ? "bg-gray-100 font-medium text-gray-900 dark:bg-white/[0.1] dark:text-gray-100"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
                  )}
                  key={tab.value}
                  onClick={() => setTypeFilter(tab.value)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {vendors.length > 1 && (
              <div className="relative shrink-0">
                <button
                  aria-expanded={vendorMenuOpen}
                  aria-haspopup="listbox"
                  className={cn(
                    "flex h-9 max-w-[150px] items-center gap-1.5 rounded-md px-2 text-xs text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.07] md:h-7",
                    vendorMenuOpen && "bg-gray-100 dark:bg-white/[0.07]",
                  )}
                  onClick={() => setVendorMenuOpen((value) => !value)}
                  type="button"
                >
                  {activeVendor?.slug && <VendorIcon size={16} slug={activeVendor.slug} />}
                  <span className="truncate">{activeVendor?.label || "全部提供商"}</span>
                  <ChevronDown
                    className={cn(
                      "shrink-0 text-gray-400 transition-transform",
                      vendorMenuOpen && "rotate-180",
                    )}
                    size={13}
                  />
                </button>
                {vendorMenuOpen && (
                  <div
                    className={cn(
                      "absolute right-0 top-[calc(100%+4px)] z-30 max-h-72 w-52 animate-[menu-in_120ms_cubic-bezier(0.22,1,0.36,1)] overflow-y-auto rounded-lg p-1",
                      surfaceClassName,
                    )}
                    role="listbox"
                    aria-label="按提供商筛选"
                  >
                    {[
                      { count: availableModels.length, key: "all", label: "全部提供商", slug: "" },
                      ...vendors,
                    ].map((vendor) => (
                      <button
                        aria-selected={vendorFilter === vendor.key}
                        className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.06] md:h-8"
                        key={vendor.key}
                        onClick={() => {
                          setVendorFilter(vendor.key);
                          setVendorMenuOpen(false);
                        }}
                        role="option"
                        type="button"
                      >
                        {vendor.slug ? (
                          <VendorIcon size={18} slug={vendor.slug} />
                        ) : (
                          <span className="h-[18px] w-[18px] shrink-0 rounded-full bg-gray-200 dark:bg-white/10" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{vendor.label}</span>
                        <span className="font-jakarta text-[11px] tabular-nums text-gray-400">
                          {vendor.count}
                        </span>
                        <Check
                          className={cn("shrink-0", vendorFilter !== vendor.key && "opacity-0")}
                          size={13}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          aria-label="可用模型"
          className="markai-scrollbar-auto-hide min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
          id="model-selector-list"
          inert={Boolean(detailModel)}
          ref={listRef}
          role="listbox"
        >
          {sections.length === 0 && (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">没有匹配的模型</p>
              <p className="mt-1 text-xs text-gray-400">换个关键词或筛选条件试试</p>
            </div>
          )}
          {sections.map((section) => (
            <div key={section.key} role="group" aria-label={section.label}>
              {sections.length > 1 && (
                <p className="px-2 pb-1 pt-2 text-xs font-medium text-gray-900 first:pt-1 dark:text-gray-100">
                  {section.label}
                </p>
              )}
              {section.groups.map((group) => (
                <div key={`${section.key}-${group.key}`}>
                  <p className="px-2 pb-0.5 pt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                    {group.label}
                  </p>
                  {group.models.map((model) => {
                    const key = getModelKey(model);
                    const selected = key === selectedModelKey;
                    const metadata = getConfiguredModelMetadata(model);
                    const imageModel = isImageGenerationModel(model.id);
                    const ratings = metadata?.ratings;
                    return (
                      <div className="flex min-w-0 items-center" key={key} role="none">
                        <button
                          aria-selected={selected}
                          className={cn(
                            "flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left transition-colors md:h-9",
                            key === activeKey && "bg-gray-100 dark:bg-white/[0.07]",
                          )}
                          data-model-key={key}
                          data-model-selected={selected}
                          id={`model-option-${key}`}
                          key={key}
                          onClick={() => selectModel(key)}
                          onMouseEnter={() => setActiveKey(key)}
                          role="option"
                          tabIndex={-1}
                          type="button"
                        >
                          <ModelBrandIcon model={model.id} provider={model.provider} size={20} />
                          <span
                            className={cn(
                              "min-w-0 truncate font-jakarta text-[13px]",
                              selected
                                ? "font-semibold text-gray-950 dark:text-white"
                                : "text-gray-800 dark:text-gray-200",
                            )}
                          >
                            {model.presentation?.displayName ||
                              metadata?.displayName ||
                              getModelDisplayName(model.id)}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 text-gray-400 dark:text-gray-500">
                            {imageModel && <ImagePlus aria-label="图片生成" size={13} />}
                            {!imageModel && metadata?.supportsVision && (
                              <Eye aria-label="视觉识别" size={13} />
                            )}
                            {metadata?.supportsToolCalling && (
                              <Wrench aria-label="工具调用" size={12} />
                            )}
                            {isNewModel(model.presentation, now) && (
                              <span className="rounded px-1 text-[10px] leading-4 text-blue-600 ring-1 ring-inset ring-blue-600/20 dark:text-blue-300 dark:ring-blue-300/25">
                                新
                              </span>
                            )}
                          </span>
                          <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">
                            {ratings?.intelligence !== undefined && ratings.speed !== undefined && (
                              <span
                                aria-label={`蓝色：智能 ${ratings.intelligence}，绿色：输出速度 ${ratings.speed}；同批评测百分位，越高越好`}
                                className="hidden items-center gap-1 sm:flex"
                                data-markai-tooltip={`蓝色：智能 ${ratings.intelligence}，绿色：输出速度 ${ratings.speed}；同批评测百分位，越高越好`}
                                role="img"
                              >
                                <span className="h-1 w-6 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                                  <span
                                    className="block h-full rounded-full bg-blue-500"
                                    style={{ width: `${ratings.intelligence}%` }}
                                  />
                                </span>
                                <span className="h-1 w-6 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                                  <span
                                    className="block h-full rounded-full bg-emerald-500"
                                    style={{ width: `${ratings.speed}%` }}
                                  />
                                </span>
                              </span>
                            )}
                            <span className="min-w-9 text-right font-jakarta text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                              {hasKnownContextWindow(metadata)
                                ? formatContextWindow(metadata.contextWindowTokens)
                                : ""}
                            </span>
                            <Check
                              aria-hidden="true"
                              className={cn(
                                "text-gray-900 dark:text-gray-100",
                                !selected && "opacity-0",
                              )}
                              size={14}
                              strokeWidth={2.2}
                            />
                          </span>
                        </button>
                        {(sheet || placement?.detailLeft == null) && (
                          <IconButton
                            aria-label={`查看 ${metadata?.displayName || model.id} 的模型资料`}
                            data-markai-tooltip="模型资料与评测"
                            onClick={() => setDetailKey(key)}
                            shape="rounded"
                          >
                            <Info aria-hidden="true" size={16} />
                          </IconButton>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
        {detailModel && (
          <div className="absolute inset-0 flex flex-col bg-[var(--chat-popover-bg)]">
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 p-2 dark:border-white/10">
              <IconButton
                aria-label="返回模型列表"
                autoFocus
                data-markai-tooltip="返回模型列表"
                onClick={() => setDetailKey(null)}
              >
                <ArrowLeft aria-hidden="true" size={18} />
              </IconButton>
              <span className="text-sm font-medium">模型资料</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ModelDetailCard model={detailModel} />
            </div>
            <div className="shrink-0 border-t border-gray-100 p-3 dark:border-white/10">
              <button
                className="h-11 w-full rounded-lg bg-primary text-sm font-medium text-white dark:text-gray-950"
                onClick={() => selectModel(getModelKey(detailModel))}
                type="button"
              >
                使用此模型
              </button>
            </div>
          </div>
        )}
      </div>

      {!sheet && placement?.detailLeft != null && activeModel && (
        <div
          className={cn(
            "markai-scrollbar-auto-hide fixed z-[61] overflow-y-auto overscroll-contain rounded-xl",
            surfaceClassName,
          )}
          ref={detailRef}
          style={{
            left: placement.detailLeft,
            maxHeight: `calc(100dvh - ${MARGIN * 2}px)`,
            top: MARGIN,
            width: DETAIL_WIDTH,
          }}
        >
          <ModelDetailCard model={activeModel} />
        </div>
      )}
    </>,
    document.body,
  );
}
