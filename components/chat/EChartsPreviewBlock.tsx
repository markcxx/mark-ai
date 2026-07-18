"use client";

import type { EChartsOption } from "echarts";
import type { EChartsType } from "echarts/core";
import { AlertCircle, ChartNoAxesCombined, Check, Copy, Download, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

const MAX_CONFIG_CHARS = 160_000;
const MAX_NODES = 60_000;
const MAX_SERIES = 30;
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "graphic", "prototype"]);

type ParseResult =
  { error: string; ok: false } | { ok: true; option: EChartsOption; title: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const sanitizeOption = (input: unknown) => {
  let nodes = 0;

  const visit = (value: unknown, key = "", depth = 0): unknown => {
    nodes += 1;
    if (nodes > MAX_NODES) throw new Error("图表数据量过大");
    if (depth > 24) throw new Error("图表配置嵌套过深");
    if (value === null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") {
      if (
        (key === "image" || key === "symbol") &&
        /^(?:data:|image:\/\/|https?:\/\/)/i.test(value)
      ) {
        return key === "symbol" ? "circle" : undefined;
      }
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => visit(item, key, depth + 1));
    if (!isRecord(value)) return undefined;

    return Object.fromEntries(
      Object.entries(value)
        .filter(([childKey]) => !BLOCKED_KEYS.has(childKey))
        .map(([childKey, childValue]) => [childKey, visit(childValue, childKey, depth + 1)])
        .filter((entry) => entry[1] !== undefined),
    );
  };

  return visit(input);
};

const getChartTitle = (option: Record<string, unknown>) => {
  const title = Array.isArray(option.title) ? option.title[0] : option.title;
  if (!isRecord(title) || typeof title.text !== "string" || !title.text.trim()) return "数据图表";
  return title.text.trim().slice(0, 80);
};

const parseOption = (source: string): ParseResult => {
  const trimmed = source.trim();
  if (!trimmed) return { error: "图表配置为空", ok: false };
  if (trimmed.length > MAX_CONFIG_CHARS) return { error: "图表配置过大", ok: false };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const sanitized = sanitizeOption(parsed);
    if (!isRecord(sanitized)) return { error: "图表配置必须是 JSON 对象", ok: false };
    if (!Array.isArray(sanitized.series) || sanitized.series.length === 0) {
      return { error: "图表配置缺少 series 数据", ok: false };
    }
    if (sanitized.series.length > MAX_SERIES) {
      return { error: "图表系列数量过多", ok: false };
    }
    if (
      sanitized.series.some(
        (series) => isRecord(series) && (series.type === "custom" || "renderItem" in series),
      )
    ) {
      return { error: "不支持执行自定义图表代码", ok: false };
    }

    const tooltip = isRecord(sanitized.tooltip) ? sanitized.tooltip : {};
    const option = {
      ...sanitized,
      aria: { enabled: true, ...(isRecord(sanitized.aria) ? sanitized.aria : {}) },
      backgroundColor: "transparent",
      tooltip: { ...tooltip, appendToBody: false, confine: true, renderMode: "richText" },
    } as EChartsOption;

    return { ok: true, option, title: getChartTitle(sanitized) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "JSON 格式不正确",
      ok: false,
    };
  }
};

const safeFileName = (value: string) =>
  value
    .replaceAll(/[/\\:*?"<>|]/g, "-")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "MarkAI 数据图表";

export function EChartsPreviewBlock({ children }: { children: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const { resolvedTheme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const parsed = useMemo(() => parseOption(children), [children]);
  const dark = resolvedTheme === "dark";

  useEffect(() => {
    if (!parsed.ok || !containerRef.current) {
      setLoading(false);
      return;
    }

    let active = true;
    let observer: ResizeObserver | undefined;
    setLoading(true);
    setRuntimeError(null);

    void import("@/lib/visualization/echarts-client")
      .then(({ echarts }) => {
        if (!active || !containerRef.current) return;
        const chart = echarts.init(containerRef.current, dark ? "dark" : undefined, {
          renderer: "canvas",
        });
        chartRef.current = chart;
        chart.setOption(parsed.option, { lazyUpdate: false, notMerge: true });
        observer = new ResizeObserver(() => chart.resize());
        observer.observe(containerRef.current);
        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setLoading(false);
        setRuntimeError(error instanceof Error ? error.message : "图表组件加载失败");
      });

    return () => {
      active = false;
      observer?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [dark, parsed]);

  const copyConfig = async () => {
    await navigator.clipboard.writeText(children.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const downloadImage = () => {
    const chart = chartRef.current;
    if (!chart || !parsed.ok) return;
    const url = chart.getDataURL({
      backgroundColor: dark ? "#171717" : "#ffffff",
      pixelRatio: 2,
      type: "png",
    });
    const anchor = document.createElement("a");
    anchor.download = `${safeFileName(parsed.title)}.png`;
    anchor.href = url;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const error = parsed.ok ? runtimeError : parsed.error;

  return (
    <section className="my-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
      <header className="flex h-11 items-center justify-between gap-3 border-b border-gray-100 px-3.5 dark:border-white/[0.08]">
        <div className="flex min-w-0 items-center gap-2">
          <ChartNoAxesCombined className="shrink-0 text-primary" size={17} />
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {parsed.ok ? parsed.title : "数据图表"}
          </span>
          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:bg-white/[0.06]">
            ECharts
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!error && (
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.07] dark:hover:text-gray-200"
              disabled={loading}
              onClick={downloadImage}
              title="下载图表 PNG"
              type="button"
            >
              <Download size={15} />
            </button>
          )}
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.07] dark:hover:text-gray-200"
            onClick={() => void copyConfig()}
            title={copied ? "配置已复制" : "复制图表配置"}
            type="button"
          >
            {copied ? <Check className="text-emerald-500" size={15} /> : <Copy size={15} />}
          </button>
        </div>
      </header>

      <div className="relative h-[340px] w-full sm:h-[380px]">
        <div className="h-full w-full" ref={containerRef} />
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-gray-400 backdrop-blur-sm dark:bg-[#171717]/80">
            <Loader2 className="animate-spin" size={21} />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <AlertCircle className="text-amber-500" size={24} />
            <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
              图表配置尚未完成或格式不正确
            </p>
            <p className="mt-1 max-w-lg text-xs text-gray-400">{error}</p>
          </div>
        )}
      </div>
    </section>
  );
}
