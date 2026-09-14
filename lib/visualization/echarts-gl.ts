const GL_SERIES = new Set([
  "bar3D",
  "line3D",
  "scatter3D",
  "surface",
  "lines3D",
  "polygons3D",
  "map3D",
  "scatterGL",
  "linesGL",
  "flowGL",
  "graphGL",
]);

// Timeline/media options may introduce GL even when the initial series is 2D.
export function needsEChartsGL(option: unknown): boolean {
  if (!option || typeof option !== "object") return false;
  if (Array.isArray(option)) return option.some(needsEChartsGL);
  const value = option as Record<string, unknown>;
  if (
    ["globe", "geo3D", "grid3D", "mapbox3D", "maptalks3D", "xAxis3D", "yAxis3D", "zAxis3D"].some(
      (key) => value[key] != null,
    )
  )
    return true;
  const series = Array.isArray(value.series) ? value.series : [value.series];
  if (series.some((item) => item && GL_SERIES.has(item.type))) return true;
  return (
    needsEChartsGL(value.baseOption) ||
    needsEChartsGL(value.options) ||
    (Array.isArray(value.media) && value.media.some((item) => needsEChartsGL(item?.option)))
  );
}

let loading: Promise<unknown> | undefined;
export async function ensureEChartsExtensions(option: unknown) {
  if (!needsEChartsGL(option)) return;
  await (loading ??= import("echarts-gl").catch((error) => {
    loading = undefined;
    throw error;
  }));
}
