'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';

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
      className="mt-1 flex h-7 items-center gap-1 rounded-md px-2 text-left text-xs font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
      onClick={onToggle}
      type="button"
    >
      {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
      <span>{label}</span>
      <span className="ml-auto tabular-nums">{count}</span>
    </button>
  );
}
