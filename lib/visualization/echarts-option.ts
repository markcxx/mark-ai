import type { EChartsOption } from "echarts";

const MAX_CONFIG_CHARS = 160_000;
const MAX_NODES = 60_000;
const MAX_SERIES = 30;
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "graphic", "prototype"]);

export type ParseResult =
  { error: string; ok: false } | { ok: true; option: EChartsOption; title: string };

export const ECHARTS_SERIES_TYPES = [
  "line",
  "bar",
  "pie",
  "scatter",
  "effectScatter",
  "radar",
  "heatmap",
  "funnel",
  "gauge",
  "treemap",
  "sunburst",
  "sankey",
  "graph",
  "lines",
  "pictorialBar",
  "themeRiver",
  "candlestick",
  "boxplot",
  "parallel",
  "map",
  "bar3D",
  "line3D",
  "scatter3D",
  "surface",
  "map3D",
  "lines3D",
  "graphGL",
  "flowGL",
  "scatterGL",
  "linesGL",
  "polygons3D",
];

const cartesianSeries = new Set([
  "line",
  "bar",
  "scatter",
  "effectScatter",
  "heatmap",
  "pictorialBar",
  "candlestick",
  "boxplot",
]);

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

export const parseEChartsOption = (source: string): ParseResult => {
  const trimmed = source.trim();
  if (!trimmed) return { error: "图表配置为空", ok: false };
  if (trimmed.length > MAX_CONFIG_CHARS) return { error: "图表配置过大", ok: false };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const sanitized = sanitizeOption(parsed);
    if (!isRecord(sanitized)) return { error: "图表配置必须是 JSON 对象", ok: false };
    // ECharts officially accepts both one series object and an array.
    if (isRecord(sanitized.series)) sanitized.series = [sanitized.series];
    if (!Array.isArray(sanitized.series) || sanitized.series.length === 0)
      return { error: "$.series 必须是非空数组或单个系列对象", ok: false };
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

    for (const [index, series] of sanitized.series.entries()) {
      const path = `$.series[${index}]`;
      if (
        !isRecord(series) ||
        typeof series.type !== "string" ||
        !ECHARTS_SERIES_TYPES.includes(series.type)
      )
        return { ok: false, error: `${path}.type 缺失或不受支持，请使用标准 ECharts 系列类型` };
      if (
        series.data === undefined &&
        !sanitized.dataset &&
        !(series.type === "graph" && Array.isArray(series.nodes))
      )
        return {
          ok: false,
          error: `${path}.data 缺失，请提供原始数据数组，或用 $.dataset 定义数据来源`,
        };
      if (series.data !== undefined && !Array.isArray(series.data))
        return { ok: false, error: `${path}.data 必须是数组` };
      const coordinate = series.coordinateSystem;
      if (
        cartesianSeries.has(series.type) &&
        (!coordinate || coordinate === "cartesian2d") &&
        (!sanitized.xAxis || !sanitized.yAxis)
      )
        return { ok: false, error: `${path} 使用直角坐标系，需要同时提供 $.xAxis 和 $.yAxis` };
      if (series.type === "radar" && !sanitized.radar)
        return { ok: false, error: `${path} 需要 $.radar.indicator 定义雷达图指标` };
      if (
        ["bar3D", "line3D", "scatter3D", "surface"].includes(series.type) &&
        (!coordinate || coordinate === "cartesian3D") &&
        (!sanitized.grid3D || !sanitized.xAxis3D || !sanitized.yAxis3D || !sanitized.zAxis3D)
      )
        return { ok: false, error: `${path} 需要 grid3D、xAxis3D、yAxis3D、zAxis3D` };
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
      error:
        error instanceof SyntaxError
          ? `JSON 格式不正确：${error.message}`
          : error instanceof Error
            ? error.message
            : "JSON 格式不正确",
      ok: false,
    };
  }
};
