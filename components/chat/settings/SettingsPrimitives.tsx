"use client";

import { AlertCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsDivider({ dashed = false }: { dashed?: boolean }) {
  return <hr className="markai-settings-divider" data-dashed={dashed} />;
}

export function SettingsGroup({
  title,
  description,
  children,
  extra,
  bodyClassName,
}: {
  title: ReactNode;
  description?: string;
  children: ReactNode;
  extra?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="mb-9 min-w-0 rounded-xl bg-gray-100/80 p-[3px] dark:bg-[#0e0f11]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-[13px] py-[13px]">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {description && (
            <p className="mt-1 text-xs leading-5 font-normal text-gray-500">{description}</p>
          )}
        </div>
        {extra}
      </div>
      <div
        className={cn(
          "min-w-0 rounded-lg border border-gray-200/80 bg-white px-4 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.12)] dark:border-white/[0.08] dark:bg-[#111214] dark:shadow-none",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function SettingRow({
  children,
  description,
  title,
  stacked = false,
}: {
  children: ReactNode;
  description?: string;
  title: string;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 border-b border-gray-200/60 py-4 last:border-0 dark:border-white/[0.07]",
        !stacked && "sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="min-w-0 sm:pr-4">
        <div className="text-sm text-gray-900 dark:text-gray-100">{title}</div>
        {description && (
          <div className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
            {description}
          </div>
        )}
      </div>
      <div
        className={cn(
          "min-w-0 max-w-full [&>*]:max-w-full",
          !stacked && "sm:shrink-0 sm:max-w-[55%]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SettingsProfileRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-12 flex-col gap-3 border-b border-gray-200/60 py-4 last:border-0 dark:border-white/[0.07] md:flex-row md:items-center md:gap-6">
      <div className="shrink-0 md:w-40">
        <span className="text-sm font-semibold">{title}</span>
        {description && <p className="mt-1 text-xs leading-5 text-gray-400">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">{children}</div>
    </div>
  );
}

export function SettingsButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.08] sm:min-h-9",
        className,
      )}
      {...props}
    />
  );
}

export function SettingsSkeleton() {
  return (
    <div role="status" aria-label="正在加载设置" className="space-y-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-100 dark:bg-white/10" />
          <div className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />
        </div>
      ))}
    </div>
  );
}

export function SettingsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/5 dark:text-red-300"
    >
      <AlertCircle size={18} />
      <span className="min-w-0 flex-1">{message}</span>
      <SettingsButton onClick={onRetry}>重试</SettingsButton>
    </div>
  );
}

export function SettingsEmpty({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-gray-500">{description}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
