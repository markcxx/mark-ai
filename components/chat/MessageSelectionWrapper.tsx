"use client";

import type { MouseEvent, ReactNode } from "react";
import { Check } from "lucide-react";

import type { Message } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function MessageSelectionWrapper({
  children,
  isSelected,
  message,
  onToggle,
  selectionInteractive,
  selectionMode,
}: {
  children: ReactNode;
  isSelected: boolean;
  message: Message;
  onToggle: (id: string, shiftKey?: boolean) => void;
  selectionInteractive: boolean;
  selectionMode: boolean;
}) {
  if (!selectionMode) return <>{children}</>;

  const handleClick = (event: MouseEvent) => {
    if (!selectionInteractive) return;
    onToggle(message.id, event.shiftKey);
  };

  return (
    <div
      className={cn(
        "group/selection -mx-3 flex w-[calc(100%+24px)] items-center text-left transition-colors duration-150 ease-out dark:active:bg-white/[0.055] md:-mx-8 md:w-[calc(100%+64px)]",
        selectionInteractive &&
          "hover:bg-gray-100/55 active:bg-gray-100/75 dark:hover:bg-white/[0.035]",
        isSelected &&
          selectionInteractive &&
          "bg-gray-100/70 hover:bg-gray-100/70 dark:bg-white/[0.045] dark:hover:bg-white/[0.045]",
      )}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (!selectionInteractive) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle(message.id, event.shiftKey);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <span
        className={cn(
          "flex shrink-0 justify-center overflow-hidden transition-[width,opacity] duration-200 ease-out",
          selectionInteractive ? "w-[52px] opacity-100 md:w-[56px]" : "w-0 opacity-0",
        )}
      >
        <span
          className={cn(
            "flex h-5 w-5 translate-x-0 items-center justify-center rounded-full border-[1.5px] shadow-sm transition-all duration-200 ease-out",
            isSelected
              ? "scale-100 border-primary bg-primary text-white"
              : "scale-100 border-gray-300 bg-transparent text-transparent group-hover/selection:border-gray-500 dark:border-gray-600 dark:group-hover/selection:border-gray-400",
          )}
        >
          <Check
            className={cn(
              "transition-all duration-200 ease-out",
              isSelected ? "scale-100 opacity-100" : "scale-75 opacity-0",
            )}
            size={14}
            strokeWidth={2.6}
          />
        </span>
      </span>
      <span
        className={cn(
          "pointer-events-none flex min-w-0 flex-1 justify-center py-2.5 transition-[padding] duration-200 ease-out",
          selectionInteractive ? "pr-4 md:pr-8" : "px-0",
        )}
      >
        <span
          className={cn(
            "block min-w-0 flex-1 transition-[max-width,transform] duration-200 ease-out",
            selectionInteractive ? "max-w-[800px]" : "max-w-[840px]",
            message.role === "model" && "max-h-[84px] overflow-hidden",
          )}
          style={
            message.role === "model"
              ? {
                  WebkitMaskImage: "linear-gradient(to bottom, #000 56%, transparent 100%)",
                  maskImage: "linear-gradient(to bottom, #000 56%, transparent 100%)",
                }
              : undefined
          }
        >
          {children}
        </span>
      </span>
    </div>
  );
}
