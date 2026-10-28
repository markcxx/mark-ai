"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

export function SessionGroupHeader({
  collapsed,
  count,
  label,
  onToggle,
}: {
  collapsed: boolean;
  count: number;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      aria-expanded={!collapsed}
      aria-label={`${label}，${count} 个会话，${collapsed ? "展开" : "收起"}`}
      className="group flex h-10 items-center gap-1 rounded-lg px-3 text-left text-xs font-medium text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300 md:h-8"
      onClick={onToggle}
      type="button"
    >
      <span>{label}</span>
      <span className="ml-auto opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
        {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
      </span>
    </button>
  );
}
