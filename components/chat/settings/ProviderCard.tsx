"use client";
import { BadgeCheck } from "lucide-react";
import { ProviderBrandIcon } from "../ModelBrandIcon";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import AppImage from "@/components/ui/AppImage";

export function ProviderWordmark({
  name,
  provider,
  large = false,
}: {
  name: string;
  provider: string;
  large?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {provider === "markai" ? (
        <AppImage
          alt="MarkAI"
          src="/images/markai.svg"
          width={large ? 32 : 24}
          height={large ? 32 : 24}
        />
      ) : (
        <ProviderBrandIcon name={name} provider={provider} size={large ? 32 : 24} />
      )}
      <span className={`${large ? "text-2xl" : "text-base"} truncate font-jakarta font-semibold`}>
        {name}
      </span>
    </span>
  );
}
function BrandProviderCard({
  description,
  onSelect,
}: {
  description: string;
  onSelect: () => void;
}) {
  return (
    <article className="markai-provider-brand-card min-h-[172px] min-w-0 rounded-xl border border-black/[0.06] bg-white p-4 transition-colors hover:border-black/15 dark:border-white/10 dark:bg-[#111214] dark:hover:border-white/25">
      <button
        type="button"
        onClick={onSelect}
        className="flex h-full w-full flex-col items-start justify-start text-left"
        aria-label="查看 MarkAI 服务"
      >
        <span className="flex items-center gap-2">
          <ProviderWordmark name="MarkAI" provider="markai" />
          <BadgeCheck size={16} className="shrink-0 text-emerald-600" aria-label="站点官方服务" />
        </span>
        <p className="mt-5 min-h-11 text-sm leading-[22px] text-gray-500 dark:text-gray-400">
          {description}
        </p>
        <span className="block h-10" aria-hidden="true" />
      </button>
    </article>
  );
}

export function ProviderCard({
  name,
  id,
  description,
  enabled,
  disabled,
  onSelect,
  onToggle,
}: {
  name: string;
  id: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
  onSelect: () => void;
  onToggle: (value: boolean) => void;
}) {
  if (id === "markai") return <BrandProviderCard description={description} onSelect={onSelect} />;
  return (
    <article className="min-h-[172px] min-w-0 rounded-xl border border-black/[0.06] bg-white p-4 transition-colors hover:border-black/15 dark:border-white/10 dark:bg-[#111214] dark:hover:border-white/25">
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <ProviderWordmark name={name} provider={id} />
        <p
          className="mt-3 line-clamp-2 min-h-11 text-sm leading-[22px] text-gray-500 dark:text-gray-400"
          data-markai-tooltip={description}
        >
          {description}
        </p>
      </button>
      <div className="mb-4 mt-5 border-t border-[var(--settings-divider)]" />
      <div className="flex justify-end">
        <ToggleSwitch
          aria-label={`启用 ${name}`}
          checked={enabled}
          disabled={disabled}
          onChange={onToggle}
        />
      </div>
    </article>
  );
}
