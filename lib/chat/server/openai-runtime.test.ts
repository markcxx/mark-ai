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
