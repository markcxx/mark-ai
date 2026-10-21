import { describe, expect, it } from "vitest";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { layoutEChartsOption } from "./echarts-layout";

const months = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
const names = ["销售额（万元）", "去年同期销售额（万元）", "利润（万元）"];
const option: EChartsOption = {
  legend: { bottom: 0 },
  grid: { left: 50, right: 50, top: 50, bottom: 24 },
  xAxis: { type: "category", data: months, axisLabel: { interval: 0 } },
  yAxis: [{ type: "value" }, { type: "value" }],
  series: names.map((name, index) => ({
    name,
    type: index === 2 ? "line" : "bar",
    yAxisIndex: index === 2 ? 1 : 0,
    data: months.map((_, month) => month * 3 + 20),
  })),
};

describe("bottom legend layout", () => {
  it.each([820, 390])("keeps actual rendered month labels above the legend at %ipx", (width) => {
    const chart = echarts.init(null, undefined, { renderer: "svg", ssr: true, width, height: 360 });
    try {
      chart.setOption(layoutEChartsOption(option, width, 360));
      chart.renderToSVGString();
      const elements = chart.getZr().storage.getDisplayList(true);
      const textBounds = (text: string) =>
        elements.flatMap((element) => {
          if (element.type !== "tspan" || (element as any).style.text !== text) return [];
          const rect = element.getBoundingRect().clone();
          const transform = element.getComputedTransform();
          if (transform) rect.applyTransform(transform);
          return [rect];
        });
      const axes = months.flatMap(textBounds);
      const legends = names.flatMap(textBounds);
      expect(axes).toHaveLength(12);
      expect(legends.length).toBeGreaterThan(0);
      expect(Math.max(...axes.map((rect) => rect.y + rect.height)) + 8).toBeLessThan(
        Math.min(...legends.map((rect) => rect.y)),
      );
      expect(Math.max(...legends.map((rect) => rect.y + rect.height))).toBeLessThanOrEqual(360);
    } finally {
      chart.dispose();
    }
  });

  it("recomputes percentage spacing without mutating the generated configuration", () => {
    const source = {
      ...option,
      legend: { bottom: "5%" },
      grid: { top: 40, height: "90%", bottom: 0 },
    };
    const before = JSON.stringify(source);
    const result = layoutEChartsOption(source, 390, 400) as any;
    expect(result.legend[0].bottom).toBe(20);
    expect(result.grid[0].bottom).toBeGreaterThan(50);
    expect(result.grid[0].height + 40 + result.grid[0].bottom).toBeLessThanOrEqual(400);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("preserves hidden, top, side legends and non-Cartesian charts", () => {
    for (const legend of [
      { show: false },
      { top: 12 },
      { orient: "vertical" as const, right: 0 },
    ]) {
      const source = { ...option, legend };
      expect(layoutEChartsOption(source, 820, 360)).toBe(source);
    }
    const pie: EChartsOption = { legend: { bottom: 0 }, series: [{ type: "pie", data: [] }] };
    expect(layoutEChartsOption(pie, 390, 360)).toBe(pie);
  });
});
