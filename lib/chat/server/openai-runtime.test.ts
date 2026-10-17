import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOpenAICompatibleStream } from "./openai-runtime";
import { fetchWithDevelopmentProxy } from "@/lib/server/development-proxy";
import { getThinkingPolicy } from "@/lib/model-thinking";

vi.mock("@/lib/server/development-proxy", () => ({ fetchWithDevelopmentProxy: vi.fn() }));
vi.mock("@/lib/search/tavily", () => ({
  searchTavily: vi.fn(async () => ({ results: [], query: "test" })),
}));
vi.mock("@/lib/search/webpage", () => ({ readWebpage: vi.fn() }));
vi.mock("@/lib/tools/executors", () => ({ executeBuiltinTool: vi.fn() }));
vi.mock("@/lib/tools/registry", () => ({
  getBuiltinToolByFunction: vi.fn(),
  getToolFunctions: () => [],
}));
const upstream = (delta: object) =>
  new Response(`data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\n\ndata: [DONE]\n\n`, {
    headers: { "Content-Type": "text/event-stream" },
  });

describe("thinking mode with search continuation", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([true, false])(
    "keeps the selected mode through every upstream request (%s)",
    async (enabled) => {
      vi.mocked(fetchWithDevelopmentProxy)
        .mockResolvedValueOnce(
          upstream({
            reasoning_content: "先查证",
            tool_calls: [
              {
                index: 0,
                id: "search-1",
                type: "function",
                function: { name: "web_search", arguments: '{"query":"test"}' },
              },
            ],
          }),
        )
        .mockResolvedValueOnce(upstream({ content: "最终回答" }));
      const policy = getThinkingPolicy({
        id: "kimi-k2.5",
        provider: "moonshot",
        runtime: "openai-compatible",
      });
      const response = await createOpenAICompatibleStream(
        [{ content: "查证", role: "user" }],
        "kimi-k2.5",
        "test-key",
        "https://test.invalid/v1",
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        { policy, enabled },
      );
      expect(await response.text()).toContain("最终回答");
      const calls = vi
        .mocked(fetchWithDevelopmentProxy)
        .mock.calls.map(([, init]) => JSON.parse(init!.body as string));
      expect(calls).toHaveLength(2);
      for (const call of calls) expect(call.thinking.type).toBe(enabled ? "enabled" : "disabled");
      const assistant = calls[1].messages.find((m: { role: string }) => m.role === "assistant");
      if (enabled) expect(assistant.reasoning_content).toBe("先查证");
      else expect(assistant).not.toHaveProperty("reasoning_content");
      expect(calls[1].messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "search-1" });
    },
  );
});

it("sends a structured error instead of breaking the stream on upstream 503", async () => {
  vi.mocked(fetchWithDevelopmentProxy).mockResolvedValueOnce(
    new Response(
      JSON.stringify([
        { error: { code: 503, message: "This model is currently experiencing high demand." } },
      ]),
      { status: 503 },
    ),
  );
  const response = await createOpenAICompatibleStream(
    [{ role: "user", content: "你好" }],
    "gemini-3.8-flash",
    "secret",
    "https://test.invalid/v1",
    false,
  );
  const event = JSON.parse((await response.text()).trim());
  expect(event.type).toBe("error");
  expect(event.text).toContain("503");
  expect(event.text).toContain("This model is currently experiencing high demand.");
});

it("preserves partial text then emits an SSE error", async () => {
  vi.mocked(fetchWithDevelopmentProxy).mockResolvedValueOnce(
    new Response(
      'data: {"choices":[{"delta":{"content":"部分正文"}}]}\n\ndata: {"error":{"code":429,"message":"rate limit exceeded"}}\n\n',
    ),
  );
  const response = await createOpenAICompatibleStream(
    [{ role: "user", content: "你好" }],
    "test",
    "secret",
    "https://test.invalid/v1",
    false,
  );
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(events[0]).toEqual({ type: "content", text: "部分正文" });
  expect(events.at(-1)).toEqual({ type: "error", text: expect.stringContaining("429") });
});

it("delivers the provider location restriction through the response stream", async () => {
  vi.mocked(fetchWithDevelopmentProxy).mockResolvedValueOnce(
    new Response(
      JSON.stringify([
        {
          error: {
            code: 400,
            message: "User location is not supported for the API use.",
            status: "FAILED_PRECONDITION",
          },
        },
      ]),
      { status: 400 },
    ),
  );
  const response = await createOpenAICompatibleStream(
    [{ role: "user", content: "你好" }],
    "gemini-3.8-flash",
    "secret",
    "https://test.invalid/v1",
    false,
  );
  expect(JSON.parse((await response.text()).trim())).toEqual({
    type: "error",
    text: "生成失败：User location is not supported for the API use.（400）",
  });
});
