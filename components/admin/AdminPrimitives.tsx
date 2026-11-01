"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  Minus,
  MoreHorizontal,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { FloatingMenu } from "@/components/chat/FloatingMenu";
import { AppSelect } from "@/components/ui/AppSelect";
import type { MenuItem } from "@/lib/chat/types";

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

/** Bordered white work surface used by every list panel. */
export function AdminSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border border-gray-200/70 bg-[var(--chat-panel-bg)] dark:border-white/[0.07]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Search + filters on the left, actions on the right; wraps on narrow screens. */
export function AdminToolbar({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-gray-100 px-3 py-3 md:px-4 dark:border-white/[0.06]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

export function AdminSearch({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative min-w-0 flex-1 basis-56 md:max-w-80">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        size={15}
      />
      <input
        aria-label={label}
        className={cn(adminInputClass, "h-10 pl-9 pr-8 md:h-9")}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      {value && (
        <button
          aria-label="清空搜索"
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          onClick={() => onChange("")}
          type="button"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Compact status filter: chips with counts on desktop, a select on mobile. */
export function AdminFilterTabs<Value extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: Value;
  onChange: (value: Value) => void;
  options: { value: Value; label: string; count?: number }[];
  label: string;
}) {
  return (
    <>
      <div aria-label={label} className="hidden items-center gap-0.5 lg:flex" role="tablist">
        {options.map((option) => (
          <button
            aria-selected={option.value === value}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors",
              option.value === value
                ? "bg-gray-100 font-medium text-gray-900 dark:bg-white/[0.08] dark:text-gray-100"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.04] dark:hover:text-gray-200",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="tab"
            type="button"
          >
            {option.label}
            {option.count !== undefined && (
              <span className="font-jakarta tabular-nums text-gray-400">{option.count}</span>
            )}
          </button>
        ))}
      </div>
      <div className="w-32 shrink-0 lg:hidden">
        <AppSelect<Value>
          aria-label={label}
          classNames={{ trigger: "min-h-10 md:min-h-9" }}
          onChange={onChange}
          options={options.map((option) => ({
            value: option.value,
            label: option.count === undefined ? option.label : `${option.label} ${option.count}`,
          }))}
          style={{ width: "100%" }}
          value={value}
        />
      </div>
    </>
  );
}

/** Sticky bar shown while rows are selected; keeps bulk actions out of the toolbar. */
export function AdminSelectionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (!count) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs md:px-4 dark:border-white/[0.06] dark:bg-white/[0.03]"
      role="region"
      aria-label="批量操作"
    >
      <span className="font-medium text-gray-700 dark:text-gray-200">已选 {count} 项</span>
      <button
        className="min-h-8 px-1 text-gray-400 underline-offset-4 hover:text-gray-700 hover:underline dark:hover:text-gray-200"
        onClick={onClear}
        type="button"
      >
        取消选择
      </button>
      <div className="ml-auto flex flex-wrap items-center gap-0.5">{children}</div>
    </div>
  );
}

export function AdminEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/[0.06]">
        <Inbox size={18} strokeWidth={1.6} />
      </span>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</p>
      {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Table header cell with consistent spacing. */
export const adminTh = "whitespace-nowrap px-4 py-2.5 text-left text-xs font-normal text-gray-400";
export const adminTd = "px-4 py-3 align-middle";
export const adminRow =
  "border-t border-gray-100 transition-colors hover:bg-gray-50/80 dark:border-white/[0.05] dark:hover:bg-white/[0.03]";

export function AdminPagination({
  page,
  pageSize,
  total,
  unit,
  pageSizes = [20, 50, 100],
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  unit: string;
  pageSizes?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const pages = Array.from(
    { length: Math.min(pageCount, start + 4) - start + 1 },
    (_, index) => start + index,
  );
  if (!total) return null;
  return (
    <nav
      aria-label="分页"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-3 py-3 text-xs text-gray-500 md:px-4 dark:border-white/[0.06]"
    >
      <p className="tabular-nums">
        共 {total} {unit} · 第 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} {unit}
      </p>
      <div className="flex items-center gap-1">
        <AppSelect<number>
          aria-label="每页条数"
          classNames={{ trigger: "min-h-10 md:min-h-8" }}
          onChange={onPageSizeChange}
          options={pageSizes.map((value) => ({ value, label: `${value} 条/页` }))}
          size="small"
          style={{ width: 100 }}
          value={pageSize}
        />
        <button
          aria-label="上一页"
          className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-30 md:h-8 md:w-8 dark:hover:bg-white/[0.06]"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((item) => (
          <button
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "hidden h-8 min-w-8 rounded-md px-2 font-jakarta tabular-nums transition-colors sm:block",
              item === page
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "hover:bg-gray-100 dark:hover:bg-white/[0.06]",
            )}
            key={item}
            onClick={() => onPageChange(item)}
            type="button"
          >
            {item}
          </button>
        ))}
        <span className="px-1 tabular-nums sm:hidden">
          {page} / {pageCount}
        </span>
        <button
          aria-label="下一页"
          className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-30 md:h-8 md:w-8 dark:hover:bg-white/[0.06]"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}

export function AdminRefresh({ loading, onClick }: { loading?: boolean; onClick: () => void }) {
  return (
    <button
      aria-label="刷新"
      className="flex h-10 w-10 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 md:h-9 md:w-9 dark:text-gray-400 dark:hover:bg-white/[0.07] dark:hover:text-gray-200"
      data-markai-tooltip="刷新"
      onClick={onClick}
      type="button"
    >
      <RefreshCw className={loading ? "animate-spin" : undefined} size={15} />
    </button>
  );
}

/** Secondary row actions behind a single "more" button; destructive items stay red. */
export function AdminRowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-800 md:h-8 md:w-8 dark:hover:bg-white/[0.07] dark:hover:text-gray-200"
        data-markai-tooltip="更多操作"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        ref={anchor}
        type="button"
      >
        <MoreHorizontal size={16} />
      </button>
      <FloatingMenu
        align="right"
        anchorRef={anchor}
        items={items}
        onClose={() => setOpen(false)}
        open={open}
      />
    </>
  );
}
