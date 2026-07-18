"use client";

import type { EChartsOption } from "echarts";
import type { EChartsType } from "echarts/core";
import {
  AlertCircle,
  ChartNoAxesCombined,
  Check,
  Copy,
  Download,
  Loader2,
  Maximize2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppDialog } from "@/components/ui/AppDialog";
import { AppSelect } from "@/components/ui/AppSelect";
import { cn } from "@/lib/utils";
import { ECHARTS_THEME_PALETTES } from "@/lib/visualization/echarts-theme-palettes";

const MAX_CONFIG_CHARS = 160_000;
const MAX_NODES = 60_000;
const MAX_SERIES = 30;
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "graphic", "prototype"]);

type ParseResult =
  { error: string; ok: false } | { ok: true; option: EChartsOption; title: string };

type ChartThemeId =
  | "auto"
  | "azul"
  | "bee-inspired"
  | "blue"
  | "caravan"
  | "carp"
  | "cool"
  | "dark"
  | "dark-blue"
  | "dark-bold"
  | "dark-digerati"
  | "dark-fresh-cut"
  | "dark-mushroom"
  | "eduardo"
  | "forest"
  | "fresh-cut"
  | "fruit"
  | "gray"
  | "green"
  | "helianthus"
  | "infographic"
  | "inspired"
  | "jazz"
  | "light"
  | "london"
  | "macarons"
  | "macarons2"
  | "mint"
  | "rainbow"
  | "red"
  | "red-velvet"
  | "roma"
  | "royal"
  | "sakura"
  | "shine"
  | "tech-blue"
  | "v5"
  | "vintage";

const chartThemeOptions: Array<{ label: string; value: ChartThemeId }> = [
  { label: "跟随界面", value: "auto" },
  { label: "明亮", value: "light" },
  { label: "深色", value: "dark" },
  { label: "Azul", value: "azul" },
  { label: "Bee Inspired", value: "bee-inspired" },
  { label: "Blue", value: "blue" },
  { label: "Caravan", value: "caravan" },
  { label: "Carp", value: "carp" },
  { label: "Cool", value: "cool" },
  { label: "Dark Blue", value: "dark-blue" },
  { label: "Dark Bold", value: "dark-bold" },
  { label: "Dark Digerati", value: "dark-digerati" },
  { label: "Dark Fresh Cut", value: "dark-fresh-cut" },
  { label: "Dark Mushroom", value: "dark-mushroom" },
  { label: "Eduardo", value: "eduardo" },
  { label: "Forest", value: "forest" },
  { label: "Fresh Cut", value: "fresh-cut" },
  { label: "Fruit", value: "fruit" },
  { label: "Gray", value: "gray" },
  { label: "Green", value: "green" },
  { label: "Helianthus", value: "helianthus" },
  { label: "Infographic", value: "infographic" },
  { label: "Inspired", value: "inspired" },
  { label: "Jazz", value: "jazz" },
  { label: "London", value: "london" },
  { label: "马卡龙", value: "macarons" },
  { label: "马卡龙 2", value: "macarons2" },
  { label: "Mint", value: "mint" },
  { label: "Rainbow", value: "rainbow" },
  { label: "Red", value: "red" },
  { label: "Red Velvet", value: "red-velvet" },
  { label: "Roma", value: "roma" },
  { label: "Royal", value: "royal" },
  { label: "Sakura", value: "sakura" },
  { label: "Shine", value: "shine" },
  { label: "Tech Blue", value: "tech-blue" },
  { label: "ECharts v5", value: "v5" },
  { label: "复古", value: "vintage" },
];

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

const resolveTheme = (theme: ChartThemeId, dark: boolean) => {
  if (theme === "auto") return dark ? "dark" : undefined;
  if (theme === "light") return undefined;
  return theme;
};

const getThemeBackground = (theme: ChartThemeId, dark: boolean) => {
  if (theme === "auto") return dark ? "#171717" : "#ffffff";
  if (theme === "dark" || theme.startsWith("dark-")) return "#333333";
  if (theme === "vintage") return "#fef8ef";
  return "#ffffff";
};

const SERIES_COLOR_KEYS = new Set([
  "borderColor",
  "borderColor0",
  "color",
  "color0",
  "shadowColor",
]);

const stripSeriesColors = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripSeriesColors);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SERIES_COLOR_KEYS.has(key))
      .map(([key, child]) => [key, stripSeriesColors(child)]),
  );
};

const applyOfficialTheme = (option: EChartsOption, theme: ChartThemeId): EChartsOption => {
  const root = option as Record<string, unknown>;
  const cleaned = Object.fromEntries(
    Object.entries(root)
      .filter(([key]) => key !== "backgroundColor" && key !== "color")
      .map(([key, value]) => {
        if (key === "series" || key === "visualMap") return [key, stripSeriesColors(value)];
        return [key, value];
      }),
  );
  const palette = ECHARTS_THEME_PALETTES[theme];
  return {
    ...cleaned,
    ...(palette ? { color: [...palette] } : {}),
  } as EChartsOption;
};

function ChartCanvas({
  backgroundColor,
  chartRef,
  className,
  onReady,
  option,
  theme,
}: {
  backgroundColor: string;
  chartRef: { current: EChartsType | null };
  className?: string;
  onReady: (ready: boolean) => void;
  option: EChartsOption;
  theme?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let active = true;
    let observer: ResizeObserver | undefined;
    setLoading(true);
    setRuntimeError(null);
    onReady(false);

    void import("@/lib/visualization/echarts-client")
      .then(async ({ echarts, ensureEChartsTheme }) => {
        await ensureEChartsTheme(theme);
        if (!active || !containerRef.current) return;
        const chart = echarts.init(containerRef.current, theme, { renderer: "canvas" });
        chartRef.current = chart;
        chart.setOption(option, { lazyUpdate: false, notMerge: true });
        observer = new ResizeObserver(() => chart.resize());
        observer.observe(containerRef.current);
        setLoading(false);
        onReady(true);
      })
      .catch((error) => {
        if (!active) return;
        setLoading(false);
        setRuntimeError(error instanceof Error ? error.message : "图表组件加载失败");
        onReady(false);
      });

    return () => {
      active = false;
      observer?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
      onReady(false);
    };
  }, [chartRef, onReady, option, theme]);

  return (
    <div className={cn("relative", className)} style={{ backgroundColor }}>
      <div className="h-full w-full" ref={containerRef} />
      {loading && !runtimeError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/75 text-gray-400 backdrop-blur-sm dark:bg-[#171717]/75">
          <Loader2 className="animate-spin" size={21} />
        </div>
      )}
      {runtimeError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 px-6 text-center dark:bg-[#171717]/90">
          <AlertCircle className="text-amber-500" size={24} />
          <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">图表渲染失败</p>
          <p className="mt-1 max-w-lg text-xs text-gray-400">{runtimeError}</p>
        </div>
      )}
    </div>
  );
}

export function EChartsPreviewBlock({ children }: { children: string }) {
  const chartRef = useRef<EChartsType | null>(null);
  const expandedChartRef = useRef<EChartsType | null>(null);
  const { resolvedTheme } = useTheme();
  const [chartReady, setChartReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedChartReady, setExpandedChartReady] = useState(false);
  const [chartTheme, setChartTheme] = useState<ChartThemeId>("auto");
  const parsed = useMemo(() => parseOption(children), [children]);
  const dark = resolvedTheme === "dark";
  const runtimeTheme = resolveTheme(chartTheme, dark);
  const chartBackground = getThemeBackground(chartTheme, dark);
  const chartOption = useMemo(
    () =>
      parsed.ok && chartTheme !== "auto"
        ? applyOfficialTheme(parsed.option, chartTheme)
        : undefined,
    [chartTheme, parsed],
  );

  const copyConfig = async () => {
    await navigator.clipboard.writeText(children.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const downloadImage = (chart: EChartsType | null) => {
    if (!chart || !parsed.ok) return;
    const url = chart.getDataURL({
      backgroundColor: chartBackground,
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

  return (
    <>
      <section className="my-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-1.5 dark:border-white/[0.08]">
          <div className="flex min-w-[140px] flex-1 items-center gap-2">
            <ChartNoAxesCombined className="shrink-0 text-primary" size={17} />
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {parsed.ok ? parsed.title : "数据图表"}
            </span>
            <span className="hidden shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:inline dark:bg-white/[0.06]">
              ECharts
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <AppSelect
              onChange={(value) =>
                typeof value === "string" && setChartTheme(value as ChartThemeId)
              }
              options={chartThemeOptions}
              size="small"
              style={{ width: 112 }}
              value={chartTheme}
            />
            {parsed.ok && (
              <>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 dark:hover:bg-white/[0.07] dark:hover:text-gray-200"
                  disabled={!chartReady}
                  onClick={() => setExpanded(true)}
                  title="放大查看"
                  type="button"
                >
                  <Maximize2 size={15} />
                </button>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 dark:hover:bg-white/[0.07] dark:hover:text-gray-200"
                  disabled={!chartReady}
                  onClick={() => downloadImage(chartRef.current)}
                  title="下载图表 PNG"
                  type="button"
                >
                  <Download size={15} />
                </button>
              </>
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

        {parsed.ok ? (
          <ChartCanvas
            backgroundColor={chartBackground}
            chartRef={chartRef}
            className="h-[340px] w-full sm:h-[380px]"
            onReady={setChartReady}
            option={chartOption || parsed.option}
            theme={runtimeTheme}
          />
        ) : (
          <div className="flex h-[340px] flex-col items-center justify-center px-6 text-center sm:h-[380px]">
            <AlertCircle className="text-amber-500" size={24} />
            <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
              图表配置尚未完成或格式不正确
            </p>
            <p className="mt-1 max-w-lg text-xs text-gray-400">{parsed.error}</p>
          </div>
        )}
      </section>

      <AppDialog
        bodyClassName="min-h-0 !h-[calc(100%-55px)] overflow-hidden"
        height="min(92dvh, 920px)"
        onClose={() => setExpanded(false)}
        open={expanded && parsed.ok}
        panelClassName="overflow-hidden"
        title={parsed.ok ? parsed.title : "ECharts 可视化"}
        width="min(96vw, 1440px)"
        zIndex={110}
      >
        {parsed.ok && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-3 sm:px-4 dark:border-white/[0.08]">
              <p className="truncate text-xs text-gray-400">可滚轮缩放、拖动或旋转图表</p>
              <div className="flex shrink-0 items-center gap-2">
                <AppSelect
                  onChange={(value) =>
                    typeof value === "string" && setChartTheme(value as ChartThemeId)
                  }
                  options={chartThemeOptions}
                  size="small"
                  style={{ width: 120 }}
                  value={chartTheme}
                />
                <button
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-40"
                  disabled={!expandedChartReady}
                  onClick={() => downloadImage(expandedChartRef.current)}
                  type="button"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">下载 PNG</span>
                </button>
              </div>
            </div>
            <ChartCanvas
              backgroundColor={chartBackground}
              chartRef={expandedChartRef}
              className="min-h-0 flex-1"
              onReady={setExpandedChartReady}
              option={chartOption || parsed.option}
              theme={runtimeTheme}
            />
          </div>
        )}
      </AppDialog>
    </>
  );
}
