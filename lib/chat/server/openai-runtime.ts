import { ChartValidationLimitError } from "./chart-validation";
import { describeGenerationError } from "@/lib/chat/generation-error";
import { getThinkingRequestParameters, type ThinkingPolicy } from "@/lib/model-thinking";
import { NextResponse } from "next/server";

import type { ContextPreparation } from "@/lib/chat/context-window";
import { estimateTextTokens } from "@/lib/chat/metrics";
import {
  formatToolResultForModel,
  getChoiceText,
  isUnsupportedStreamUsageError,
  normalizeToolCalls,
  toOpenAIChatEndpoint,
  toOpenAIMessages,
} from "@/lib/chat/server/openai-helpers";
import { WEB_TOOLS } from "@/lib/chat/server/runtime-prompt";
import { WEB_TOOL_NAMES, WebToolSession } from "./web-tools";
import {
  ThinkingTagStreamParser,
  type ThinkingTagStreamEvent,
} from "@/lib/chat/server/thinking-tag-stream";
import {
  encodeCompletionEvent,
  encodeStepEvent,
  encodeGeneratedFileEvent,
  encodeStreamEvent,
  encodeToolEvent,
  encodeUsageEvent,
  getContextHeaders,
} from "@/lib/chat/server/stream-protocol";
import type { ChatMessage, OpenAIChatMessage, OpenAIToolCall } from "@/lib/chat/server/types";
import {
  getUsageNumber,
  resolveTokenUsage,
  type ResolvedTokenUsage,
  type TokenUsage,
} from "@/lib/chat/token-usage";
import { fetchWithDevelopmentProxy } from "@/lib/server/development-proxy";
import { executeBuiltinTool } from "@/lib/tools/executors";
import { getBuiltinToolByFunction, getToolFunctions } from "@/lib/tools/registry";
import { getWordContinuationPrompt, getWordContinuationToolNames } from "@/lib/tools/word/workflow";

const unsupportedStreamUsage = new Set<string>();

export const createOpenAICompatibleStream = async (
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  baseUrl?: string,
  webSearchEnabled = false,
  timezone?: unknown,
  signal?: AbortSignal,
  contextPreparation?: ContextPreparation<ChatMessage>,
  toolRuntime?: {
    enabledToolIds: string[];
    debugChartAttempts?: boolean;
    sessionId: string;
    skillPrompt?: string;
    userId: string;
  },
  thinking?: { policy?: ThinkingPolicy; enabled?: boolean },
  requestTransport: typeof fetchWithDevelopmentProxy = fetchWithDevelopmentProxy,
  personalization?: unknown,
) => {
  const thinkingActive = thinking?.enabled ?? thinking?.policy?.defaultEnabled;
  const preserveReasoning = Boolean(thinking?.policy && thinkingActive);
  const autoToolChoice = Boolean(thinking?.policy?.autoToolChoice && thinkingActive);
  const endpoint = toOpenAIChatEndpoint(baseUrl);
  if (!endpoint) {
    return NextResponse.json({ error: "模型接口地址尚未配置" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const toolResultMaxChars = contextPreparation
    ? Math.min(18_000, Math.max(2000, Math.floor(contextPreparation.inputBudgetTokens * 0.4)))
    : 18_000;
  const openAIMessages = toOpenAIMessages({
    personalization,
    messages,
    preserveReasoning,
    skillPrompt: toolRuntime?.skillPrompt,
    timezone,
    webSearchEnabled,
  });
  const builtinFunctions = getToolFunctions(toolRuntime?.enabledToolIds || []);
  const availableTools = [
    ...(webSearchEnabled ? WEB_TOOLS : []),
    ...builtinFunctions.map((toolFunction) => ({ function: toolFunction, type: "function" })),
  ];
  const allowedToolNames = new Set(availableTools.map((tool) => tool.function.name));

  const stream = new ReadableStream({
    async start(controller) {
      const toolRuntimeState = new Map<string, unknown>();
      let chartAttemptIndex = 0;
      const runId = crypto.randomUUID();
      let stepIndex = 0;
      let finalStepId = "";
      const webTools = new WebToolSession(messages, signal);

      const requestUpstream = async (
        requestMessages: OpenAIChatMessage[],
        allowTools: boolean,
        requiredToolNames: string[] = [],
      ) => {
        const usageCapabilityKey = `${endpoint}\n${model}`;
        const requiredToolNameSet = new Set(requiredToolNames);
        const requestTools = requiredToolNames.length
          ? availableTools.filter((tool) => requiredToolNameSet.has(tool.function.name))
          : availableTools;
        const createRequestBody = (includeUsage: boolean, enforceRequiredTools = true) => ({
          ...getThinkingRequestParameters(thinking?.policy, thinking?.enabled),
          messages: requestMessages,
          model,
          stream: true,
          ...(includeUsage ? { stream_options: { include_usage: true } } : {}),
          ...(allowTools
            ? {
                tool_choice:
                  !autoToolChoice && enforceRequiredTools && requiredToolNames.length === 1
                    ? {
                        function: { name: requiredToolNames[0] },
                        type: "function",
                      }
                    : !autoToolChoice && enforceRequiredTools && requiredToolNames.length > 1
                      ? "required"
                      : "auto",
                tools: requestTools,
              }
            : {}),
        });
        const sendRequest = (includeUsage: boolean, enforceRequiredTools = true) =>
          requestTransport(endpoint, {
            body: JSON.stringify(createRequestBody(includeUsage, enforceRequiredTools)),
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            signal,
          });

        let includeUsage = !unsupportedStreamUsage.has(usageCapabilityKey);
        let enforceRequiredTools = true;
        let upstream = await sendRequest(includeUsage, enforceRequiredTools);

        while (!upstream.ok) {
          const detail = await upstream.text();
          if (includeUsage && isUnsupportedStreamUsageError(upstream.status, detail)) {
            unsupportedStreamUsage.add(usageCapabilityKey);
            includeUsage = false;
            upstream = await sendRequest(includeUsage, enforceRequiredTools);
            continue;
          }
          if (
            enforceRequiredTools &&
            requiredToolNames.length > 0 &&
            [400, 404, 422].includes(upstream.status) &&
            /tool[_ ]choice|function[_ ]call/i.test(detail)
          ) {
            enforceRequiredTools = false;
            upstream = await sendRequest(includeUsage, enforceRequiredTools);
            continue;
          }
          throw Object.assign(new Error(detail || "Upstream model request failed"), {
            status: upstream.status,
          });
        }

        if (!upstream.body) {
          throw new Error("模型服务未返回可读取的响应");
        }

        return upstream.body.getReader();
      };

      const estimateOpenAIInputTokens = (
        requestMessages: OpenAIChatMessage[],
        allowTools: boolean,
        requiredToolNames: string[] = [],
      ) =>
        estimateTextTokens(
          JSON.stringify({
            ...getThinkingRequestParameters(thinking?.policy, thinking?.enabled),
            messages: requestMessages,
            ...(allowTools
              ? {
                  tool_choice: requiredToolNames.length ? "required" : "auto",
                  tools: requiredToolNames.length
                    ? availableTools.filter((tool) =>
                        requiredToolNames.includes(tool.function.name),
                      )
                    : availableTools,
                }
              : {}),
          }),
        );

      const streamModelResponse = async (
        requestMessages: OpenAIChatMessage[],
        allowTools: boolean,
        requiredToolNames: string[] = [],
      ) => {
        const reader = await requestUpstream(requestMessages, allowTools, requiredToolNames);
        const stepId = `${runId}:${++stepIndex}`;
        if (availableTools.length) controller.enqueue(encodeStepEvent(encoder, stepId, "started"));
        const decoder = new TextDecoder();
        const toolCallsByIndex = new Map<number, OpenAIToolCall>();
        let assistantContent = "";
        let assistantReasoning = "";
        let buffer = "";
        let providerUsage: TokenUsage | undefined;
        let thinkingParsersFinished = false;
        let finishReason: string | undefined;
        let receivedDone = false;
        const thinkingParsers = new Map<number, ThinkingTagStreamParser>();

        const emitTextEvent = (event: ThinkingTagStreamEvent) => {
          if (!event.text) return;
          if (event.type === "reasoning") assistantReasoning += event.text;
          else assistantContent += event.text;
          if (requiredToolNames.length === 0) {
            controller.enqueue(encodeStreamEvent(encoder, event.type, event.text));
          }
        };

        const finishThinkingParsers = () => {
          if (thinkingParsersFinished) return;
          thinkingParsersFinished = true;
          thinkingParsers.forEach((parser) => parser.finish().forEach(emitTextEvent));
        };

        const appendToolCall = (toolCall: any, fallbackIndex: number) => {
          const index = Number.isFinite(toolCall?.index) ? Number(toolCall.index) : fallbackIndex;
          const current = toolCallsByIndex.get(index) || {
            function: { arguments: "", name: "" },
            id: "",
            type: "function" as const,
          };

          if (typeof toolCall?.id === "string") current.id = toolCall.id;
          if (toolCall?.function) {
            if (typeof toolCall.function.name === "string") {
              current.function.name += toolCall.function.name;
            }
            if (typeof toolCall.function.arguments === "string") {
              current.function.arguments += toolCall.function.arguments;
            }
          }
          if (toolCall?.type === "function") current.type = "function";

          toolCallsByIndex.set(index, current);
        };

        const handleParsedEvent = (parsed: any) => {
          const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
          const usage = parsed.usage;

          if (usage && typeof usage === "object") {
            providerUsage = {
              inputTokens:
                getUsageNumber(usage.prompt_tokens, usage.input_tokens, usage.inputTokens) ??
                providerUsage?.inputTokens,
              outputTokens:
                getUsageNumber(usage.completion_tokens, usage.output_tokens, usage.outputTokens) ??
                providerUsage?.outputTokens,
              totalTokens:
                getUsageNumber(usage.total_tokens, usage.totalTokens) ?? providerUsage?.totalTokens,
            };
          }

          for (const [fallbackIndex, choice] of choices.entries()) {
            if (choice.finish_reason) finishReason = choice.finish_reason;
            const reasoning = getChoiceText(choice, [
              "reasoning_content",
              "reasoningContent",
              "reasoning",
              "thinking_content",
              "thinkingContent",
              "thinking",
              "reasoning_details",
              "reasoningDetails",
            ]);
            const content = getChoiceText(choice, ["content", "text"]);
            const deltaToolCalls = choice?.delta?.tool_calls || choice?.message?.tool_calls;

            if (reasoning) {
              emitTextEvent({ text: reasoning, type: "reasoning" });
            }
            if (content) {
              const choiceIndex = Number.isFinite(choice?.index)
                ? Number(choice.index)
                : fallbackIndex;
              const parser = thinkingParsers.get(choiceIndex) || new ThinkingTagStreamParser();
              thinkingParsers.set(choiceIndex, parser);
              parser.push(content).forEach(emitTextEvent);
            }
            if (Array.isArray(deltaToolCalls)) {
              deltaToolCalls.forEach(appendToolCall);
            }
          }
        };

        const getPassResult = () => {
          finishThinkingParsers();
          if (!receivedDone && !finishReason) {
            throw new Error("模型连接意外结束，请继续生成或重试。");
          }
          if (finishReason === "length" || finishReason === "content_filter") {
            throw new Error("模型回复未完整生成，请继续生成或切换模型。");
          }
          const toolCalls = normalizeToolCalls([...toolCallsByIndex.values()]);
          return {
            stepId,
            assistantContent,
            assistantReasoning,
            toolCalls,
            usage: resolveTokenUsage({
              estimatedInputTokens: estimateOpenAIInputTokens(
                requestMessages,
                allowTools,
                requiredToolNames,
              ),
              estimatedOutputTokens: estimateTextTokens(
                [
                  assistantContent,
                  assistantReasoning,
                  toolCalls.length ? JSON.stringify(toolCalls) : "",
                ]
                  .filter(Boolean)
                  .join("\n"),
              ),
              providerUsage,
            }),
          };
        };

        const enqueueDataLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) return false;

          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") receivedDone = true;
          if (!data || receivedDone) return receivedDone;

          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            return false;
          }
          if (parsed.error) throw new Error(JSON.stringify(parsed));
          handleParsedEvent(parsed);

          return false;
        };

        while (true) {
          const { value, done } = await reader.read();

          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (enqueueDataLine(line)) {
                return getPassResult();
              }
            }
          }

          if (done) break;
        }

        if (buffer) enqueueDataLine(buffer);

        return getPassResult();
      };

      try {
        let currentMessages = openAIMessages;
        let latestUsage: ResolvedTokenUsage | undefined;
        let requiredWordToolNames: string[] = [];
        let wordProtocolRetries = 0;

        while (true) {
          signal?.throwIfAborted();
          const pass = await streamModelResponse(
            currentMessages,
            availableTools.length > 0,
            requiredWordToolNames,
          );
          latestUsage = pass.usage;
          const executableToolCalls = pass.toolCalls.filter(
            (toolCall) =>
              allowedToolNames.has(toolCall.function.name) &&
              (requiredWordToolNames.length === 0 ||
                requiredWordToolNames.includes(toolCall.function.name)),
          );

          if (executableToolCalls.length === 0) {
            if (requiredWordToolNames.length === 0) {
              if (!pass.assistantContent.trim()) {
                throw new Error("模型未返回回答正文，请重试或切换模型。");
              }
              finalStepId = pass.stepId;
              break;
            }
            controller.enqueue(encodeStepEvent(encoder, pass.stepId, "tool"));
            wordProtocolRetries += 1;
            if (wordProtocolRetries > 2) {
              throw new Error(
                `模型未按 Word 工作流调用 ${requiredWordToolNames.join(" 或 ")}，文档尚未生成`,
              );
            }
            currentMessages = [
              ...currentMessages,
              ...(pass.assistantContent
                ? ([
                    {
                      content: pass.assistantContent,
                      role: "assistant",
                      ...(preserveReasoning ? { reasoning_content: pass.assistantReasoning } : {}),
                    },
                  ] as OpenAIChatMessage[])
                : []),
              {
                content: getWordContinuationPrompt(requiredWordToolNames),
                role: "user",
              },
            ];
            continue;
          }
          wordProtocolRetries = 0;
          controller.enqueue(encodeStepEvent(encoder, pass.stepId, "tool"));

          const assistantToolMessage: OpenAIChatMessage = {
            content: pass.assistantContent || null,
            role: "assistant",
            tool_calls: executableToolCalls,
            ...(preserveReasoning ? { reasoning_content: pass.assistantReasoning } : {}),
          };
          const toolResultMessages: OpenAIChatMessage[] = [];

          for (const toolCall of executableToolCalls) {
            signal?.throwIfAborted();
            const builtinTool = getBuiltinToolByFunction(toolCall.function.name);
            if (builtinTool && toolRuntime) {
              let args: Record<string, unknown> = {};
              try {
                const parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
                if (parsedArgs && typeof parsedArgs === "object") {
                  args = parsedArgs as Record<string, unknown>;
                }
              } catch {
                // The executor will surface required-argument errors in a consistent format.
              }
              const runningState = {
                artifactId: typeof args.documentId === "string" ? args.documentId : undefined,
                callId: toolCall.id,
                status: "running" as const,
                toolId: builtinTool.id,
                toolName: toolCall.function.name,
              };
              controller.enqueue(encodeGeneratedFileEvent(encoder, runningState));

              const chartAttempt =
                toolRuntime.debugChartAttempts && toolCall.function.name === "render_echarts_chart"
                  ? { index: ++chartAttemptIndex, raw: toolCall.function.arguments }
                  : undefined;
              try {
                const result = await executeBuiltinTool(toolCall.function.name, args, {
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
                  requiredWordToolNames =
                    getWordContinuationToolNames(toolCall.function.name, result.content) || [];
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
                toolResultMessages.push({
                  content: JSON.stringify(result.content),
                  role: "tool",
                  tool_call_id: toolCall.id,
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
                toolResultMessages.push({
                  content: JSON.stringify({ error: message, success: false }),
                  role: "tool",
                  tool_call_id: toolCall.id,
                });
              }
              continue;
            }

            if (webSearchEnabled && WEB_TOOL_NAMES.has(toolCall.function.name)) {
              let args: Record<string, unknown> = {};
              try {
                args = JSON.parse(toolCall.function.arguments || "{}");
              } catch {
                /* Surface validation through the tool result. */
              }
              const result = await webTools.execute(
                toolCall.function.name,
                args || {},
                toolCall.id,
                (state) => controller.enqueue(encodeToolEvent(encoder, state)),
              );
              toolResultMessages.push({
                content: formatToolResultForModel(result, toolResultMaxChars),
                role: "tool",
                tool_call_id: toolCall.id,
              });
            }
          }

          currentMessages = [...currentMessages, assistantToolMessage, ...toolResultMessages];
        }

        if (latestUsage) {
          controller.enqueue(encodeUsageEvent(encoder, latestUsage));
        }
        signal?.throwIfAborted();
        if (availableTools.length) controller.enqueue(encodeCompletionEvent(encoder, finalStepId));
        controller.close();
      } catch (error) {
        console.error("OpenAI compatible chat error:", error);
        controller.enqueue(
          encodeStreamEvent(new TextEncoder(), "error", describeGenerationError(error, [apiKey])),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      ...getContextHeaders(contextPreparation),
    },
  });
};
