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
