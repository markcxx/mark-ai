"use client";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "@/lib/settings";
import { cn } from "@/lib/utils";

export function ThemeModeChoices({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
}) {
  return (
    <div className="grid w-[288px] max-w-full grid-cols-3 gap-2" role="group" aria-label="主题模式">
      {(
        [
          { id: "light", label: "浅色", icon: Sun },
          { id: "dark", label: "深色", icon: Moon },
          { id: "system", label: "跟随系统", icon: Laptop },
        ] as const
      ).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "rounded-lg border p-1.5 text-xs transition-colors",
            value === id
              ? "border-gray-900 dark:border-gray-100"
              : "border-gray-200 dark:border-white/10",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "mb-2 flex h-12 gap-1 overflow-hidden rounded border p-1",
              id === "dark"
                ? "border-white/10 bg-[#111214]"
                : id === "system"
                  ? "border-gray-200 bg-gradient-to-r from-gray-100 from-50% to-[#191919] to-50%"
                  : "border-gray-200 bg-gray-100",
            )}
          >
            <span className="w-1/4 rounded bg-gray-400/20" />
            <span className="flex flex-1 flex-col gap-1 rounded bg-white/15 p-1">
              <span className="h-1 w-3/4 rounded bg-gray-400/40" />
              <span className="h-1 w-1/2 rounded bg-gray-400/30" />
            </span>
          </span>
          <span className="flex items-center justify-center gap-1 pb-1">
            {value === id ? <Check size={12} /> : <Icon size={12} />}
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
