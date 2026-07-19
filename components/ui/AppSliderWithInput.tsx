"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { AppNumberInput } from "./AppNumberInput";

export function AppSliderWithInput({
  className,
  disabled = false,
  max = 100,
  min = 0,
  onChange,
  step = 1,
  style,
  value = 0,
}: {
  className?: string;
  disabled?: boolean;
  max?: number;
  min?: number;
  onChange?: (value: number) => void;
  step?: number;
  style?: CSSProperties;
  value?: number;
}) {
  const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("flex items-center gap-4", className)} style={style}>
      <input
        aria-label="数值滑杆"
        className="markai-range min-w-0 flex-1"
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => onChange?.(event.target.valueAsNumber)}
        step={step}
        style={{ "--range-progress": `${Math.max(0, Math.min(100, progress))}%` } as CSSProperties}
        type="range"
        value={value}
      />
      <AppNumberInput
        disabled={disabled}
        max={max}
        min={min}
        onChange={(next) => {
          if (next !== null) onChange?.(next);
        }}
        step={step}
        style={{ flex: 1, maxWidth: 64 }}
        value={value}
      />
    </div>
  );
}

