import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { createGeminiStream } from "./gemini-runtime";
import { readWebpage } from "../../search/webpage";

const mocks = vi.hoisted(() => ({ stream: vi.fn(), generate: vi.fn() }));
vi.mock("@google/genai", () => ({
  FunctionCallingConfigMode: { ANY: "ANY" },
  GoogleGenAI: class {
    models = { generateContentStream: mocks.stream, generateContent: mocks.generate };
  },
}));
vi.mock("../../search/webpage", () => ({ readWebpage: vi.fn() }));
vi.mock("../../tools/executors", () => ({ executeBuiltinTool: vi.fn() }));
const url = "https://example.com/article";
const imageUrl = "https://cdn.example.com/body.jpg";

beforeEach(() => vi.clearAllMocks());
it("streams shared web tools and preserves native function results without duplicating final text", async () => {
  vi.mocked(readWebpage).mockResolvedValue({
    url,
    title: "文章",
    content: "正文限制为 37。",
    costTime: 1,
    images: [{ title: "正文配图", url: imageUrl, sourceUrl: url }],
  });
  const imageId = `img_${createHash("sha256").update(imageUrl).digest("hex").slice(0, 16)}`;
  for (const [name, args] of [
    ["read_webpage", { url }],
    ["find_in_page", { url, pattern: "限制" }],
    ["show_images", { image_ids: [imageId] }],
  ] as const) {
    mocks.stream.mockImplementationOnce(async function* () {
      yield {
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                { functionCall: { id: name, name, args }, thoughtSignature: "signed-native-part" },
              ],
            },
          },
        ],
      };
    });
  }
  mocks.stream.mockImplementationOnce(async function* () {
    yield { candidates: [{ content: { parts: [{ text: "限制为 37。[1]" }] } }] };
  });
  const response = await createGeminiStream({
    apiKey: "fixture",
    model: "gemini-test",
    messages: [{ role: "user", content: url }],
    systemPrompt: "根据正文回答",
    webSearchEnabled: true,
  });
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(events.filter((event) => event.type === "content")).toEqual([
    { type: "content", text: "限制为 37。[1]" },
  ]);
  expect(
    events
      .filter((event) => event.webSearch?.status === "done")
      .map((event) => event.webSearch.tool),
  ).toEqual(["read_webpage", "find_in_page", "show_images"]);
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(readWebpage).toHaveBeenCalledTimes(1);
  const second = mocks.stream.mock.calls[1][0];
  expect(
    second.contents.some((message: any) =>
      message.parts.some((part: any) => part.thoughtSignature === "signed-native-part"),
    ),
  ).toBe(true);
  expect(
    second.contents.some((message: any) =>
      message.parts.some((part: any) => part.functionResponse?.response.content_kind === "page"),
    ),
  ).toBe(true);
});

it("keeps native Gemini tools available beyond eight rounds and explicitly completes", async () => {
  for (let round = 0; round < 10; round++) {
    mocks.stream.mockImplementationOnce(async function* () {
      yield {
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                { functionCall: { id: `read-${round}`, name: "read_webpage", args: { url } } },
              ],
            },
          },
        ],
      };
    });
  }
  mocks.stream.mockImplementationOnce(async function* () {
    yield { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "核验完成" }] } }] };
  });
  const response = await createGeminiStream({
    apiKey: "fixture",
    model: "gemini-test",
    messages: [{ role: "user", content: url }],
    systemPrompt: "核验",
    webSearchEnabled: true,
  });
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(mocks.stream).toHaveBeenCalledTimes(11);
  expect(mocks.stream.mock.calls[10][0].config.tools).toHaveLength(1);
  expect(events.at(-1)).toMatchObject({ type: "complete" });
});

it.each([undefined, "MAX_TOKENS"])(
  "does not complete an empty or truncated Gemini answer (%s)",
  async (finishReason) => {
    mocks.stream.mockImplementationOnce(async function* () {
      yield {
        candidates: [
          { finishReason, content: { parts: finishReason ? [{ text: "未完成的结果" }] : [] } },
        ],
      };
    });
    const response = await createGeminiStream({
      apiKey: "fixture",
      model: "gemini-test",
      messages: [{ role: "user", content: url }],
      systemPrompt: "核验",
      webSearchEnabled: true,
    });
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events.at(-1)).toMatchObject({ type: "error" });
    expect(events.some((event) => event.type === "complete")).toBe(false);
  },
);

it.each([false, true])(
  "delivers Gemini thoughts before generation finishes (builtin tools: %s)",
  async (withTools) => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    mocks.stream.mockImplementationOnce(async function* () {
      yield { candidates: [{ content: { parts: [{ thought: true, text: "正在分析问题" }] } }] };
      await gate;
      yield { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "完成回答" }] } }] };
    });
    const response = await createGeminiStream({
      apiKey: "fixture",
      model: "gemini-test",
      messages: [{ role: "user", content: "测试" }],
      systemPrompt: "回答",
      ...(withTools
        ? { toolRuntime: { enabledToolIds: ["calculator"], sessionId: "s", userId: "u" } }
        : {}),
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let received = "";
    while (!received.includes("正在分析问题")) {
      const chunk = await reader.read();
      expect(chunk.done).toBe(false);
      received += decoder.decode(chunk.value);
    }
    expect(received).toContain('"type":"reasoning"');
    expect(received).not.toContain("完成回答");
    expect(mocks.stream.mock.calls.at(-1)?.[0].config.thinkingConfig.includeThoughts).toBe(true);
    expect(mocks.generate).not.toHaveBeenCalled();
    finish();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += decoder.decode(chunk.value);
    }
    expect(received).toContain("完成回答");
  },
);

it("does not send thinking-only options to a model known not to support reasoning", async () => {
  mocks.stream.mockImplementationOnce(async function* () {
    yield { text: "普通回复" };
  });
  const response = await createGeminiStream({
    apiKey: "fixture",
    model: "legacy",
    includeThoughts: false,
    messages: [{ role: "user", content: "你好" }],
    systemPrompt: "回答",
  });
  expect(await response.text()).toContain("普通回复");
  expect(mocks.stream.mock.calls.at(-1)?.[0].config.thinkingConfig).toBeUndefined();
});
