import { GoogleGenAI } from "@google/genai";

import type { ContextPreparation } from "@/lib/chat/context-window";
import { estimateTextTokens } from "@/lib/chat/metrics";
import {
  encodeStreamEvent,
  encodeUsageEvent,
  getContextHeaders,
} from "@/lib/chat/server/stream-protocol";
import type { ChatMessage } from "@/lib/chat/server/types";
import { getUsageNumber, resolveTokenUsage, type TokenUsage } from "@/lib/chat/token-usage";

export const createGeminiStream = async ({
  apiKey,
  baseUrl,
  contextPreparation,
  messages,
  model,
  systemPrompt,
}: {
  apiKey: string;
  baseUrl?: string;
  contextPreparation?: ContextPreparation<ChatMessage>;
  messages: ChatMessage[];
  model: string;
  systemPrompt: string;
}) => {
  const ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });

  const prompt = messages[messages.length - 1].content;
  const history = messages.slice(0, -1).map((message) => ({
    parts: [{ text: message.content }],
    role: message.role === "model" ? "model" : "user",
  }));

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "了解。" }] },
    ...history,
    { role: "user", parts: [{ text: prompt }] },
  ];
  const responseStream = await ai.models.generateContentStream({ contents, model });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let outputText = "";
      let providerUsage: TokenUsage | undefined;

      for await (const chunk of responseStream) {
        if (chunk.text) {
          outputText += chunk.text;
          controller.enqueue(encodeStreamEvent(encoder, "content", chunk.text));
        }
        const usageMetadata = (chunk as any).usageMetadata;
        if (usageMetadata) {
          const inputTokens = getUsageNumber(usageMetadata.promptTokenCount);
          const candidateTokens = getUsageNumber(usageMetadata.candidatesTokenCount);
          const reasoningTokens = getUsageNumber(usageMetadata.thoughtsTokenCount) || 0;
          const totalTokens = getUsageNumber(usageMetadata.totalTokenCount);
          providerUsage = {
            inputTokens: inputTokens ?? providerUsage?.inputTokens,
            outputTokens:
              (totalTokens !== undefined && inputTokens !== undefined
                ? Math.max(totalTokens - inputTokens, 0)
                : candidateTokens !== undefined
                  ? candidateTokens + reasoningTokens
                  : undefined) ?? providerUsage?.outputTokens,
            totalTokens: totalTokens ?? providerUsage?.totalTokens,
          };
        }
      }
      controller.enqueue(
        encodeUsageEvent(
          encoder,
          resolveTokenUsage({
            estimatedInputTokens: estimateTextTokens(JSON.stringify(contents)),
            estimatedOutputTokens: estimateTextTokens(outputText),
            providerUsage,
          }),
        ),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      ...getContextHeaders(contextPreparation),
    },
  });
};
