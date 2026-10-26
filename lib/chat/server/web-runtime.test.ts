import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { createOpenAICompatibleStream } from "./openai-runtime";
import { createAnthropicStream } from "./anthropic-runtime";
import { fetchWithDevelopmentProxy } from "../../server/development-proxy";
import { readWebpage } from "../../search/webpage";
import { searchTavily } from "../../search/tavily";

vi.mock("../../server/development-proxy", () => ({ fetchWithDevelopmentProxy: vi.fn() }));
vi.mock("../../search/webpage", () => ({ readWebpage: vi.fn() }));
vi.mock("../../search/tavily", () => ({ searchTavily: vi.fn() }));
vi.mock("../../tools/executors", () => ({ executeBuiltinTool: vi.fn() }));
const url = "https://example.com/article";
const imageUrl = "https://cdn.example.com/body.jpg";
const imageId = `img_${createHash("sha256").update(imageUrl).digest("hex").slice(0, 16)}`;
type Kind = "openai" | "anthropic";

const upstream = (kind: Kind, name?: string, args = {}) => {
  if (kind === "openai")
    return new Response(
      `data: ${JSON.stringify({ choices: [{ delta: name ? { tool_calls: [{ index: 0, id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] } : { content: "正文证据：限制为 37。[1]" } }] })}\n\ndata: [DONE]\n\n`,
    );
  const blocks = name
    ? [
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "tool_use", id: name, name, input: {} },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "input_json_delta", partial_json: JSON.stringify(args) },
        },
      ]
    : [
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "正文证据：限制为 37。[1]" },
        },
      ];
  const events = [
    { type: "message_start", message: { usage: { input_tokens: 10, output_tokens: 0 } } },
    ...blocks,
    { type: "content_block_stop", index: 0 },
    {
      type: "message_delta",
      delta: { stop_reason: name ? "tool_use" : "end_turn" },
      usage: { output_tokens: 5 },
    },
    { type: "message_stop" },
  ];
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readWebpage).mockResolvedValue({
    url,
    title: "文章",
    costTime: 1,
    content: Array.from({ length: 300 }, (_, i) => (i === 250 ? "限制为 37" : "正文段落")).join(
      "\n",
    ),
    images: [{ title: "文章配图", url: imageUrl, sourceUrl: url }],
  });
  vi.mocked(searchTavily).mockResolvedValue({
    query: "事实",
    costTime: 1,
    resultNumbers: 1,
    results: [{ title: "来源", url, content: "事实摘要" }],
  });
});

it.each<Kind>(["openai", "anthropic"])(
  "%s carries reading, finding and selected images through the complete tool loop",
  async (kind) => {
    vi.mocked(fetchWithDevelopmentProxy)
      .mockResolvedValueOnce(upstream(kind, "read_webpage", { url }))
      .mockResolvedValueOnce(upstream(kind, "find_in_page", { url, pattern: "限制" }))
      .mockResolvedValueOnce(upstream(kind, "show_images", { image_ids: [imageId] }))
      .mockResolvedValueOnce(upstream(kind));
    const run = kind === "openai" ? createOpenAICompatibleStream : createAnthropicStream;
    const response = await run(
      [{ role: "user", content: `阅读 ${url}，查找限制并展示正文图片` }],
      "test-model",
      "fixture-key",
      "https://model.example.com/v1",
      true,
    );
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(
      events
        .filter((event) => event.type === "tool" && event.webSearch.status === "done")
        .map((event) => event.webSearch.tool),
    ).toEqual(["read_webpage", "find_in_page", "show_images"]);
    expect(
      events.find(
        (event) => event.webSearch?.tool === "find_in_page" && event.webSearch.status === "done",
      ).webSearch.content,
    ).toContain("限制为 37");
    expect(
      events.find(
        (event) => event.webSearch?.tool === "show_images" && event.webSearch.status === "done",
      ).webSearch.images[0],
    ).toMatchObject({ id: imageId, sourceUrl: url });
    expect(events).toContainEqual({ type: "content", text: "正文证据：限制为 37。[1]" });
    expect(readWebpage).toHaveBeenCalledTimes(1);
    expect(searchTavily).not.toHaveBeenCalled();
  },
);

it("allows a simple fact to finish after search without forcing unrelated reads", async () => {
  vi.mocked(fetchWithDevelopmentProxy)
    .mockResolvedValueOnce(upstream("openai", "web_search", { query: "事实" }))
    .mockResolvedValueOnce(upstream("openai"));
  await (
    await createOpenAICompatibleStream(
      [{ role: "user", content: "查询一个简单事实" }],
      "test",
      "fixture",
      "https://model.example.com/v1",
      true,
    )
  ).text();
  expect(readWebpage).not.toHaveBeenCalled();
  const second = JSON.parse(String(vi.mocked(fetchWithDevelopmentProxy).mock.calls[1][1]?.body));
  expect(JSON.parse(second.messages.at(-1).content)).toMatchObject({
    content_kind: "search_snippets",
    untrusted_external_content: true,
  });
});

it("does not expose or execute browsing tools when web access is off", async () => {
  vi.mocked(fetchWithDevelopmentProxy).mockResolvedValueOnce(
    upstream("openai", "read_webpage", { url }),
  );
  await (
    await createOpenAICompatibleStream(
      [{ role: "user", content: url }],
      "test",
      "fixture",
      "https://model.example.com/v1",
      false,
    )
  ).text();
  expect(readWebpage).not.toHaveBeenCalled();
  expect(
    JSON.parse(String(vi.mocked(fetchWithDevelopmentProxy).mock.calls[0][1]?.body)).tools,
  ).toBeUndefined();
});
