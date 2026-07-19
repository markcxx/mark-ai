"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

const clamp = (value: number, min?: number, max?: number) => {
  if (typeof min === "number") value = Math.max(min, value);
  if (typeof max === "number") value = Math.min(max, value);
  return value;
};

export function AppNumberInput({
  className,
  disabled = false,
  max,
  min,
  onChange,
  size = "middle",
  step = 1,
  style,
  value,
}: {
  className?: string;
  disabled?: boolean;
  max?: number;
  min?: number;
  onChange?: (value: number | null) => void;
  size?: "middle" | "small";
  step?: number;
  style?: CSSProperties;
  value?: number | null;
}) {
  const changeBy = (direction: 1 | -1) => {
    const current = typeof value === "number" && Number.isFinite(value) ? value : min || 0;
    onChange?.(clamp(current + step * direction, min, max));
  };

  return (
    <div
      className={cn(
        "group relative inline-flex overflow-hidden rounded-md border border-gray-300 bg-white shadow-sm transition-[border-color,box-shadow] hover:border-gray-400 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15 dark:border-white/[0.16] dark:bg-white/[0.06] dark:shadow-none dark:hover:border-white/25 dark:focus-within:border-white/30 dark:focus-within:ring-white/[0.08]",
        disabled && "pointer-events-none bg-gray-100 opacity-60 dark:bg-white/[0.035]",
        className,
      )}
      style={style}
    >
      <input
        className={cn(
          "min-w-0 flex-1 appearance-none bg-transparent px-2.5 text-sm text-gray-900 outline-none [font-variant-numeric:tabular-nums] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none dark:text-gray-100",
          size === "small" ? "h-6" : "h-[30px]",
        )}
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          onChange?.(Number.isNaN(next) ? null : clamp(next, min, max));
        }}
        step={step}
        type="number"
        value={value ?? ""}
      />
      <span className="flex w-5 shrink-0 flex-col border-l border-gray-200 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:border-white/10">
        <button
          aria-label="增加"
          className="flex flex-1 items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.08] dark:hover:text-gray-200"
          disabled={disabled || (typeof max === "number" && value === max)}
          onClick={() => changeBy(1)}
          tabIndex={-1}
          type="button"
        >
          <ChevronUp size={10} />
        </button>
        <button
          aria-label="减少"
          className="flex flex-1 items-center justify-center border-t border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:border-white/10 dark:hover:bg-white/[0.08] dark:hover:text-gray-200"
          disabled={disabled || (typeof min === "number" && value === min)}
          onClick={() => changeBy(-1)}
          tabIndex={-1}
          type="button"
        >
          <ChevronDown size={10} />
        </button>
      </span>
    </div>
  );
}

