import { NextRequest, NextResponse } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  model: vi.fn(),
  session: vi.fn(),
  tools: vi.fn(),
  stream: vi.fn(),
  files: vi.fn(),
  metadata: vi.fn(),
}));
vi.mock("@/lib/api/security", () => ({
  authorizeApiRequest: mocks.auth,
  enforceRateLimit: () => null,
}));
vi.mock("@/lib/auth-helpers", () => ({ LOCAL_STORAGE_OWNER_ID: "local" }));
vi.mock("@/lib/available-models", () => ({ findAvailableModel: mocks.model }));
vi.mock("@/lib/chat/storage", () => ({ getChatSession: mocks.session }));
vi.mock("@/lib/tools/storage", () => ({ listUsableSessionToolIds: mocks.tools }));
vi.mock("@/lib/chat/server/openai-runtime", () => ({ createOpenAICompatibleStream: mocks.stream }));
vi.mock("@/lib/storage/file-context", () => ({ injectFileContexts: mocks.files }));
vi.mock("@/lib/server/model-catalog", () => ({ getServerModelMetadata: mocks.metadata }));
vi.mock("@/lib/tools/registry", () => ({
  getAvailableBuiltinTool: () => true,
  getToolFunctions: () => [],
  getToolSystemPrompt: () => "",
}));
import { POST } from "./route";
const model = {
  id: "test",
  provider: "test",
  apiKey: "secret",
  baseUrl: "https://example.com/v1",
  runtime: "openai-compatible",
};
const request = () =>
  new NextRequest("https://example.com/api/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [{ role: "user", content: "你好" }],
      model: "test",
      provider: "test",
      sessionId: "s",
    }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ authorized: true, key: "u", userId: "u" });
  mocks.model.mockResolvedValue(model);
  mocks.session.mockResolvedValue({ id: "s" });
  mocks.tools.mockResolvedValue([]);
  mocks.metadata.mockResolvedValue(undefined);
  mocks.stream.mockImplementation(async () => new Response('{"type":"content","text":"你好"}\n'));
});
it("starts independent preparation reads concurrently, then streams without any message write", async () => {
  let finishModel!: (v: unknown) => void,
    finishSession!: (v: unknown) => void,
    finishTools!: (v: unknown) => void;
  mocks.model.mockImplementation(
    () =>
      new Promise((r) => {
        finishModel = r;
      }),
  );
  mocks.session.mockImplementation(
    () =>
      new Promise((r) => {
        finishSession = r;
      }),
  );
  mocks.tools.mockImplementation(
    () =>
      new Promise((r) => {
        finishTools = r;
      }),
  );
  const pending = POST(request());
  await vi.waitFor(() => {
    expect(mocks.model).toHaveBeenCalledTimes(1);
    expect(mocks.session).toHaveBeenCalledTimes(1);
    expect(mocks.tools).toHaveBeenCalledTimes(1);
  });
  expect(mocks.stream).not.toHaveBeenCalled();
  finishModel(model);
  finishSession({ id: "s" });
  finishTools([]);
  const response = await pending;
  expect(await response.text()).toContain("你好");
  expect(response.headers.get("Server-Timing")).toMatch(
    /auth;dur=.*model;dur=.*session;dur=.*tools;dur=/,
  );
  expect(response.headers.get("Server-Timing")).toContain("prepare;dur=");
  expect(mocks.files).not.toHaveBeenCalled();
  expect(mocks.auth.mock.calls[0][1].deferPlatformRecord).toBeTypeOf("function");
});
it("never contacts a model before ownership has passed", async () => {
  mocks.session.mockResolvedValue(undefined);
  expect((await POST(request())).status).toBe(404);
  expect(mocks.stream).not.toHaveBeenCalled();
});
it("never reads private configuration or starts inference for an unauthorized user", async () => {
  mocks.auth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: "请先登录" }, { status: 401 }),
  });
  expect((await POST(request())).status).toBe(401);
  expect(mocks.model).not.toHaveBeenCalled();
  expect(mocks.tools).not.toHaveBeenCalled();
  expect(mocks.stream).not.toHaveBeenCalled();
});

it("passes opt-in personalization without adding a settings database read", async () => {
  const languageModel = {
    personalizationEnabled: true,
    preferredName: "小王",
    responseLength: "concise",
  };
  const response = await POST(
    new NextRequest("https://example.com/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "你好" }],
        model: "test",
        provider: "test",
        sessionId: "s",
        languageModel,
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.stream.mock.calls[0][11]).toEqual(languageModel);
});
