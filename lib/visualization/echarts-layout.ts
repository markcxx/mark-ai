import type { EChartsOption } from "echarts";

type Component = Record<string, any>;
const list = (value: unknown): Component[] =>
  (Array.isArray(value) ? value : value ? [value] : []).filter(
    (item) => item && typeof item === "object",
  );
const pixels = (value: unknown, total: number, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+(\.\d+)?%$/.test(value))
    return (parseFloat(value) / 100) * total;
  const number = typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : fallback;
};

/** Keep bottom legends outside the Cartesian axes, independently of generated spacing. */
export function layoutEChartsOption(
  option: EChartsOption,
  width: number,
  height: number,
): EChartsOption {
  const root = option as Component;
  if (!root.xAxis || !root.yAxis || width <= 0 || height <= 0) return option;

  let reservedBottom = 0;
  const legend = list(root.legend).map((source) => {
    // Positioned top/side legends and coordinate-system layouts keep their authored placement.
    if (
      source.show === false ||
      source.orient === "vertical" ||
      source.coordinateSystem ||
      (source.top != null && source.top !== "bottom" && source.top !== "auto")
    )
      return source;
    const fontSize = pixels(source.textStyle?.fontSize, height, 12);
    const lineHeight = pixels(source.textStyle?.lineHeight, height, Math.ceil(fontSize * 1.5));
    const labels = source.data || list(root.series).map((series) => series.name || "");
    const lines = Math.max(
      1,
      ...labels.map(
        (item: any) =>
          String(typeof item === "string" ? item : item?.name || "").split("\n").length,
      ),
    );
    const contentHeight = Math.max(16, pixels(source.itemHeight, height, 14), lineHeight * lines);
    const bottom = Math.max(8, pixels(source.bottom, height, 8), reservedBottom);
    reservedBottom = bottom + contentHeight + 10 + 16;
    return {
      ...source,
      // A scroll legend stays one row high at mobile widths instead of wrapping into the axes.
      type: "scroll",
      top: undefined,
      bottom,
      left: 16,
      right: 16,
      width: undefined,
      height: contentHeight,
      padding: 5,
      textStyle: {
        ...source.textStyle,
        width: Math.max(48, Math.min(pixels(source.textStyle?.width, width, 240), width - 140)),
        overflow: "truncate",
      },
      tooltip: { show: true, ...source.tooltip, confine: true, renderMode: "richText" },
    };
  });
  if (!reservedBottom) return option;

  const grid = (list(root.grid).length ? list(root.grid) : [{}]).map((source) => {
    if (source.coordinateSystem) return source;
    // Only grids reaching the footer need to shrink (preserves upper panels in multi-grid charts).
    const top = pixels(source.top, height, 60);
    const bottom = Math.max(pixels(source.bottom, height, 30), reservedBottom);
    const plotHeight =
      source.height == null ? undefined : pixels(source.height, height, height - top - bottom);
    return {
      ...source,
      bottom,
      ...(plotHeight == null
        ? {}
        : { height: Math.max(0, Math.min(plotHeight, height - top - bottom)) }),
      // ECharts 6: contain axis labels AND names inside the area above the legend.
      outerBoundsMode: "same",
      outerBoundsContain: "all",
    };
  });
  return { ...option, legend, grid } as EChartsOption;
}
