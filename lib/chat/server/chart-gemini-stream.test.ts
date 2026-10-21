import { beforeEach, expect, it, vi } from "vitest";
import { runChartTest } from "./chart-test";
import { executeBuiltinTool } from "@/lib/tools/executors";
const mocks = vi.hoisted(() => ({ generateContentStream: vi.fn(), generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  FunctionCallingConfigMode: { ANY: "ANY" },
  GoogleGenAI: class {
    models = mocks;
  },
}));
vi.mock("@/lib/tools/executors", () => ({ executeBuiltinTool: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it("streams native Gemini thoughts and text, preserves thought signatures and emits chart validation details", async () => {
  mocks.generateContentStream
    .mockImplementationOnce(async function* () {
      yield { candidates: [{ content: { parts: [{ text: "选择合适图表", thought: true }] } }] };
      yield {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    id: "call-1",
                    name: "render_echarts_chart",
                    args: { option: { series: [] } },
                  },
                  thoughtSignature: "native-signature",
                },
              ],
            },
          },
        ],
      };
    })
    .mockImplementationOnce(async function* () {
      yield { candidates: [{ content: { parts: [{ text: "结果结论" }] } }] };
    });
  vi.mocked(executeBuiltinTool).mockResolvedValue({
    content: { success: true, validation: "render" },
    output: "```echarts\n{}\n```",
  });
  const response = await runChartTest({
    model: { id: "gemini-test", provider: "gemini", runtime: "gemini", apiKey: "test" },
    prompt: "画图",
    signal: new AbortController().signal,
  });
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(events).toContainEqual({ type: "reasoning", text: "选择合适图表" });
  expect(
    events.filter((event) => event.type === "content" && event.text === "结果结论"),
  ).toHaveLength(1);
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "attempt",
      raw: expect.stringContaining('"option"'),
      validation: "render",
    }),
  );
  expect(mocks.generateContent).not.toHaveBeenCalled();
  expect(mocks.generateContentStream.mock.calls[1][0].contents).toContainEqual(
    expect.objectContaining({
      role: "model",
      parts: expect.arrayContaining([
        expect.objectContaining({ thoughtSignature: "native-signature" }),
      ]),
    }),
  );
});
