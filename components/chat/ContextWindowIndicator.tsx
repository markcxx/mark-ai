"use client";

import React, { useMemo } from "react";
import { Popover } from "@base-ui/react/popover";

import { estimateDraftContextTokens } from "@/lib/chat/context-window";
import { estimateTextTokens } from "@/lib/chat/metrics";
import type { FileAttachment, Message } from "@/lib/chat/types";
import { formatTokenCount, getModelMetadata, hasKnownContextWindow } from "@/lib/model-metadata";
import { cn } from "@/lib/utils";
import { getToolFunctions, getToolSystemPrompt } from "@/lib/tools/registry";
import { useToolStore } from "@/stores/useToolStore";

export function ContextWindowIndicator({
  attachments,
  draft,
  messages,
  modelId,
  webSearchEnabled,
}: {
  attachments: FileAttachment[];
  draft: string;
  messages: Message[];
  modelId?: string;
  webSearchEnabled: boolean;
}) {
  const enabledToolIds = useToolStore((state) => state.enabledToolIds);
  const metadata = getModelMetadata(modelId);
  const toolContextTokens = useMemo(
    () =>
      estimateTextTokens(
        JSON.stringify({
          prompt: getToolSystemPrompt(enabledToolIds),
          tools: getToolFunctions(enabledToolIds),
        }),
      ),
    [enabledToolIds],
  );
  const estimatedTokens = useMemo(
    () =>
      estimateDraftContextTokens({
        attachments,
        draft,
        messages,
        toolContextTokens,
        webSearchEnabled,
      }),
    [attachments, draft, messages, toolContextTokens, webSearchEnabled],
  );
  // Request usage includes reasoning and transient tool passes; it is not the
  // retained conversation. Re-estimate the current payload after every edit.
  const occupiedTokens = estimatedTokens;
  const limit = hasKnownContextWindow(metadata) ? metadata.contextWindowTokens : undefined;
  const percentage = limit ? (occupiedTokens / limit) * 100 : undefined;
  const percentageLabel =
    percentage === undefined
      ? "上限未知"
      : percentage > 0 && percentage < 1
        ? "<1%"
        : `${percentage.toFixed(0)}%`;
  const tone = (percentage ?? 0) >= 90 ? "danger" : (percentage ?? 0) >= 70 ? "warning" : "normal";

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`查看上下文占用，约 ${formatTokenCount(occupiedTokens)} tokens，${percentageLabel}`}
        data-markai-tooltip={`上下文占用 ${percentageLabel}，点击查看详情`}
        className={cn(
          "relative flex size-11 shrink-0 items-center justify-center md:size-8 rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/30",
          tone === "danger"
            ? "text-red-600 dark:text-red-400"
            : tone === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-400 dark:text-gray-500",
        )}
        type="button"
      >
        <svg aria-hidden="true" className="size-7 -rotate-90" viewBox="0 0 28 28">
          <circle
            className="stroke-gray-200 dark:stroke-white/10"
            cx="14"
            cy="14"
            fill="none"
            r="11"
            strokeWidth="2.5"
          />
          <circle
            className="stroke-current transition-[stroke-dashoffset,stroke] duration-300"
            cx="14"
            cy="14"
            fill="none"
            pathLength="100"
            r="11"
            strokeDasharray="100"
            strokeDashoffset={100 - Math.min(100, percentage ?? 0)}
            strokeLinecap="round"
            strokeWidth="2.5"
          />
        </svg>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50"
        >
          <Popover.Popup className="w-64 max-w-[calc(100vw-24px)] rounded-xl border border-gray-200 bg-[var(--chat-popover-bg)] p-3 text-left tabular-nums shadow-lg outline-none dark:border-white/10">
            <div className="mb-2 truncate text-xs font-medium text-gray-900 dark:text-gray-100">
              {metadata?.displayName || modelId || "当前会话"}
            </div>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-gray-400 dark:text-gray-500">预计上下文</dt>
              <dd className="text-gray-700 dark:text-gray-300">
                {formatTokenCount(occupiedTokens)} tokens
              </dd>
              <dt className="text-gray-400 dark:text-gray-500">上下文上限</dt>
              <dd className="text-gray-700 dark:text-gray-300">
                {limit ? `${formatTokenCount(limit)} tokens` : "尚未公布"}
              </dd>
              <dt className="text-gray-400 dark:text-gray-500">占用比例</dt>
              <dd className="text-gray-700 dark:text-gray-300">
                {percentage === undefined ? "无法计算" : `${percentage.toFixed(1)}%`}
              </dd>
              {metadata?.maxOutputTokens && (
                <>
                  <dt className="text-gray-400 dark:text-gray-500">最大输出</dt>
                  <dd className="text-gray-700 dark:text-gray-300">
                    {formatTokenCount(metadata.maxOutputTokens)} tokens
                  </dd>
                </>
              )}
            </dl>
            <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] leading-4 text-gray-400 dark:border-white/[0.06] dark:text-gray-500">
              按当前会话、草稿、附件和已启用工具估算，不是累计消耗。图片、系统提示与工具结果可能存在偏差；超出预算时服务端会裁剪较早内容。
            </p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
