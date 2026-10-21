import { beforeEach, expect, it, vi } from "vitest";
import { createOpenAICompatibleStream } from "./openai-runtime";
import { ChartValidationLimitError } from "./chart-validation";
import { fetchWithDevelopmentProxy } from "@/lib/server/development-proxy";
import { executeBuiltinTool } from "@/lib/tools/executors";

vi.mock("@/lib/server/development-proxy", () => ({ fetchWithDevelopmentProxy: vi.fn() }));
vi.mock("@/lib/tools/executors", () => ({ executeBuiltinTool: vi.fn() }));
const upstream = (delta: object) =>
  new Response(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\ndata: [DONE]\n\n`);
const call = () =>
  upstream({
    tool_calls: [
      {
        index: 0,
        id: "chart-1",
        type: "function",
        function: { name: "render_echarts_chart", arguments: '{"option":{"series":[]}}' },
      },
    ],
  });
const run = () =>
  createOpenAICompatibleStream(
    [{ role: "user", content: "画图" }],
    "test-model",
    "test-key",
    "https://chart.test.invalid/v1",
    false,
    undefined,
    undefined,
    undefined,
    { enabledToolIds: ["data-visualization"], sessionId: "test", userId: "test" },
  );
beforeEach(() => vi.resetAllMocks());
it("feeds chart errors back through normal chat and emits validated content for persistence", async () => {
  const output = '\n```echarts\n{"series":[{"type":"pie","data":[18]}]}\n```\n';
  vi.mocked(fetchWithDevelopmentProxy)
    .mockResolvedValueOnce(call())
    .mockResolvedValueOnce(call())
    .mockResolvedValueOnce(upstream({ content: "图表结论" }));
  vi.mocked(executeBuiltinTool)
    .mockRejectedValueOnce(new Error("$.series 不能为空，请重新提交完整图表"))
    .mockResolvedValueOnce({ content: { success: true }, output });
  const text = await (await run()).text();
  expect(text).toContain("echarts");
  expect(text).toContain("图表结论");
  const request = JSON.parse(String(vi.mocked(fetchWithDevelopmentProxy).mock.calls[1][1]?.body));
  expect(request.messages.at(-1)).toMatchObject({
    role: "tool",
    content: expect.stringContaining("$.series"),
  });
  expect(executeBuiltinTool).toHaveBeenCalledTimes(2);
});
it("stops normal chat after the chart executor exhausts repair attempts", async () => {
  vi.mocked(fetchWithDevelopmentProxy).mockImplementation(async () => call());
  vi.mocked(executeBuiltinTool)
    .mockRejectedValueOnce(new Error("首次失败"))
    .mockRejectedValueOnce(new Error("再次失败"))
    .mockRejectedValueOnce(new ChartValidationLimitError("图表连续三次未通过校验，已停止自动修正"));
  const text = await (await run()).text();
  expect(text).toContain("已停止自动修正");
  expect(text).toContain('"type":"error"');
  expect(fetchWithDevelopmentProxy).toHaveBeenCalledTimes(3);
});
