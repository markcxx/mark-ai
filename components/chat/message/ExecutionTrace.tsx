"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronRight, CircleCheck, LoaderCircle, CirclePause } from "lucide-react";
import { formatDuration } from "@/lib/chat/metrics";
import { cn } from "@/lib/utils";

export function ExecutionTrace({
  children,
  complete,
  duration,
  streaming,
  toolCount,
}: {
  children: ReactNode;
  complete: boolean;
  duration?: number;
  streaming?: boolean;
  toolCount: number;
}) {
  const id = useId();
  // An explicit choice survives the automatic running -> completed transition.
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null);
  const expanded = expandedOverride ?? !complete;
  const running = streaming && !complete;
  const Icon = complete ? CircleCheck : running ? LoaderCircle : CirclePause;
  return (
    <div className="not-prose mb-4 min-w-0" data-execution-trace="true">
      <button
        aria-controls={id}
        aria-expanded={expanded}
        className="flex min-h-11 max-w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-gray-400 dark:hover:text-gray-100 md:min-h-8"
        onClick={() => setExpandedOverride(!expanded)}
        type="button"
      >
        <Icon aria-hidden="true" className={cn("shrink-0", running && "animate-spin")} size={15} />
        <span className="min-w-0 break-words">
          {complete ? "执行完成" : running ? "正在执行" : "执行未完成"}
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
            {toolCount} 次工具调用{duration ? ` · ${formatDuration(duration)}` : ""}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className={cn("shrink-0 transition-transform duration-200", expanded && "rotate-90")}
          size={14}
        />
      </button>
      <div
        aria-hidden={!expanded}
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        id={id}
        inert={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="markdown-body mt-2 min-w-0 border-l border-gray-200 pl-3 dark:border-white/10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
