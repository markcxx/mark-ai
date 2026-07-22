"use client";

import { useId, useMemo } from "react";

import { estimateDraftContextTokens } from "@/lib/chat/context-window";
import { estimateTextTokens } from "@/lib/chat/metrics";
import type { FileAttachment, Message } from "@/lib/chat/types";
import {
  formatTokenCount,
  getModelMetadata,
  hasKnownContextWindow,
} from "@/lib/model-metadata";
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
  const tooltipId = useId();
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

  if (!hasKnownContextWindow(metadata)) return null;

  const percentage = Math.min(100, (estimatedTokens / metadata.contextWindowTokens) * 100);
  const tone = percentage >= 90 ? "danger" : percentage >= 70 ? "warning" : "normal";

  return (
    <div className="group/context relative shrink-0 tabular-nums">
      <button
        aria-describedby={tooltipId}
        aria-label={`查看上下文占用，当前约 ${percentage.toFixed(0)}%`}
        className={cn(
          "relative block size-7 rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/30",
          tone === "danger"
            ? "text-red-600 dark:text-red-400"
            : tone === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-400 dark:text-gray-500",
        )}
        type="button"
      >
        <svg aria-hidden="true" className="absolute inset-0 -rotate-90" viewBox="0 0 28 28">
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
            strokeDashoffset={100 - percentage}
            strokeLinecap="round"
            strokeWidth="2.5"
          />
        </svg>
      </button>

      <div
        className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-64 translate-y-1 rounded-lg border border-gray-200 bg-white p-3 text-left opacity-0 shadow-lg transition-[opacity,transform] duration-150 group-hover/context:translate-y-0 group-hover/context:opacity-100 group-focus-within/context:translate-y-0 group-focus-within/context:opacity-100 dark:border-white/10 dark:bg-[#242424]"
        id={tooltipId}
        role="tooltip"
      >
        <div className="mb-2 truncate text-xs font-medium text-gray-900 dark:text-gray-100">
          {metadata.displayName}
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-gray-400 dark:text-gray-500">当前估算</dt>
          <dd className="text-gray-700 dark:text-gray-300">
            {formatTokenCount(estimatedTokens)} tokens
          </dd>
          <dt className="text-gray-400 dark:text-gray-500">上下文上限</dt>
          <dd className="text-gray-700 dark:text-gray-300">
            {formatTokenCount(metadata.contextWindowTokens)} tokens
          </dd>
          <dt className="text-gray-400 dark:text-gray-500">占用比例</dt>
          <dd className="text-gray-700 dark:text-gray-300">{percentage.toFixed(1)}%</dd>
          {metadata.maxOutputTokens && (
            <>
              <dt className="text-gray-400 dark:text-gray-500">最大输出</dt>
              <dd className="text-gray-700 dark:text-gray-300">
                {formatTokenCount(metadata.maxOutputTokens)} tokens
              </dd>
            </>
          )}
        </dl>
        <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] leading-4 text-gray-400 dark:border-white/[0.06] dark:text-gray-500">
          发送前估算，服务端会按附件解析结果重新计算
        </p>
      </div>
    </div>
  );
}
