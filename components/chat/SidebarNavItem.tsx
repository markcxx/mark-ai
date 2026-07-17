"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function SidebarNavItem({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex h-9 w-full min-w-0 items-center gap-2 rounded-lg px-1 text-left text-sm transition-colors",
        active
          ? "bg-[#eceef0] font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-100"
          : "text-gray-700 hover:bg-[#f0f1f2] dark:text-gray-300 dark:hover:bg-gray-800/60",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center text-gray-400">
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
