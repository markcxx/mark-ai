'use client';

import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function DropdownSurface({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'z-50 rounded-xl border border-gray-200 bg-white p-1 shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:border-white/10 dark:bg-[#191919]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
