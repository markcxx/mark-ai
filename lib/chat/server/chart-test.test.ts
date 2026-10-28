import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithDevelopmentProxy } from "@/lib/server/development-proxy";
import { runChartTest } from "./chart-test";
import { validateChartSource } from "./chart-validation";
import { parseEChartsOption } from "@/lib/visualization/echarts-option";
import type { ConfiguredModel } from "@/lib/models";
vi.mock("@/lib/server/development-proxy", () => ({ fetchWithDevelopmentProxy: vi.fn() }));
const model: ConfiguredModel = {
  id: "test-model",
  provider: "test",
  apiKey: "test-key",
  baseUrl: "https://test.invalid/v1",
  runtime: "openai-compatible",
};
const valid = {
  xAxis: { type: "category", data: ["五月"] },
  yAxis: {},
  series: [{ type: "bar", data: [18] }],
};
const packet = (delta: object) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
const upstream = (delta: object) => new Response(packet(delta) + "data: [DONE]\n\n");
const reply = (option: unknown) =>
  upstream({
    tool_calls: [
      {
        index: 0,
        id: "chart-1",
        type: "function",
        function: { name: "render_echarts_chart", arguments: JSON.stringify({ option }) },
      },
    ],
  });
const run = () => runChartTest({ model, prompt: "画图", signal: new AbortController().signal });
beforeEach(() => vi.resetAllMocks());
describe("chart validation", () => {
  it("accepts a single series object and renders it", async () => {
    const result = await validateChartSource(JSON.stringify({ ...valid, series: valid.series[0] }));
    expect(result).toMatchObject({ ok: true, validation: "render" });
    if (result.ok) expect(Array.isArray(result.option.series)).toBe(true);
  });
  it("reports missing coordinates and invalid data with field paths", () => {
    expect(parseEChartsOption(JSON.stringify({ series: valid.series }))).toMatchObject({
      ok: false,
      error: expect.stringContaining("$.xAxis"),
    });
    expect(
      parseEChartsOption(JSON.stringify({ series: [{ type: "pie", data: "bad" }] })),
    ).toMatchObject({ ok: false, error: expect.stringContaining("$.series[0].data") });
  });
  it("rejects executable/custom code, invalid JSON and oversized input", () => {
    expect(parseEChartsOption('{"series":[{"type":"custom"}]}').ok).toBe(false);
    expect(parseEChartsOption("option = { series: [] }").ok).toBe(false);
    expect(parseEChartsOption(" ".repeat(160_001) + JSON.stringify(valid)).ok).toBe(true);
    expect(parseEChartsOption("x".repeat(160_001)).ok).toBe(false);
  });
  it("rejects a chart with neither data nor dataset instead of showing an empty result", () => {
    expect(parseEChartsOption(JSON.stringify({ series: [{ type: "pie" }] }))).toMatchObject({
      ok: false,
      error: expect.stringContaining(".data 缺失"),
    });
  });
  it("validates actual ECharts dependencies beyond JSON shape", async () => {
    const result = await validateChartSource(
      JSON.stringify({ ...valid, series: [{ type: "bar", xAxisIndex: 9, data: [18] }] }),
    );
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("渲染校验失败") });
  });
  it("does not claim WebGL rendered on the server", async () => {
    const result = await validateChartSource(
      JSON.stringify({
        grid3D: {},
        xAxis3D: {},
        yAxis3D: {},
        zAxis3D: {},
        series: [{ type: "bar3D", data: [[0, 0, 18]] }],
      }),
    );
    expect(result).toMatchObject({ ok: true, validation: "structure" });
  });
});

describe("normal streaming chart generation", () => {
  it("streams thinking before the model finishes, then renders a validated chart and continues its answer", async () => {
    const encoder = new TextEncoder();
    let upstreamController!: ReadableStreamDefaultController<Uint8Array>;
    vi.mocked(fetchWithDevelopmentProxy)
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              upstreamController = controller;
              controller.enqueue(encoder.encode(packet({ reasoning_content: "正在选择图表" })));
            },
          }),
        ),
      )
      .mockResolvedValueOnce(upstream({ content: "整理数量持续增长。" }));
    const response = await run();
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain('"type":"step"');
    const thinking = await reader.read();
    expect(new TextDecoder().decode(thinking.value)).toContain("正在选择图表");
    expect(fetchWithDevelopmentProxy).toHaveBeenCalledTimes(1);
    upstreamController.enqueue(
      encoder.encode(
        packet({
          tool_calls: [
            {
              index: 0,
              id: "chart-1",
              type: "function",
              function: {
                name: "render_echarts_chart",
                arguments: JSON.stringify({ option: valid }),
              },
            },
          ],
        }) + "data: [DONE]\n\n",
      ),
    );
    upstreamController.close();
    let rest = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      rest += new TextDecoder().decode(chunk.value);
    }
    const events = rest
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "file",
        generatedFile: expect.objectContaining({ status: "running" }),
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "attempt",
        index: 1,
        validation: "render",
        raw: expect.stringContaining('"option"'),
      }),
    );
    expect(events).toContainEqual({ type: "content", text: expect.stringContaining("echarts") });
    expect(rest).toContain("整理数量持续增长");
    const request = JSON.parse(String(vi.mocked(fetchWithDevelopmentProxy).mock.calls[0][1]?.body));
    expect(request.stream).toBe(true);
    expect(request.tools[0].function.name).toBe("render_echarts_chart");
  });
  it("retains failed attempts and feeds exact errors back through normal chat", async () => {
    vi.mocked(fetchWithDevelopmentProxy)
      .mockResolvedValueOnce(reply({ series: valid.series }))
      .mockResolvedValueOnce(reply(valid))
      .mockResolvedValueOnce(upstream({ content: "已修正" }));
    const text = await (await run()).text();
    const attempts = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .filter((event) => event.type === "attempt");
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({ error: expect.stringContaining("$.xAxis") });
    expect(attempts[1]).toMatchObject({ validation: "render" });
    const request = JSON.parse(String(vi.mocked(fetchWithDevelopmentProxy).mock.calls[1][1]?.body));
    expect(request.messages.at(-1)).toMatchObject({
      role: "tool",
      content: expect.stringContaining("$.xAxis"),
    });
  });
  it("stops after three failed chart validations", async () => {
    vi.mocked(fetchWithDevelopmentProxy).mockImplementation(async () => reply({ series: [] }));
    expect(await (await run()).text()).toContain("已停止自动修正");
    expect(fetchWithDevelopmentProxy).toHaveBeenCalledTimes(3);
  });
  it("returns the raw upstream error without quota reclassification or retries", async () => {
    vi.mocked(fetchWithDevelopmentProxy).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Invalid chart schema", request_id: "req-1" } }),
        { status: 400 },
      ),
    );
    const text = await (await run()).text();
    expect(text).toContain("Invalid chart schema");
    expect(text).toContain("req-1");
    expect(text).toContain("HTTP 400");
    expect(text).not.toContain("额度不足");
    expect(fetchWithDevelopmentProxy).toHaveBeenCalledTimes(1);
  });
});
