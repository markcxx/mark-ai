"use client";

import type { ReactNode } from "react";
import { Check, LoaderCircle, Minus, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

export const adminInputClass =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-[var(--chat-input-bg)] dark:text-gray-100";

export function AdminButton({
  children,
  compact,
  danger,
  disabled,
  loading,
  onClick,
  primary,
  success,
  type = "button",
}: {
  children: ReactNode;
  compact?: boolean;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  primary?: boolean;
  success?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        compact && "gap-1 px-2",
        primary && "bg-primary text-white hover:brightness-95",
        danger && "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10",
        success &&
          "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10",
        !primary &&
          !danger &&
          !success &&
          "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.07]",
      )}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
    >
      {loading && <LoaderCircle className="animate-spin" size={15} />}
      {children}
    </button>
  );
}

export function AdminCheckbox({
  checked,
  disabled,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const active = checked || indeterminate;
  return (
    <button
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-all disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-primary bg-primary text-white shadow-sm"
          : "border-gray-300 bg-white text-transparent hover:border-gray-500 dark:border-gray-600 dark:bg-transparent dark:hover:border-gray-400",
      )}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      role="checkbox"
      type="button"
    >
      {indeterminate ? (
        <Minus size={12} strokeWidth={2.8} />
      ) : (
        <Check size={12} strokeWidth={2.8} />
      )}
    </button>
  );
}

const statusStyles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  admin: "bg-primary/10 text-primary",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  banned: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  invited: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  registered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  rejected: "bg-gray-100 text-gray-600 dark:bg-white/[0.07] dark:text-gray-400",
  user: "bg-gray-100 text-gray-600 dark:bg-white/[0.07] dark:text-gray-300",
};

export function StatusBadge({ label, status }: { label?: string; status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        statusStyles[status] || statusStyles.user,
      )}
    >
      {label || status}
    </span>
  );
}

export const formatDateTime = (value?: string | Date | null) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";

export const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

export function AdminLoading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-1">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="flex h-14 items-center gap-4 px-4" key={index}>
          <div className="h-8 w-8 rounded-md bg-gray-100 dark:bg-white/[0.06]" />
          <div className="h-3 flex-1 rounded bg-gray-100 dark:bg-white/[0.06]" />
          <div className="h-3 w-24 rounded bg-gray-100 dark:bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

export function AdminError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      <div className="mt-3">
        <AdminButton onClick={onRetry}>
          <RefreshCw size={14} /> 重新加载
        </AdminButton>
      </div>
    </div>
  );
}
