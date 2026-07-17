"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function MenuAction({
  danger,
  icon: Icon,
  label,
  onClick,
}: {
  danger?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors",
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon size={15} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

export function MenuSwitchAction({
  checked,
  icon: Icon,
  label,
  onClick,
}: {
  checked: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]"
      onClick={onClick}
      type="button"
    >
      <Icon size={15} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-gray-300 dark:bg-gray-700",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
