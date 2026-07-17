"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export function InlineTextEdit({
  className,
  onCancel,
  onChange,
  onSave,
  value,
}: {
  className?: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      className={cn(
        "rounded-lg border border-gray-200 bg-white px-3 text-gray-900 outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-[#191919] dark:text-gray-100 dark:focus:border-white/20 dark:focus:ring-white/[0.06]",
        className,
      )}
      onBlur={onSave}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") onSave();
        if (event.key === "Escape") onCancel();
      }}
      ref={inputRef}
      value={value}
    />
  );
}
