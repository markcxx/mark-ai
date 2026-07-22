import { GoogleGenAI } from "@google/genai";

import type { ContextPreparation } from "@/lib/chat/context-window";
import { estimateTextTokens } from "@/lib/chat/metrics";
import {
  encodeGeneratedFileEvent,
  encodeStreamEvent,
  encodeUsageEvent,
  getContextHeaders,
} from "@/lib/chat/server/stream-protocol";
import type { ChatMessage } from "@/lib/chat/server/types";
import { getUsageNumber, resolveTokenUsage, type TokenUsage } from "@/lib/chat/token-usage";
import { executeBuiltinTool } from "@/lib/tools/executors";
import { getBuiltinToolByFunction, getToolFunctions } from "@/lib/tools/registry";

export const createGeminiStream = async ({
  apiKey,
  baseUrl,
  contextPreparation,
  messages,
  model,
  signal,
  systemPrompt,
  toolRuntime,
}: {
  apiKey: string;
  baseUrl?: string;
  contextPreparation?: ContextPreparation<ChatMessage>;
  messages: ChatMessage[];
  model: string;
  signal?: AbortSignal;
  systemPrompt: string;
  toolRuntime?: {
    enabledToolIds: string[];
    sessionId: string;
    userId: string;
  };
}) => {
  const ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });

  const toGeminiParts = (message: ChatMessage) => [
    { text: message.content || "请识别并说明图片内容。" },
    ...(message.imageInputs || []).map((image) => ({
      inlineData: { data: image.data, mimeType: image.mediaType },
    })),
  ];
  const prompt = messages[messages.length - 1];
  const history = messages.slice(0, -1).map((message) => ({
    parts: toGeminiParts(message),
    role: message.role === "model" ? "model" : "user",
  }));

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "了解。" }] },
    ...history,
    { role: "user", parts: toGeminiParts(prompt) },
  ];
  const builtinFunctions = getToolFunctions(toolRuntime?.enabledToolIds || []);

  if (builtinFunctions.length > 0 && toolRuntime) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const toolContents = [...contents] as any[];
        let outputText = "";
        let providerUsage: TokenUsage | undefined;

        try {
          for (let round = 0; round < 5; round += 1) {
            const response = await ai.models.generateContent({
              config: {
                abortSignal: signal,
                tools: [
                  {
                    functionDeclarations: builtinFunctions.map((toolFunction) => ({
                      description: toolFunction.description,
                      name: toolFunction.name,
                      parametersJsonSchema: toolFunction.parameters,
                    })),
                  },
                ],
              },
              contents: toolContents,
              model,
            });
            const usageMetadata = response.usageMetadata;
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

            const functionCalls = response.functionCalls || [];
            if (functionCalls.length === 0) {
              outputText = response.text || "";
              if (outputText) controller.enqueue(encodeStreamEvent(encoder, "content", outputText));
              break;
            }

            const modelContent = response.candidates?.[0]?.content;
            if (modelContent) toolContents.push(modelContent);
            const responseParts: any[] = [];

            for (const [index, functionCall] of functionCalls.entries()) {
              const name = functionCall.name || "";
              const builtinTool = getBuiltinToolByFunction(name);
              const callId = functionCall.id || `gemini-tool-${round}-${index}`;
              if (!builtinTool) continue;

              const runningState = {
                callId,
                status: "running" as const,
                toolId: builtinTool.id,
                toolName: name,
              };
              controller.enqueue(encodeGeneratedFileEvent(encoder, runningState));

              try {
                const result = await executeBuiltinTool(name, functionCall.args || {}, {
                  sessionId: toolRuntime.sessionId,
                  userId: toolRuntime.userId,
                });
                controller.enqueue(
                  encodeGeneratedFileEvent(encoder, {
                    ...runningState,
                    file: result.file,
                    status: "done",
                  }),
                );
                responseParts.push({
                  functionResponse: {
                    id: functionCall.id,
                    name,
                    response: result.content,
                  },
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : "File generation failed";
                controller.enqueue(
                  encodeGeneratedFileEvent(encoder, {
                    ...runningState,
                    error: message,
                    status: "error",
                  }),
                );
                responseParts.push({
                  functionResponse: {
                    id: functionCall.id,
                    name,
                    response: { error: message, success: false },
                  },
                });
              }
            }

            if (responseParts.length === 0) break;
            toolContents.push({ parts: responseParts, role: "user" });
          }

          controller.enqueue(
            encodeUsageEvent(
              encoder,
              resolveTokenUsage({
                estimatedInputTokens: estimateTextTokens(
                  JSON.stringify({ contents: toolContents, tools: builtinFunctions }),
                ),
                estimatedOutputTokens: estimateTextTokens(outputText),
                providerUsage,
              }),
            ),
          );
          controller.close();
        } catch (error) {
          controller.error(error);
        }
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
  }

  const responseStream = await ai.models.generateContentStream({
    config: { abortSignal: signal },
    contents,
    model,
  });

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
