import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateConversationTitle } from "./title";
import { fetchWithDevelopmentProxy } from "../server/development-proxy";

vi.mock("../server/development-proxy", () => ({ fetchWithDevelopmentProxy: vi.fn() }));
vi.mock("./server/anthropic-runtime", () => ({ generateAnthropicText: vi.fn() }));
const messages = [
  {
    id: "user",
    role: "user" as const,
    content: "mac上如何快速把文件中的图片或视频保存到自己的帐户的相册中",
  },
];
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv(
    "AI_MODEL_CONFIGS",
    JSON.stringify([
      {
        provider: "markbailian_key1",
        id: "qwen3.8-flash",
        apiKey: "fixture-one",
        baseUrl: "https://first.example/v1",
      },
      {
        provider: "markbailian_key2",
        id: "qwen3.8-flash",
        apiKey: "fixture-two",
        baseUrl: "https://second.example/v1",
      },
    ]),
  );
  vi.stubEnv("MARKAI_CONVERSATION_TITLE_MODEL", "markbailian/qwen3.8-flash");
  vi.spyOn(Math, "random").mockReturnValue(0.999);
  vi.mocked(fetchWithDevelopmentProxy).mockResolvedValue(
    Response.json({ choices: [{ message: { content: "Mac照片快速导入相册" } }] }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("uses the specified provider group for titles when the same model has split credentials", async () => {
  const result = await generateConversationTitle(messages, "原始标题");
  expect(result).toMatchObject({
    title: "Mac照片快速导入相册",
    titleModel: {
      requested: "markbailian/qwen3.8-flash",
      provider: "markbailian_key2",
      model: "qwen3.8-flash",
      used: true,
      matchedBy: "provider-group",
    },
  });
  expect(fetchWithDevelopmentProxy).toHaveBeenCalledWith(
    "https://second.example/v1/chat/completions",
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer fixture-two" }),
    }),
  );
});
it("respects an explicit key route instead of switching to another credential", async () => {
  vi.stubEnv("MARKAI_CONVERSATION_TITLE_MODEL", "markbailian_key1/qwen3.8-flash");
  expect((await generateConversationTitle(messages)).titleModel).toMatchObject({
    provider: "markbailian_key1",
    used: true,
    matchedBy: "exact",
  });
});
it("reports the missing provider and available candidates when the reference is ambiguous", async () => {
  vi.stubEnv("MARKAI_CONVERSATION_TITLE_MODEL", "missing/qwen3.8-flash");
  const result = await generateConversationTitle(messages, "保留标题");
  expect(result.title).toBe("保留标题");
  expect(result.titleModel.used).toBe(false);
  expect(result.titleModel.reason).toContain("未找到标题模型线路「missing」");
  expect(result.titleModel.reason).toContain("markbailian_key1、markbailian_key2");
  expect(fetchWithDevelopmentProxy).not.toHaveBeenCalled();
});
