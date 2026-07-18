import type { ContextPreparation } from "@/lib/chat/context-window";
import type { TokenUsage } from "@/lib/chat/token-usage";
import type { WebSearchState } from "@/lib/chat/types";

import type { ChatMessage } from "./types";

type StreamEventType = "content" | "reasoning";

export const encodeStreamEvent = (encoder: TextEncoder, type: StreamEventType, text: string) =>
  encoder.encode(`${JSON.stringify({ type, text })}\n`);

export const encodeUsageEvent = (encoder: TextEncoder, usage: TokenUsage) =>
  encoder.encode(`${JSON.stringify({ type: "usage", ...usage })}\n`);

export const encodeToolEvent = (encoder: TextEncoder, webSearch: WebSearchState) =>
  encoder.encode(`${JSON.stringify({ type: "tool", webSearch })}\n`);

export const getContextHeaders = (
  context?: ContextPreparation<ChatMessage>,
): Record<string, string> =>
  context
    ? {
        "X-MarkAI-Context-Input": String(context.estimatedInputTokens),
        "X-MarkAI-Context-Removed": String(context.removedMessageCount),
        "X-MarkAI-Context-Truncated": context.contentTruncated ? "1" : "0",
        "X-MarkAI-Context-Window": String(context.contextWindowTokens),
      }
    : {};
