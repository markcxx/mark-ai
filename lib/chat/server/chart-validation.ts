import { parseEChartsOption } from "@/lib/visualization/echarts-option";
import { needsEChartsGL } from "@/lib/visualization/echarts-gl";

export async function validateChartSource(source: string) {
  const parsed = parseEChartsOption(source);
  if (!parsed.ok) return parsed;
  if (needsEChartsGL(parsed.option)) return { ...parsed, validation: "structure" as const };

  const { init } = await import("echarts");
  const chart = init(null, undefined, { renderer: "svg", ssr: true, width: 720, height: 400 });
  try {
    chart.setOption({ ...parsed.option, animation: false });
    chart.renderToSVGString();
    return { ...parsed, validation: "render" as const };
  } catch (error) {
    return {
      ok: false as const,
      error: `ECharts 渲染校验失败：${error instanceof Error ? error.message : "配置无法渲染"}`,
    };
  } finally {
    chart.dispose();
  }
}

export const chartRepairFeedback = (error: string) =>
  `图表未通过校验，尚未展示。错误：${error}\n请保留原数据，只修正配置结构，并再次提交完整图表。不要解释错误，不要重复无效配置；禁止 JavaScript、函数、注释和省略号。`;

export class ChartValidationLimitError extends Error {}
