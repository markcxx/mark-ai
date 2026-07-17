import type { ChatStreamEvent } from "@/lib/chat/types";

export const parseChatStreamLine = (line: string): ChatStreamEvent | undefined => {
  const trimmed = line.trim();
  if (!trimmed) return undefined;

  try {
    return JSON.parse(trimmed) as ChatStreamEvent;
  } catch {
    return { text: line, type: "content" };
  }
};

export const createSmoothTextController = (onChunk: (chunk: string) => void) => {
  let animationFrame: number | null = null;
  let carry = 0;
  let finishing = false;
  let lastFrameTime = 0;
  let queue = "";
  const finishResolvers: Array<() => void> = [];

  const settle = () => {
    while (finishResolvers.length > 0) finishResolvers.shift()?.();
  };

  const tick = (timestamp: number) => {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const elapsed = Math.min(timestamp - lastFrameTime, 64);
    lastFrameTime = timestamp;
    const queueAdjustedSpeed = queue.length * (finishing ? 10 : 5);
    const charsPerSecond = Math.min(1600, Math.max(finishing ? 120 : 48, queueAdjustedSpeed));
    carry += (elapsed * charsPerSecond) / 1000;

    const count = Math.min(queue.length, Math.floor(carry));
    if (count > 0) {
      const chunk = queue.slice(0, count);
      queue = queue.slice(count);
      carry -= count;
      onChunk(chunk);
    }

    if (queue.length > 0) {
      animationFrame = requestAnimationFrame(tick);
      return;
    }

    animationFrame = null;
    lastFrameTime = 0;
    carry = 0;
    settle();
  };

  const schedule = () => {
    if (animationFrame === null) animationFrame = requestAnimationFrame(tick);
  };

  return {
    finish: () => {
      finishing = true;
      if (!queue) return Promise.resolve();
      schedule();
      return new Promise<void>((resolve) => finishResolvers.push(resolve));
    },
    flush: () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
      lastFrameTime = 0;
      carry = 0;
      if (queue) {
        const remaining = queue;
        queue = "";
        onChunk(remaining);
      }
      settle();
    },
    push: (chunk: string) => {
      if (!chunk) return;
      queue += chunk;
      schedule();
    },
  };
};
