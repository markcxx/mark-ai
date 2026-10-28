import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithDevelopmentProxy } from "@/lib/server/development-proxy";
import { executeBuiltinTool } from "@/lib/tools/executors";
import { createAnthropicStream, generateAnthropicText } from "./anthropic-runtime";
import { createAnthropicTransport, toAnthropicMessagesEndpoint } from "./anthropic-transport";
vi.mock("@/lib/server/development-proxy", () => ({ fetchWithDevelopmentProxy: vi.fn() }));
vi.mock("@/lib/tools/executors", () => ({ executeBuiltinTool: vi.fn() }));
const frame = (event: object) => `event: event\r\ndata: ${JSON.stringify(event)}\r\n\r\n`;
const message = (blocks: object[]) => [
  {
    type: "message_start",
    message: { usage: { input_tokens: 12, cache_read_input_tokens: 5, output_tokens: 0 } },
  },
  ...blocks,
  { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 3 } },
  { type: "message_stop" },
];
const text = (value: string) => [
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: value } },
  { type: "content_block_stop", index: 0 },
];
const chart = (id: string) => [
  {
    type: "content_block_start",
    index: 0,
    content_block: { type: "thinking", thinking: "", signature: "" },
  },
  {
    type: "content_block_delta",
    index: 0,
    delta: { type: "thinking_delta", thinking: "先分析数据" },
  },
  {
    type: "content_block_delta",
    index: 0,
    delta: { type: "signature_delta", signature: "signed-original" },
  },
  { type: "content_block_stop", index: 0 },
  {
    type: "content_block_start",
    index: 1,
    content_block: { type: "tool_use", id, name: "render_echarts_chart", input: {} },
  },
  {
    type: "content_block_delta",
    index: 1,
    delta: { type: "input_json_delta", partial_json: '{"option":' },
  },
  {
    type: "content_block_delta",
    index: 1,
    delta: { type: "input_json_delta", partial_json: '{"series":[]}}' },
  },
  { type: "content_block_stop", index: 1 },
];
const upstream = (events: object[]) => {
  const bytes = new TextEncoder().encode(events.map(frame).join(""));
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
};
const run = (signal?: AbortSignal) =>
  createAnthropicStream(
    [
      {
        role: "user",
        content: "画图",
        imageInputs: [{ data: "aGVsbG8=", mediaType: "image/png", name: "image" }],
      },
    ],
    "claude-haiku-5-5",
    "test-secret-key",
    "https://api.commandcode.ai/provider/v1",
    false,
    undefined,
    signal,
    undefined,
    {
      enabledToolIds: ["data-visualization"],
      sessionId: "test",
      userId: "test",
      debugChartAttempts: true,
    },
  );
beforeEach(() => vi.resetAllMocks());
describe("Anthropic Messages integration", () => {
  it("normalizes endpoint forms without appending chat/completions", () => {
    expect(toAnthropicMessagesEndpoint()).toBe("https://api.anthropic.com/v1/messages");
    expect(toAnthropicMessagesEndpoint("https://api.anthropic.com")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
    expect(
      toAnthropicMessagesEndpoint("https://api.commandcode.ai/provider/v1/chat/completions/"),
    ).toBe("https://api.commandcode.ai/provider/v1/messages");
    expect(toAnthropicMessagesEndpoint("https://custom.example/v1/messages")).toBe(
      "https://custom.example/v1/messages",
    );
  });
  it("streams thinking, validates tools, feeds back errors and preserves signed blocks across continuation", async () => {
    vi.mocked(fetchWithDevelopmentProxy)
      .mockResolvedValueOnce(upstream(message(chart("call-1"))))
      .mockResolvedValueOnce(upstream(message(chart("call-2"))))
      .mockResolvedValueOnce(upstream(message(text("修正完成"))));
    vi.mocked(executeBuiltinTool)
      .mockRejectedValueOnce(new Error("$.series 不能为空"))
      .mockResolvedValueOnce({
        content: { success: true, validation: "render" },
        output: "```echarts\n{}\n```",
      });
    const output = await (await run()).text();
    const events = output
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events).toContainEqual({ type: "reasoning", text: "先分析数据" });
    expect(events).toContainEqual({ type: "content", text: "修正完成" });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "attempt", index: 1, error: "$.series 不能为空" }),
    );
    expect(output).toContain("echarts");
    expect(events).toContainEqual(
      expect.objectContaining({ type: "usage", inputTokens: 17, outputTokens: 3 }),
    );
    expect(events.at(-1)).toMatchObject({ type: "complete" });
    const calls = vi.mocked(fetchWithDevelopmentProxy).mock.calls;
    expect(calls[0][0]).toBe("https://api.commandcode.ai/provider/v1/messages");
    const headers = new Headers(calls[0][1]?.headers);
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    expect(headers.get("x-api-key")).toBe("test-secret-key");
    const first = JSON.parse(String(calls[0][1]?.body));
    expect(first.system).toEqual(expect.any(Array));
    expect(first.messages.every((m: any) => m.role !== "system")).toBe(true);
    expect(first.messages[0].content).toContainEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "aGVsbG8=" },
    });
    expect(first.tools[0]).toMatchObject({
      name: "render_echarts_chart",
      input_schema: expect.any(Object),
    });
    expect(first.stream_options).toBeUndefined();
    const second = JSON.parse(String(calls[1][1]?.body));
    expect(second.messages.at(-2).content[0]).toEqual({
      type: "thinking",
      thinking: "先分析数据",
      signature: "signed-original",
    });
    expect(second.messages.at(-1)).toMatchObject({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "call-1",
          is_error: true,
          content: expect.stringContaining("$.series"),
        },
      ],
    });
    expect(executeBuiltinTool).toHaveBeenCalledTimes(2);
  });
  it("retains partial text and reports a premature stream ending", async () => {
    vi.mocked(fetchWithDevelopmentProxy).mockResolvedValue(
      upstream(message(text("部分输出")).slice(0, -2)),
    );
    const output = await (await run()).text();
    expect(output).toContain("部分输出");
    expect(output).toContain("未收到 message_stop");
    expect(executeBuiltinTool).not.toHaveBeenCalled();
  });
  it("retains streamed text when the provider reports an error", async () => {
    vi.mocked(fetchWithDevelopmentProxy).mockResolvedValue(
      upstream([
        ...text("已生成的内容"),
        { type: "error", error: { type: "overloaded_error", message: "upstream overloaded" } },
        { type: "message_stop" },
      ]),
    );
    const response = await createAnthropicTransport({ apiKey: "key" })("unused", {
      body: JSON.stringify({ model: "claude-test", messages: [{ role: "user", content: "hi" }] }),
    });
    const output = await response.text();
    expect(output).toContain("已生成的内容");
    expect(output).toContain("overloaded_error");
    expect(output).not.toContain("[DONE]");
    expect(output).not.toContain("未收到 message_stop");
    const headers = new Headers(vi.mocked(fetchWithDevelopmentProxy).mock.calls[0][1]?.headers);
    expect(headers.get("x-api-key")).toBe("key");
    expect(headers.has("authorization")).toBe(false);
  });
  it("preserves raw HTTP errors and redacts the configured credential", async () => {
    vi.mocked(fetchWithDevelopmentProxy).mockResolvedValue(
      new Response('{"error":{"message":"denied test-secret-key","type":"permission_error"}}', {
        status: 403,
      }),
    );
    const output = await (await run()).text();
    expect(output).toContain("HTTP 403");
    expect(output).toContain("permission_error");
    expect(output).not.toContain("test-secret-key");
    expect(fetchWithDevelopmentProxy).toHaveBeenCalledTimes(1);
  });
  it("propagates the abort signal and cancellation to the upstream reader", async () => {
    const cancel = vi.fn();
    vi.mocked(fetchWithDevelopmentProxy).mockResolvedValue(
      new Response(new ReadableStream({ cancel })),
    );
    const abort = new AbortController();
    const response = await createAnthropicTransport({ apiKey: "key" })("unused", {
      body: JSON.stringify({ model: "claude-test", messages: [{ role: "user", content: "hi" }] }),
      signal: abort.signal,
    });
    await response.body!.cancel();
    expect(cancel).toHaveBeenCalled();
    expect(vi.mocked(fetchWithDevelopmentProxy).mock.calls[0][1]?.signal).toBe(abort.signal);
  });
  it("supports non-streaming text calls for translation and titles", async () => {
    vi.mocked(fetchWithDevelopmentProxy).mockResolvedValue(
      Response.json({
        content: [
          { type: "thinking", thinking: "private" },
          { type: "text", text: "<translation>译文</translation>" },
        ],
        stop_reason: "end_turn",
      }),
    );
    const output = await generateAnthropicText(
      {
        id: "claude-haiku-5-5",
        provider: "markcode",
        runtime: "anthropic",
        apiKey: "key",
        baseUrl: "https://api.commandcode.ai/provider/v1",
      },
      [
        { role: "system", content: "translate" },
        { role: "user", content: "hello" },
      ],
      65536,
    );
    expect(output).toBe("<translation>译文</translation>");
    const request = JSON.parse(String(vi.mocked(fetchWithDevelopmentProxy).mock.calls[0][1]?.body));
    expect(request.stream).toBe(false);
    expect(request.max_tokens).toBe(65536);
  });
});
