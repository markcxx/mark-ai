import { ChartValidationLimitError } from "./chart-validation";
import { describeGenerationError } from "@/lib/chat/generation-error";
import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type GenerateContentParameters,
  type Part,
  type GenerateContentResponseUsageMetadata,
} from "@google/genai";

import type { ContextPreparation } from "@/lib/chat/context-window";
import { estimateTextTokens } from "@/lib/chat/metrics";
import {
  encodeToolEvent,
  encodeGeneratedFileEvent,
  encodeStreamEvent,
  encodeUsageEvent,
  getContextHeaders,
} from "@/lib/chat/server/stream-protocol";
import type { ChatMessage } from "@/lib/chat/server/types";
import { WEB_TOOLS } from "./runtime-prompt";
import { WEB_TOOL_NAMES, WebToolSession } from "./web-tools";
import { formatToolResultForModel } from "./openai-helpers";
import { contentWithWebContext } from "../web-context";
import {
  getUsageNumber,
  resolveTokenUsage,
  type ResolvedTokenUsage,
  type TokenUsage,
} from "@/lib/chat/token-usage";
import { executeBuiltinTool } from "@/lib/tools/executors";
import { getBuiltinToolByFunction, getToolFunctions } from "@/lib/tools/registry";
import { getWordContinuationPrompt, getWordContinuationToolNames } from "@/lib/tools/word/workflow";

export const createGeminiStream = async ({
  apiKey,
  baseUrl,
  contextPreparation,
  messages,
  model,
  signal,
  systemPrompt,
  toolRuntime,
  webSearchEnabled = false,
}: {
  apiKey: string;
  baseUrl?: string;
  contextPreparation?: ContextPreparation<ChatMessage>;
  messages: ChatMessage[];
  model: string;
  signal?: AbortSignal;
  systemPrompt: string;
  webSearchEnabled?: boolean;
  toolRuntime?: {
    enabledToolIds: string[];
    debugChartAttempts?: boolean;
    sessionId: string;
    userId: string;
  };
}) => {
  const ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });

  const toGeminiParts = (message: ChatMessage) => [
    { text: contentWithWebContext(message) || "请识别并说明图片内容。" },
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
  const builtinFunctions = [
    ...getToolFunctions(toolRuntime?.enabledToolIds || []),
    ...(webSearchEnabled ? WEB_TOOLS.map((tool) => tool.function) : []),
  ];
  const allowedNames = new Set(builtinFunctions.map((tool) => tool.name));
  const toolResultMaxChars = contextPreparation
    ? Math.min(18_000, Math.max(2000, Math.floor(contextPreparation.inputBudgetTokens * 0.4)))
    : 18_000;
  const streamTools = Boolean(toolRuntime?.debugChartAttempts || webSearchEnabled);

  if (builtinFunctions.length > 0) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const toolRuntimeState = new Map<string, unknown>();
        const webTools = new WebToolSession(messages, signal);
        let chartAttemptIndex = 0;
        const toolContents = [...contents] as any[];
        let outputText = "";
        let latestUsage: ResolvedTokenUsage | undefined;
        let requiredWordToolNames: string[] = [];
        let wordProtocolRetries = 0;

        try {
          const maxToolRounds = builtinFunctions.some(
            (toolFunction) => toolFunction.name === "word_document_begin",
          )
            ? 32
            : webSearchEnabled
              ? 8
              : 5;
          for (let round = 0; round < maxToolRounds + (webSearchEnabled ? 1 : 0); round += 1) {
            const request: GenerateContentParameters = {
              config: {
                abortSignal: signal,
                ...(requiredWordToolNames.length
                  ? {
                      toolConfig: {
                        functionCallingConfig: {
                          allowedFunctionNames: requiredWordToolNames,
                          mode: FunctionCallingConfigMode.ANY,
                        },
                      },
                    }
                  : {}),
                tools:
                  round >= maxToolRounds
                    ? []
                    : [
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
            };
            const response = streamTools
              ? await (async () => {
                  const chunks = await ai.models.generateContentStream({
                    ...request,
                    config: { ...request.config, thinkingConfig: { includeThoughts: true } },
                  });
                  const parts: Part[] = [];
                  let usageMetadata: GenerateContentResponseUsageMetadata | undefined;
                  let text = "";
                  for await (const chunk of chunks) {
                    if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
                    for (const part of chunk.candidates?.[0]?.content?.parts || []) {
                      parts.push(part);
                      if (part.text) {
                        if (!part.thought) text += part.text;
                        controller.enqueue(
                          encodeStreamEvent(
                            encoder,
                            part.thought ? "reasoning" : "content",
                            part.text,
                          ),
                        );
                      }
                    }
                  }
                  return {
                    usageMetadata,
                    text,
                    functionCalls: parts.flatMap((part) =>
                      part.functionCall ? [part.functionCall] : [],
                    ),
                    candidates: [{ content: { role: "model", parts } }],
                  };
                })()
              : await ai.models.generateContent(request);
            const usageMetadata = response.usageMetadata;
            let providerUsage: TokenUsage | undefined;
            if (usageMetadata) {
              const inputTokens = getUsageNumber(usageMetadata.promptTokenCount);
              const candidateTokens = getUsageNumber(usageMetadata.candidatesTokenCount);
              const reasoningTokens = getUsageNumber(usageMetadata.thoughtsTokenCount) || 0;
              const totalTokens = getUsageNumber(usageMetadata.totalTokenCount);
              providerUsage = {
                inputTokens,
                outputTokens:
                  totalTokens !== undefined && inputTokens !== undefined
                    ? Math.max(totalTokens - inputTokens, 0)
                    : candidateTokens !== undefined
                      ? candidateTokens + reasoningTokens
                      : undefined,
                totalTokens,
              };
            }

            const functionCalls = (response.functionCalls || []).filter(
              (functionCall) =>
                allowedNames.has(functionCall.name || "") &&
                (requiredWordToolNames.length === 0 ||
                  requiredWordToolNames.includes(functionCall.name || "")),
            );
            const passUsage = resolveTokenUsage({
              estimatedInputTokens: estimateTextTokens(
                JSON.stringify({ contents: toolContents, tools: builtinFunctions }),
              ),
              estimatedOutputTokens: estimateTextTokens(
                JSON.stringify({ functionCalls, text: response.text || "" }),
              ),
              providerUsage,
            });
            latestUsage = passUsage;
            if (functionCalls.length === 0) {
              if (requiredWordToolNames.length === 0) {
                outputText = response.text || "";
                if (outputText && !streamTools) {
                  controller.enqueue(encodeStreamEvent(encoder, "content", outputText));
                }
                break;
              }
              wordProtocolRetries += 1;
              if (wordProtocolRetries > 2) {
                throw new Error(
                  `模型未按 Word 工作流调用 ${requiredWordToolNames.join(" 或 ")}，文档尚未生成`,
                );
              }
              toolContents.push({
                parts: [{ text: response.text || "我需要继续完成 Word 文档工作流。" }],
                role: "model",
              });
              toolContents.push({
                parts: [{ text: getWordContinuationPrompt(requiredWordToolNames) }],
                role: "user",
              });
              continue;
            }
            wordProtocolRetries = 0;

            const modelContent = response.candidates?.[0]?.content;
            if (modelContent) toolContents.push(modelContent);
            const responseParts: any[] = [];

            for (const [index, functionCall] of functionCalls.entries()) {
              const name = functionCall.name || "";
              const builtinTool = getBuiltinToolByFunction(name);
              const callId = functionCall.id || `gemini-tool-${round}-${index}`;
              const functionArgs = functionCall.args || {};
              if (webSearchEnabled && WEB_TOOL_NAMES.has(name)) {
                const result = await webTools.execute(name, functionArgs, callId, (state) =>
                  controller.enqueue(encodeToolEvent(encoder, state)),
                );
                responseParts.push({
                  functionResponse: {
                    id: functionCall.id,
                    name,
                    response: JSON.parse(formatToolResultForModel(result, toolResultMaxChars)),
                  },
                });
                continue;
              }
              if (!builtinTool || !toolRuntime) continue;

              const runningState = {
                artifactId:
                  typeof functionArgs.documentId === "string" ? functionArgs.documentId : undefined,
                callId,
                status: "running" as const,
                toolId: builtinTool.id,
                toolName: name,
              };
              controller.enqueue(encodeGeneratedFileEvent(encoder, runningState));

              const chartAttempt =
                toolRuntime.debugChartAttempts && name === "render_echarts_chart"
                  ? { index: ++chartAttemptIndex, raw: JSON.stringify(functionArgs, null, 2) }
                  : undefined;
              try {
                const result = await executeBuiltinTool(name, functionArgs, {
                  runtimeState: toolRuntimeState,
                  sessionId: toolRuntime.sessionId,
                  userId: toolRuntime.userId,
                });
                controller.enqueue(
                  encodeGeneratedFileEvent(encoder, {
                    ...runningState,
                    artifactId: result.preview?.documentId || runningState.artifactId,
                    file: result.file,
                    preview: result.preview,
                    progress: result.progress,
                    status: "done",
                  }),
                );
                if (builtinTool.id === "word-document") {
                  requiredWordToolNames = getWordContinuationToolNames(name, result.content) || [];
                }
                if (chartAttempt)
                  controller.enqueue(
                    encoder.encode(
                      `${JSON.stringify({ type: "attempt", ...chartAttempt, validation: result.content.validation })}\n`,
                    ),
                  );
                if (result.output) {
                  controller.enqueue(encodeStreamEvent(encoder, "content", result.output));
                }
                responseParts.push({
                  functionResponse: {
                    id: functionCall.id,
                    name,
                    response: result.content,
                  },
                });
              } catch (error) {
                const message = error instanceof Error ? error.message : "File generation failed";
                if (chartAttempt)
                  controller.enqueue(
                    encoder.encode(
                      `${JSON.stringify({ type: "attempt", ...chartAttempt, error: message })}\n`,
                    ),
                  );
                controller.enqueue(
                  encodeGeneratedFileEvent(encoder, {
                    ...runningState,
                    error: message,
                    status: "error",
                  }),
                );
                if (error instanceof ChartValidationLimitError) throw error;
                if (builtinTool.id === "word-document") requiredWordToolNames = [];
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

          if (requiredWordToolNames.length > 0) {
            throw new Error(
              `Word 文档生成超过最大步骤数，尚待执行 ${requiredWordToolNames.join(" 或 ")}`,
            );
          }

          if (latestUsage) {
            controller.enqueue(encodeUsageEvent(encoder, latestUsage));
          }
          controller.close();
        } catch (error) {
          controller.enqueue(
            encodeStreamEvent(new TextEncoder(), "error", describeGenerationError(error, [apiKey])),
          );
          controller.close();
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

      try {
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
        const resolvedUsage = resolveTokenUsage({
          estimatedInputTokens: estimateTextTokens(JSON.stringify(contents)),
          estimatedOutputTokens: estimateTextTokens(outputText),
          providerUsage,
        });
        controller.enqueue(encodeUsageEvent(encoder, resolvedUsage));
        controller.close();
      } catch (error) {
        controller.enqueue(
          encodeStreamEvent(encoder, "error", describeGenerationError(error, [apiKey])),
        );
        controller.close();
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
};
