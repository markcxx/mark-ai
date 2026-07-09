'use client';

import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type IconButtonSize = 'xs' | 'sm' | 'md';
type IconButtonVariant = 'ghost' | 'danger' | 'favorite';
type IconButtonShape = 'circle' | 'rounded';

const sizeClass: Record<IconButtonSize, string> = {
  md: 'h-10 w-10',
  sm: 'h-8 w-8',
  xs: 'h-7 w-7',
};

const shapeClass: Record<IconButtonShape, string> = {
  circle: 'rounded-full',
  rounded: 'rounded-md',
};

const variantClass: Record<IconButtonVariant, string> = {
  danger:
    'text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400',
  favorite:
    'text-amber-400 hover:bg-amber-100/70 hover:text-amber-500 dark:hover:bg-amber-400/10',
  ghost:
    'text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200',
};

export function IconButton({
  active,
  children,
  className,
  shape = 'circle',
  size = 'md',
  type = 'button',
  variant = 'ghost',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  shape?: IconButtonShape;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
}) {
  return (
    <button
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors',
        sizeClass[size],
        shapeClass[shape],
        variantClass[variant],
        active && 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
