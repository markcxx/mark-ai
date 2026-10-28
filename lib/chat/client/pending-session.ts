import type { Message } from "../types";
import { isMessage } from "../message-validation";
import { finishPendingExecutionTools } from "./execution";

const PREFIX = "markai:pending-session:";
type PendingSession = { token: string; revision?: number; messages: Message[] };
// Memory also protects a quick switch back while the final server write is pending.
const pending = new Map<string, PendingSession>();
const key = (id: string) => `${PREFIX}${id}`;

export function readPendingSession(id: string): PendingSession | undefined {
  if (pending.has(id)) return pending.get(id);
  try {
    const value = JSON.parse(window.localStorage.getItem(key(id)) || "null");
    if (
      value &&
      typeof value.token === "string" &&
      Array.isArray(value.messages) &&
      value.messages.every(isMessage)
    ) {
      pending.set(id, value);
      return value;
    }
  } catch {
    /* Browser storage can be unavailable. */
  }
}

export function stageSessionMessages(id: string, messages: Message[], revision?: number) {
  const value: PendingSession = {
    token: crypto.randomUUID(),
    revision,
    messages: structuredClone(messages),
  };
  pending.set(id, value);
  try {
    window.localStorage.setItem(key(id), JSON.stringify(value));
  } catch {
    /* Memory recovery still works. */
  }
  return value.token;
}

export function acknowledgeSessionSave(id: string, token: string, revision: number) {
  const value = readPendingSession(id);
  if (!value) return;
  if (value.token !== token) {
    // A new turn began while this ordered save was running. Its base is now saved.
    const next = { ...value, revision };
    pending.set(id, next);
    try {
      window.localStorage.setItem(key(id), JSON.stringify(next));
    } catch {
      /* Best effort. */
    }
    return;
  }
  forgetPendingSession(id);
}

export function forgetPendingSession(id: string) {
  pending.delete(id);
  try {
    window.localStorage.removeItem(key(id));
  } catch {
    /* Best effort. */
  }
}

export function recoverPendingMessages(id: string, revision: number): Message[] | undefined {
  const value = readPendingSession(id);
  // Never overwrite a newer revision from another device with an old browser draft.
  if (!value || (value.revision !== undefined && value.revision !== revision)) return;
  return value.messages.map((message) => ({
    ...message,
    interrupted: message.isStreaming ? true : message.interrupted,
    isStreaming: false,
    isReasoning: false,
    segments:
      message.segments &&
      finishPendingExecutionTools(message.segments, "生成已中断，可以继续生成").map((segment) =>
        segment.type === "thinking" ? { ...segment, isActive: false } : segment,
      ),
  }));
}
