"use client";

import { ArrowDown, ArrowUp, Atom, Eye, History, ImagePlus, Video, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { ConfiguredModel } from "@/lib/chat/types";
import { getModelDisplayName } from "@/lib/chat/helpers";
import { isImageGenerationModel } from "@/lib/chat/image-models";
import { getConfiguredModelMetadata } from "@/lib/model-catalog";
import { CAPABILITY_AXES, getModelRatingAxes } from "@/lib/model-ratings";
import {
  formatContextWindow,
  hasKnownContextWindow,
  type ModelPricing,
  type ModelRatings,
} from "@/lib/model-metadata";
import { cn } from "@/lib/utils";

function RatingsRadar({ ratings }: { ratings: ModelRatings }) {
  const axes = getModelRatingAxes(ratings);
  if (axes.length < 3) return null;
  const [width, height, cx, cy, radius] = [300, 190, 150, 98, 62];
  const point = (index: number, scale: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axes.length;
    return [cx + Math.cos(angle) * radius * scale, cy + Math.sin(angle) * radius * scale];
  };
  const polygon = (scaleAt: (index: number) => number) =>
    axes.map((_, index) => point(index, scaleAt(index)).join(",")).join(" ");
  const score = (key: keyof ModelRatings) => Math.max(0, Math.min(100, ratings[key]!)) / 100;

  return (
    <svg
      aria-label={axes.map((axis) => `${axis.label} ${ratings[axis.key]}`).join("，")}
      className="mx-auto block h-auto w-full max-w-[300px]"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          className="fill-none stroke-gray-200 dark:stroke-white/10"
          key={scale}
          points={polygon(() => scale)}
        />
      ))}
      {axes.map((axis, index) => {
        const [x, y] = point(index, 1);
        return (
          <line
            className="stroke-gray-200 dark:stroke-white/10"
            key={axis.key}
            x1={cx}
            x2={x}
            y1={cy}
            y2={y}
          />
        );
      })}
      <polygon
        className="fill-gray-900/20 stroke-gray-800 dark:fill-white/15 dark:stroke-gray-200"
        points={polygon((index) => score(axes[index].key))}
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
      {axes.map((axis, index) => {
        const [x, y] = point(index, 1.28);
        const anchor = x < cx - 4 ? "end" : x > cx + 4 ? "start" : "middle";
        return (
          <text
            className="fill-gray-500 text-[11px] dark:fill-gray-400"
            dominantBaseline="middle"
            key={axis.key}
            textAnchor={anchor}
            x={x}
            y={y}
          >
            {axis.label}{" "}
            <tspan className="fill-gray-900 font-semibold dark:fill-gray-100">
              {ratings[axis.key]}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

function Section({
  accent,
  children,
  title,
}: {
  accent: string;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="border-t border-gray-100 px-4 py-3 dark:border-white/[0.07]">
      <h4 className="mb-1.5 flex items-center gap-2 text-xs font-medium text-gray-900 dark:text-gray-100">
        <span aria-hidden="true" className={cn("h-3 w-[3px] rounded-full", accent)} />
        {title}
      </h4>
      {children}
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-h-7 items-center gap-2 text-xs">
      {Icon && <Icon aria-hidden="true" className="shrink-0 text-gray-400" size={13} />}
      <span className="shrink-0 text-gray-600 dark:text-gray-300">{label}</span>
      <span className="ml-auto min-w-0 truncate pl-3 text-right tabular-nums text-gray-400 dark:text-gray-500">
        {value}
      </span>
    </div>
  );
}

const formatPrice = (pricing: ModelPricing, value: number) =>
  `${pricing.currency === "CNY" ? "¥" : "$"}${value} / 百万 tokens`;

/** Side card describing the highlighted model; sections without data are omitted. */
export function ModelDetailCard({ model }: { model: ConfiguredModel }) {
  const metadata = getConfiguredModelMetadata(model);
  const imageModel = isImageGenerationModel(model.id);
  const name =
    model.presentation?.displayName || metadata?.displayName || getModelDisplayName(model.id);
  const description = model.presentation?.description || metadata?.description;
  const capabilities: { icon: LucideIcon; label: string; value: string }[] = [];
  if (imageModel)
    capabilities.push({ icon: ImagePlus, label: "图片生成", value: "支持生成与多轮修改" });
  if (metadata?.supportsVision)
    capabilities.push({ icon: Eye, label: "视觉识别", value: "支持图片理解" });
  if (metadata?.supportsVideo)
    capabilities.push({ icon: Video, label: "视频识别", value: "支持视频理解" });
  if (metadata?.supportsToolCalling)
    capabilities.push({ icon: Wrench, label: "工具调用", value: "支持 Tool Calling" });
  if (model.thinking || metadata?.supportsReasoning)
    capabilities.push({
      icon: Atom,
      label: "深度思考",
      value: model.thinking ? "可手动开关" : "内置推理",
    });
  const pricing = metadata?.pricing;
  const benchmark = metadata?.benchmark;

  return (
    <div className="pb-1">
      <header className="px-4 pb-3 pt-3.5">
        <p className="break-words font-jakarta text-sm font-semibold text-gray-900 dark:text-gray-100">
          {name}
        </p>
        <p className="mt-0.5 break-all font-mono text-[11px] text-gray-400">{model.id}</p>
        {description && (
          <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </header>
      {metadata?.ratings && benchmark && (
        <Section accent="bg-pink-500" title="评测参考">
          <RatingsRadar ratings={metadata.ratings} />
          <p className="break-words text-[11px] leading-4 text-gray-500 dark:text-gray-400">
            评测版本：{benchmark.modelName}
          </p>
          <details className="mt-2 text-[11px] leading-5 text-gray-500 dark:text-gray-400">
            <summary className="cursor-pointer">原始指标与评分说明</summary>
            {benchmark.intelligence !== undefined && (
              <DetailRow label="智能指数" value={benchmark.intelligence} />
            )}
            {benchmark.coding !== undefined && (
              <DetailRow label="编码指数" value={benchmark.coding} />
            )}
            {benchmark.agentic !== undefined && (
              <DetailRow label="Agentic 指数" value={benchmark.agentic} />
            )}
            {CAPABILITY_AXES.map(
              (axis) =>
                benchmark.capabilities?.[axis.key] !== undefined && (
                  <DetailRow
                    key={axis.key}
                    label={`${axis.label}指数`}
                    value={benchmark.capabilities[axis.key]}
                  />
                ),
            )}
            {benchmark.outputTokensPerSecond !== undefined && (
              <DetailRow label="输出速度" value={`${benchmark.outputTokensPerSecond} tokens/s`} />
            )}
            {benchmark.timeToFirstTokenSeconds !== undefined && (
              <DetailRow label="首字延迟" value={`${benchmark.timeToFirstTokenSeconds} 秒`} />
            )}
            <p className="mt-1">
              雷达值为同批 AA 评测的百分位，越高越好，并非原始得分。经济性按输入与输出 3:1
              加权价格反向排名。优先展示智能、Agentic、编码、速度和经济性，缺失时按固定顺序补入有数据的专业能力，最多五维；请按实际轴名称比较。速度为
              AA 跨提供商统计，不代表当前线路实测。
            </p>
          </details>
          <p className="mt-2 text-[10px] leading-4 text-gray-400">
            <a
              className="underline underline-offset-2"
              href={benchmark.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Artificial Analysis
            </a>
            {` · 智能指数 v${benchmark.indexVersion} · ${benchmark.updatedAt.slice(0, 10)}`}
          </p>
        </Section>
      )}
      {(hasKnownContextWindow(metadata) ||
        metadata?.maxOutputTokens ||
        metadata?.knowledgeCutoff) && (
        <Section accent="bg-blue-500" title="规格">
          {hasKnownContextWindow(metadata) && (
            <DetailRow
              label="上下文长度"
              value={`${formatContextWindow(metadata.contextWindowTokens)} tokens`}
            />
          )}
          {metadata?.maxOutputTokens && (
            <DetailRow
              label="最大输出"
              value={`${formatContextWindow(metadata.maxOutputTokens)} tokens`}
            />
          )}
          {metadata?.knowledgeCutoff && (
            <DetailRow label="知识截止" value={metadata.knowledgeCutoff} />
          )}
        </Section>
      )}
      {capabilities.length > 0 && (
        <Section accent="bg-violet-500" title="能力">
          {capabilities.map((item) => (
            <DetailRow icon={item.icon} key={item.label} label={item.label} value={item.value} />
          ))}
        </Section>
      )}
      {pricing && (
        <Section accent="bg-amber-500" title="参考价格">
          <DetailRow icon={ArrowUp} label="输入" value={formatPrice(pricing, pricing.input)} />
          <DetailRow icon={ArrowDown} label="输出" value={formatPrice(pricing, pricing.output)} />
          {pricing.cachedInput !== undefined && (
            <DetailRow
              icon={History}
              label="输入（缓存命中）"
              value={formatPrice(pricing, pricing.cachedInput)}
            />
          )}
          {pricing.cacheWrite !== undefined && (
            <DetailRow
              icon={History}
              label="输入（缓存写入）"
              value={formatPrice(pricing, pricing.cacheWrite)}
            />
          )}
          {pricing.cachedInput === undefined && <DetailRow label="缓存命中" value="暂无报价" />}
          {pricing.cacheWrite === undefined && <DetailRow label="缓存写入" value="暂无报价" />}
        </Section>
      )}
      {!metadata && !imageModel && (
        <p className="border-t border-gray-100 px-4 py-3 text-xs leading-5 text-gray-400 dark:border-white/[0.07]">
          暂未收录该型号的规格资料，请以服务商说明为准。
        </p>
      )}
    </div>
  );
}
