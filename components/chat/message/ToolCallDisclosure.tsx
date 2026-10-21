"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronRight, CircleAlert, LoaderCircle, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Shared, compact presentation for every tool invocation in a message. */
export function ToolCallDisclosure({
  children,
  icon: Icon,
  label,
  status,
}: {
  children: ReactNode;
  icon: LucideIcon;
  label: string;
  status: "running" | "done" | "error";
}) {
  const failed = status === "error";
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <div
      className="chat-tool-call group/tool-call min-w-0 text-neutral-500 dark:text-neutral-400"
      data-tool-call-status={status}
    >
      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        className="group/tool-summary flex min-h-[26px] w-fit max-w-full cursor-pointer items-center gap-1.5 rounded-md py-0 font-sans text-left text-[length:calc(var(--chat-font-size)_-_1px)] font-normal leading-[22px] tracking-normal text-neutral-500 transition-colors hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-neutral-400 dark:hover:text-neutral-200 [@media(pointer:coarse)]:min-h-10"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center",
            failed ? "text-red-600 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400",
          )}
        >
          {status === "running" ? (
            <LoaderCircle className="animate-spin" size={14} strokeWidth={1.5} />
          ) : failed ? (
            <CircleAlert size={14} strokeWidth={1.5} />
          ) : (
            <Icon size={14} strokeWidth={1.5} />
          )}
        </span>
        <span
          className={cn(
            "min-w-0 truncate",
            failed ? "text-red-600 dark:text-red-300" : "text-inherit",
          )}
        >
          {label}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="shrink-0 text-neutral-400 opacity-0 transition-[opacity,transform] duration-150 group-aria-expanded/tool-summary:rotate-90 group-hover/tool-summary:opacity-100 group-focus-visible/tool-summary:opacity-100 [@media(hover:none)]:opacity-100"
          size={12}
          strokeWidth={1.5}
        />
      </button>
      <div
        aria-hidden={!expanded}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)]",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        id={contentId}
        inert={!expanded}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
