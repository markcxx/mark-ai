"use client";

import type { CSSProperties } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandAsset = {
  avatarSlug?: string;
  background: string;
  foreground: string;
  scale?: number;
  slug: string;
};

const BRAND_ASSETS: Record<string, BrandAsset> = {
  anthropic: { background: "#f1f0e8", foreground: "#141413", slug: "anthropic" },
  chatglm: {
    background: "linear-gradient(135deg, #3485ff, #504af4)",
    foreground: "#fff",
    slug: "chatglm",
  },
  claude: { background: "#d97757", foreground: "#fff", slug: "claude" },
  deepseek: { background: "#4d6bfe", foreground: "#fff", slug: "deepseek" },
  doubao: {
    avatarSlug: "doubao-color",
    background: "#fff",
    foreground: "#111",
    slug: "doubao",
  },
  gemini: {
    avatarSlug: "gemini-color",
    background: "#fff",
    foreground: "#111",
    scale: 0.8,
    slug: "gemini",
  },
  gemma: {
    background: "linear-gradient(135deg, #446eff 14%, #2e96ff 45%, #b1c5ff)",
    foreground: "#fff",
    scale: 0.88,
    slug: "gemma",
  },
  grok: { background: "#050505", foreground: "#fff", slug: "grok" },
  groq: { background: "#f55036", foreground: "#fff", slug: "groq" },
  huggingface: { background: "#ffd21e", foreground: "#111", slug: "huggingface" },
  infinigence: {
    background: "#7952ea",
    foreground: "#fff",
    scale: 0.62,
    slug: "infinigence",
  },
  meta: {
    background: "linear-gradient(135deg, #007ff8, #0668e1, #007ff8)",
    foreground: "#fff",
    slug: "meta",
  },
  nanobanana: { background: "#fcd53f", foreground: "#111", scale: 0.8, slug: "nanobanana" },
  minimax: {
    background: "linear-gradient(135deg, #e2167e, #fe603c)",
    foreground: "#fff",
    slug: "minimax",
  },
  mistral: { background: "#fa520f", foreground: "#fff", slug: "mistral" },
  moonshot: { background: "#16191e", foreground: "#fff", slug: "moonshot" },
  openai: { background: "#050505", foreground: "#fff", slug: "openai" },
  openrouter: { background: "#050505", foreground: "#c8ff00", slug: "openrouter" },
  qwen: {
    background: "linear-gradient(135deg, #6336e7, #6f69f7)",
    foreground: "#fff",
    slug: "qwen",
  },
  siliconcloud: { background: "#6e29f6", foreground: "#fff", slug: "siliconcloud" },
  together: { background: "#fff", foreground: "#111", slug: "together" },
  volcengine: { background: "#1664ff", foreground: "#fff", slug: "volcengine" },
  xai: { background: "#050505", foreground: "#fff", scale: 0.66, slug: "xai" },
  bytedance: { background: "#325ab4", foreground: "#fff", scale: 0.6, slug: "bytedance" },
  glmv: { background: "#0039c6", foreground: "#fff", scale: 0.7, slug: "glmv" },
  jimeng: { background: "#050505", foreground: "#fff", scale: 0.6, slug: "jimeng" },
  zai: { background: "#050505", foreground: "#fff", scale: 0.6, slug: "zai" },
  zhipu: { background: "#3859ff", foreground: "#fff", slug: "zhipu" },
};

const PROVIDER_ASSET_KEYS: Record<string, string> = {
  anthropic: "anthropic",
  bailian: "qwen",
  deepseek: "deepseek",
  gemini: "gemini",
  google: "gemini",
  groq: "groq",
  huggingface: "huggingface",
  infiniai: "infinigence",
  infinigence: "infinigence",
  minimax: "minimax",
  mistral: "mistral",
  moonshot: "moonshot",
  moonshotai: "moonshot",
  openai: "openai",
  openrouter: "openrouter",
  qwen: "qwen",
  siliconcloud: "siliconcloud",
  siliconflow: "siliconcloud",
  together: "together",
  volcengine: "volcengine",
  xai: "xai",
  zhipu: "zhipu",
  zhipuai: "zhipu",
};

const MODEL_ASSET_RULES: Array<{ key: string; pattern: RegExp }> = [
  { key: "claude", pattern: /claude/ },
  {
    key: "nanobanana",
    pattern: /(?:gemini[^/]*(?:flash|pro)[^/]*image|nanobanana|nano-banana)/,
  },
  { key: "gemini", pattern: /gemini/ },
  { key: "gemma", pattern: /gemma/ },
  { key: "deepseek", pattern: /deepseek/ },
  { key: "qwen", pattern: /(?:^|[/_.-])(qwen|qwq)(?:$|[/_.-])/ },
  { key: "grok", pattern: /(?:^|[/_.-])grok(?:$|[/_.-])/ },
  { key: "meta", pattern: /(?:llama|meta-llama)/ },
  { key: "glmv", pattern: /(?:^|\/)glm-[^/]*v(?:$|[/_.-])/ },
  { key: "zai", pattern: /(?:^|[/_.-])glm[-_.]?[45](?:$|[/_.-])/ },
  { key: "chatglm", pattern: /(?:chatglm|(?:^|[/_.-])glm-)/ },
  { key: "jimeng", pattern: /(?:jimeng|seedream|seededit|seedance)/ },
  { key: "doubao", pattern: /(?:^|\/)ep-|doubao-/ },
  { key: "bytedance", pattern: /(?:skylark|(?:^|[/_.-])seed-|bytedance)/ },
  { key: "minimax", pattern: /(?:minimax|abab)/ },
  { key: "mistral", pattern: /(?:mistral|mixtral|codestral|pixtral)/ },
  { key: "moonshot", pattern: /(?:kimi|moonshot)/ },
  { key: "openai", pattern: /(?:gpt|chatgpt|(?:^|[/_.-])o[1345](?:$|[/_.-])|dall-e|sora)/ },
];

const getProviderAsset = (provider?: string) => {
  const normalized = provider?.trim().toLowerCase();
  if (!normalized) return undefined;
  return BRAND_ASSETS[PROVIDER_ASSET_KEYS[normalized] || normalized];
};

const getModelAsset = (model?: string, provider?: string) => {
  const normalizedModel = model?.trim().toLowerCase() || "";
  const match = MODEL_ASSET_RULES.find((rule) => rule.pattern.test(normalizedModel));
  const asset = match ? BRAND_ASSETS[match.key] : getProviderAsset(provider);
  if (!asset || asset.slug !== "openai") return asset;

  if (/gpt[-_.]?5/.test(normalizedModel)) return { ...asset, background: "#f86aa4" };
  if (/gpt[-_.]?4/.test(normalizedModel)) return { ...asset, background: "#ab68ff" };
  if (/gpt[-_.]?3/.test(normalizedModel)) return { ...asset, background: "#19c37d" };
  if (/(?:^|[/_.-])o[1345](?:$|[/_.-])/.test(normalizedModel)) {
    return { ...asset, background: "#f9c322", foreground: "#111" };
  }
  return asset;
};

const getMaskStyle = (slug: string): CSSProperties => ({
  WebkitMaskImage: `url("/images/model-icons/${slug}.svg")`,
  WebkitMaskPosition: "center",
  WebkitMaskRepeat: "no-repeat",
  WebkitMaskSize: "contain",
  backgroundColor: "currentColor",
  maskImage: `url("/images/model-icons/${slug}.svg")`,
  maskPosition: "center",
  maskRepeat: "no-repeat",
  maskSize: "contain",
});

export function ProviderBrandIcon({
  className,
  name,
  provider,
  size = 24,
}: {
  className?: string;
  name?: string;
  provider?: string;
  size?: number;
}) {
  const asset = getProviderAsset(provider);
  if (!asset) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center font-jakarta font-bold",
          className,
        )}
        style={{ height: size, width: size }}
      >
        {(name || provider || "AI").slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0", className)}
      style={{ ...getMaskStyle(asset.slug), height: size, width: size }}
    />
  );
}

export function ModelBrandIcon({
  className,
  model,
  provider,
  size = 20,
}: {
  className?: string;
  model?: string;
  provider?: string;
  size?: number;
}) {
  const asset = getModelAsset(model, provider);
  const label = model || provider || "AI 模型";

  if (!asset) {
    const fallback = label.match(/[a-z0-9]/i)?.[0]?.toUpperCase() || "AI";
    return (
      <span
        aria-label={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 font-jakarta font-bold text-gray-600 ring-1 ring-black/5 dark:bg-gray-700 dark:text-gray-200 dark:ring-white/10",
          className,
        )}
        role="img"
        style={{ fontSize: Math.max(9, Math.round(size * 0.42)), height: size, width: size }}
      >
        {fallback}
      </span>
    );
  }

  const glyphSize = Math.round(size * (asset.scale || 0.75));
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10",
        className,
      )}
      role="img"
      style={{
        background: asset.background,
        color: asset.foreground,
        height: size,
        width: size,
      }}
    >
      {asset.avatarSlug ? (
        <Image
          alt=""
          aria-hidden="true"
          height={glyphSize}
          src={`/images/model-icons/${asset.avatarSlug}.svg`}
          width={glyphSize}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{ ...getMaskStyle(asset.slug), height: glyphSize, width: glyphSize }}
        />
      )}
    </span>
  );
}
