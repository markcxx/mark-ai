'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

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
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-gray-200 font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-100'
          : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700',
      )}
      onClick={onClick}
      type="button"
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}
