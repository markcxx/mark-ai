import { afterEach, expect, it, vi } from "vitest";
import type { Message } from "../types";
import {
  stageSessionMessages,
  recoverPendingMessages,
  acknowledgeSessionSave,
  forgetPendingSession,
  readPendingSession,
} from "./pending-session";
import { enqueueSessionWrite } from "./session-write-queue";
const messages: Message[] = [
  {
    id: "m",
    role: "model",
    content: "部分输出",
    isStreaming: true,
    isReasoning: true,
    segments: [{ type: "thinking", content: "思考", isActive: true }],
  },
];
afterEach(() => {
  forgetPendingSession("test");
  vi.unstubAllGlobals();
});
it("recovers an interrupted turn and does not overwrite a newer server revision", () => {
  stageSessionMessages("test", messages, 4);
  expect(recoverPendingMessages("test", 4)?.[0]).toMatchObject({
    content: "部分输出",
    isStreaming: false,
    isReasoning: false,
    interrupted: true,
    segments: [{ isActive: false }],
  });
  expect(recoverPendingMessages("test", 5)).toBeUndefined();
});
it("keeps the newer pending turn when an older save finishes", () => {
  const old = stageSessionMessages("test", messages, 4);
  stageSessionMessages("test", [{ ...messages[0], content: "新内容" }], 4);
  acknowledgeSessionSave("test", old, 5);
  expect(recoverPendingMessages("test", 5)?.[0].content).toBe("新内容");
  acknowledgeSessionSave("test", readPendingSession("test")!.token, 6);
  expect(readPendingSession("test")).toBeUndefined();
});
it("retains memory recovery if browser storage is full", () => {
  vi.stubGlobal("window", {
    localStorage: {
      setItem: () => {
        throw new Error("quota");
      },
    },
  });
  expect(() => stageSessionMessages("test", messages, 4)).not.toThrow();
  expect(recoverPendingMessages("test", 4)?.[0].content).toBe("部分输出");
});
it("loads the browser backup after module memory is reset", async () => {
  const data = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      setItem: (k: string, v: string) => data.set(k, v),
      getItem: (k: string) => data.get(k),
      removeItem: (k: string) => data.delete(k),
    },
  });
  stageSessionMessages("test", messages, 4);
  vi.resetModules();
  const reloaded = await import("./pending-session");
  expect(reloaded.recoverPendingMessages("test", 4)?.[0].content).toBe("部分输出");
  reloaded.forgetPendingSession("test");
});
it("serializes writes per session and continues after an earlier save fails", async () => {
  let reject!: (e: Error) => void;
  const first = enqueueSessionWrite(
    "queue",
    () =>
      new Promise<void>((_, r) => {
        reject = r;
      }),
  );
  const secondWrite = vi.fn(async () => "saved");
  const second = enqueueSessionWrite("queue", secondWrite);
  await Promise.resolve();
  await Promise.resolve();
  expect(secondWrite).not.toHaveBeenCalled();
  reject(new Error("offline"));
  await expect(first).rejects.toThrow("offline");
  await expect(second).resolves.toBe("saved");
});
