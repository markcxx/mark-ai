import { describe, expect, it, vi } from "vitest";
const loaded = vi.hoisted(() => vi.fn());
vi.mock("echarts-gl", () => {
  loaded();
  return {};
});
import { ensureEChartsExtensions, needsEChartsGL } from "./echarts-gl";

describe("ECharts GL loading", () => {
  it("skips ordinary 2D series and loads GL once when required", async () => {
    await ensureEChartsExtensions({ series: [{ type: "bar" }, { type: "line" }] });
    expect(loaded).not.toHaveBeenCalled();
    await Promise.all([
      ensureEChartsExtensions({ series: { type: "surface" } }),
      ensureEChartsExtensions({ series: [{ type: "scatterGL" }] }),
    ]);
    expect(loaded).toHaveBeenCalledTimes(1);
  });
  it("checks GL coordinates and timeline/media alternatives", () => {
    expect(needsEChartsGL({ globe: {} })).toBe(true);
    expect(needsEChartsGL({ options: [{ series: [{ type: "bar3D" }] }] })).toBe(true);
    expect(needsEChartsGL({ media: [{ option: { geo3D: {} } }] })).toBe(true);
    expect(needsEChartsGL({ title: { text: "surface" }, series: { type: "pie" } })).toBe(false);
  });
});
