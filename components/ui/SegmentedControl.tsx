"use client";

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SegmentedOption<Value extends string | number> = {
  disabled?: boolean;
  label: ReactNode;
  value: Value;
};

export function SegmentedControl<Value extends string | number>({
  className,
  disabled = false,
  onChange,
  options,
  padding = 2,
  style,
  value,
}: {
  className?: string;
  disabled?: boolean;
  onChange?: (value: Value) => void;
  options: SegmentedOption<Value>[];
  padding?: number;
  style?: CSSProperties;
  value: Value;
}) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => Object.is(option.value, value)),
  );

  return (
    <div
      className={cn(
        "relative inline-grid min-h-8 select-none rounded-lg bg-gray-100 text-sm text-gray-500 dark:bg-white/[0.07] dark:text-gray-400",
        className,
      )}
      role="radiogroup"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        padding,
        ...style,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-md bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] transition-transform duration-200 ease-out dark:bg-white/[0.12] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
        style={{
          bottom: padding,
          left: padding,
          top: padding,
          transform: `translateX(${selectedIndex * 100}%)`,
          width: `calc((100% - ${padding * 2}px) / ${options.length})`,
        }}
      />
      {options.map((option) => {
        const selected = Object.is(option.value, value);
        return (
          <button
            aria-checked={selected}
            className={cn(
              "relative z-[1] flex min-h-7 min-w-0 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
              selected
                ? "font-medium text-gray-900 dark:text-gray-100"
                : "hover:text-gray-700 dark:hover:text-gray-200",
              (disabled || option.disabled) && "cursor-not-allowed opacity-45",
            )}
            disabled={disabled || option.disabled}
            key={String(option.value)}
            onClick={() => onChange?.(option.value)}
            role="radio"
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

