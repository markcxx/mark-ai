import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { isShareDuration, toReadonlyMessages } from "./share-types";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "markai-share-test-"));
let storage: Awaited<typeof import("./share-storage")>;
let db: ReturnType<(typeof import("./sqlite-storage"))["ensureDatabase"]>;
beforeAll(async () => {
  vi.stubEnv("MARKAI_SQLITE_PATH", path.join(directory, "test.sqlite"));
  storage = await import("./share-storage");
  db = (await import("./sqlite-storage")).ensureDatabase();
  db.prepare("INSERT INTO chat_sessions (id,title,created_at,updated_at) VALUES (?,?,?,?)").run(
    "session",
    "测试",
    Date.now(),
    Date.now(),
  );
});
afterAll(() => {
  vi.unstubAllEnvs();
  try {
    fs.rmSync(directory, { recursive: true, force: true });
  } catch (error) {
    // Windows keeps the cached SQLite handle locked until the worker exits; the
    // OS temp directory is cleaned up later, so a locked file is not a failure.
    if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
  }
});
const snapshot = {
  title: "测试快照",
  messages: [{ id: "a", role: "user" as const, content: "原始内容" }],
};

describe("conversation shares", () => {
  it("allows only explicit bounded expiration choices", () => {
    expect(isShareDuration(86400)).toBe(true);
    for (const value of [0, -1, Infinity, "86400", null, 999999999])
      expect(isShareDuration(value)).toBe(false);
  });
  it("stores an immutable snapshot and rotates the public token", async () => {
    const first = await storage.saveConversationShare("session", "local", snapshot, 3600);
    snapshot.messages[0].content = "后续修改";
    expect((await storage.getConversationShare(first.token))?.snapshot.messages[0].content).toBe(
      "原始内容",
    );
    const second = await storage.saveConversationShare("session", "local", snapshot, 86400);
    expect(second.token).not.toBe(first.token);
    expect(await storage.getConversationShare(first.token)).toBeUndefined();
    expect(await storage.getSessionShare("session", "other-user")).toBeUndefined();
    await storage.revokeSessionShare("session", "other-user");
    expect(await storage.getConversationShare(second.token)).toBeDefined();
    await storage.revokeSessionShare("session", "local");
    expect(await storage.getConversationShare(second.token)).toBeUndefined();
  });
  it("rejects expired tokens, malformed tokens and deleted sessions", async () => {
    const share = await storage.saveConversationShare("session", "local", snapshot, 3600);
    db.prepare("UPDATE conversation_shares SET expires_at = ?").run(Date.now() - 1);
    expect(await storage.getConversationShare(share.token)).toBeUndefined();
    expect(await storage.getConversationShare("../../private")).toBeUndefined();
    const next = await storage.saveConversationShare("session", "local", snapshot, 3600);
    db.prepare("DELETE FROM chat_sessions WHERE id = ?").run("session");
    expect(await storage.getConversationShare(next.token)).toBeUndefined();
  });
  it("excludes unselected variants and stops transient rendering", () => {
    const [message] = toReadonlyMessages([
      {
        id: "m",
        role: "model",
        content: "公开答案",
        isStreaming: true,
        activeVariantId: "a",
        variants: [{ id: "hidden", content: "未选中的内容" }],
        segments: [{ type: "thinking", content: "思考", isActive: true }],
      },
    ]);
    expect(message.variants).toBeUndefined();
    expect(message.activeVariantId).toBeUndefined();
    expect(message.isStreaming).toBe(false);
    expect(message.segments?.[0]).toMatchObject({ isActive: false });
  });
});

it("persists webpage images and provenance in a readonly share snapshot", async () => {
  db.prepare("INSERT INTO chat_sessions (id,title,created_at,updated_at) VALUES (?,?,?,?)").run(
    "web-session",
    "网页图片",
    Date.now(),
    Date.now(),
  );
  const messages = toReadonlyMessages([
    {
      id: "web",
      role: "model",
      content: "",
      segments: [
        {
          type: "tool",
          webSearch: {
            tool: "show_images",
            callId: "show-1",
            query: "图片",
            status: "done",
            results: [],
            images: [
              {
                id: "img_1",
                title: "正文图",
                url: "https://example.com/photo.jpg",
                sourceUrl: "https://example.com/article",
              },
            ],
          },
        },
        {
          type: "tool",
          webSearch: {
            tool: "read_webpage",
            callId: "read-2",
            query: "https://example.com/article",
            status: "searching",
            results: [],
          },
        },
      ],
    },
  ]);
  const saved = await storage.saveConversationShare(
    "web-session",
    "local",
    { title: "网页图片", messages },
    3600,
  );
  const restored = (await storage.getConversationShare(saved.token))!.snapshot.messages[0];
  expect(restored.segments?.[0]).toMatchObject({
    webSearch: { images: [{ id: "img_1", sourceUrl: "https://example.com/article" }] },
  });
  expect(restored.segments?.[1]).toMatchObject({ webSearch: { status: "error" } });
});
