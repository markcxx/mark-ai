import { NextResponse } from "next/server";

import type { ContextPreparation } from "@/lib/chat/context-window";
import { estimateTextTokens } from "@/lib/chat/metrics";
import {
  formatToolResultForModel,
  getChoiceText,
  getToolSearchQuery,
  getToolWebpageUrl,
  isUnsupportedStreamUsageError,
  normalizeToolCalls,
  toOpenAIChatEndpoint,
  toOpenAIMessages,
} from "@/lib/chat/server/openai-helpers";
import { READ_WEBPAGE_TOOL, WEB_SEARCH_TOOL } from "@/lib/chat/server/runtime-prompt";
import {
  ThinkingTagStreamParser,
  type ThinkingTagStreamEvent,
} from "@/lib/chat/server/thinking-tag-stream";
import {
  encodeGeneratedFileEvent,
  encodeStreamEvent,
  encodeToolEvent,
  encodeUsageEvent,
  getContextHeaders,
} from "@/lib/chat/server/stream-protocol";
import type { ChatMessage, OpenAIChatMessage, OpenAIToolCall } from "@/lib/chat/server/types";
import {
  addTokenUsage,
  getUsageNumber,
  resolveTokenUsage,
  type ResolvedTokenUsage,
  type TokenUsage,
} from "@/lib/chat/token-usage";
import type { WebSearchState } from "@/lib/chat/types";
import { searchTavily } from "@/lib/search/tavily";
import { readWebpage } from "@/lib/search/webpage";
import { executeBuiltinTool } from "@/lib/tools/executors";
import { getBuiltinToolByFunction, getToolFunctions } from "@/lib/tools/registry";

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
    sessionId: string;
    skillPrompt?: string;
    userId: string;
  },
) => {
  const endpoint = toOpenAIChatEndpoint(baseUrl);
  if (!endpoint) {
    return NextResponse.json({ error: "模型接口地址尚未配置" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const toolResultMaxChars = contextPreparation
    ? Math.min(18_000, Math.max(2000, Math.floor(contextPreparation.inputBudgetTokens * 0.4)))
    : 18_000;
  const openAIMessages = toOpenAIMessages({
    messages,
    skillPrompt: toolRuntime?.skillPrompt,
    timezone,
    webSearchEnabled,
  });
  const builtinFunctions = getToolFunctions(toolRuntime?.enabledToolIds || []);
  const availableTools = [
    ...(webSearchEnabled ? [WEB_SEARCH_TOOL, READ_WEBPAGE_TOOL] : []),
    ...builtinFunctions.map((toolFunction) => ({ function: toolFunction, type: "function" })),
  ];
  const allowedToolNames = new Set(availableTools.map((tool) => tool.function.name));

  const stream = new ReadableStream({
    async start(controller) {
      const citationIdsByUrl = new Map<string, number>();
      let nextCitationId = 1;

      const assignCitationIds = (results: WebSearchState["results"]) =>
        results.map((result) => {
          const key = result.url.trim();
          let citationId = citationIdsByUrl.get(key);
          if (!citationId) {
            citationId = nextCitationId;
            nextCitationId += 1;
            citationIdsByUrl.set(key, citationId);
          }
          return { ...result, citationId };
        });

      const requestUpstream = async (requestMessages: OpenAIChatMessage[], allowTools: boolean) => {
        const usageCapabilityKey = `${endpoint}\n${model}`;
        const createRequestBody = (includeUsage: boolean) => ({
          messages: requestMessages,
          model,
          stream: true,
          ...(includeUsage ? { stream_options: { include_usage: true } } : {}),
          ...(allowTools
            ? {
                tool_choice: "auto",
                tools: availableTools,
              }
            : {}),
        });
        const sendRequest = (includeUsage: boolean) =>
          fetch(endpoint, {
            body: JSON.stringify(createRequestBody(includeUsage)),
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            method: "POST",
            signal,
          });

        const includeUsage = !unsupportedStreamUsage.has(usageCapabilityKey);
        let upstream = await sendRequest(includeUsage);

        if (!upstream.ok) {
          const detail = await upstream.text();
          if (includeUsage && isUnsupportedStreamUsageError(upstream.status, detail)) {
            unsupportedStreamUsage.add(usageCapabilityKey);
            upstream = await sendRequest(false);
          } else {
            throw new Error(detail || "Upstream model request failed");
          }
        }

        if (!upstream.ok) {
          const detail = await upstream.text();
          throw new Error(detail || "Upstream model request failed");
        }

        if (!upstream.body) {
          throw new Error("模型服务未返回可读取的响应");
        }

        return upstream.body.getReader();
      };

      const estimateOpenAIInputTokens = (
        requestMessages: OpenAIChatMessage[],
        allowTools: boolean,
      ) =>
        estimateTextTokens(
          JSON.stringify({
            messages: requestMessages,
            ...(allowTools
              ? {
                  tool_choice: "auto",
                  tools: availableTools,
                }
              : {}),
          }),
        );

      const streamModelResponse = async (
        requestMessages: OpenAIChatMessage[],
        allowTools: boolean,
      ) => {
        const reader = await requestUpstream(requestMessages, allowTools);
        const decoder = new TextDecoder();
        const toolCallsByIndex = new Map<number, OpenAIToolCall>();
        let assistantContent = "";
        let assistantReasoning = "";
        let buffer = "";
        let providerUsage: TokenUsage | undefined;
        let thinkingParsersFinished = false;
        const thinkingParsers = new Map<number, ThinkingTagStreamParser>();

        const emitTextEvent = (event: ThinkingTagStreamEvent) => {
          if (!event.text) return;
          if (event.type === "reasoning") assistantReasoning += event.text;
          else assistantContent += event.text;
          controller.enqueue(encodeStreamEvent(encoder, event.type, event.text));
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
          const toolCalls = normalizeToolCalls([...toolCallsByIndex.values()]);
          return {
            assistantContent,
            toolCalls,
            usage: resolveTokenUsage({
              estimatedInputTokens: estimateOpenAIInputTokens(requestMessages, allowTools),
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
          if (!data || data === "[DONE]") return data === "[DONE]";

          try {
            handleParsedEvent(JSON.parse(data));
          } catch {
            // Some compatible providers send comments or metadata lines in the SSE stream.
          }

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
        const MAX_TOOL_ROUNDS = 5;
        let currentMessages = openAIMessages;
        let cumulativeUsage: ResolvedTokenUsage | undefined;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const pass = await streamModelResponse(currentMessages, availableTools.length > 0);
          cumulativeUsage = addTokenUsage(cumulativeUsage, pass.usage);
          const executableToolCalls = pass.toolCalls.filter((toolCall) =>
            allowedToolNames.has(toolCall.function.name),
          );

          if (executableToolCalls.length === 0) break;

          const assistantToolMessage: OpenAIChatMessage = {
            content: pass.assistantContent || null,
            role: "assistant",
            tool_calls: executableToolCalls,
          };
          const toolResultMessages: OpenAIChatMessage[] = [];

          for (const toolCall of executableToolCalls) {
            const builtinTool = getBuiltinToolByFunction(toolCall.function.name);
            if (builtinTool && toolRuntime) {
              const runningState = {
                callId: toolCall.id,
                status: "running" as const,
                toolId: builtinTool.id,
                toolName: toolCall.function.name,
              };
              controller.enqueue(encodeGeneratedFileEvent(encoder, runningState));

              try {
                const parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
                const args =
                  parsedArgs && typeof parsedArgs === "object"
                    ? (parsedArgs as Record<string, unknown>)
                    : {};
                const result = await executeBuiltinTool(toolCall.function.name, args, {
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
                toolResultMessages.push({
                  content: JSON.stringify(result.content),
                  role: "tool",
                  tool_call_id: toolCall.id,
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
                toolResultMessages.push({
                  content: JSON.stringify({ error: message, success: false }),
                  role: "tool",
                  tool_call_id: toolCall.id,
                });
              }
              continue;
            }

            if (toolCall.function.name === "read_webpage") {
              const url = getToolWebpageUrl(toolCall);
              const readingState: WebSearchState = {
                query: url,
                results: [],
                status: "searching",
                tool: "read_webpage",
                url,
              };
              controller.enqueue(encodeToolEvent(encoder, readingState));

              try {
                const result = await readWebpage({ signal, url });
                const doneState: WebSearchState = {
                  completedAt: Date.now(),
                  content: result.content,
                  costTime: result.costTime,
                  description: result.description,
                  query: result.url,
                  results: assignCitationIds([
                    {
                      content: result.description || result.content.slice(0, 600),
                      favicon: result.favicon,
                      title: result.title,
                      url: result.url,
                    },
                  ]),
                  siteName: result.siteName,
                  status: "done",
                  title: result.title,
                  tool: "read_webpage",
                  url: result.url,
                };
                controller.enqueue(encodeToolEvent(encoder, doneState));
                toolResultMessages.push({
                  content: formatToolResultForModel(doneState, toolResultMaxChars),
                  role: "tool",
                  tool_call_id: toolCall.id,
                });
              } catch (error) {
                const errorState: WebSearchState = {
                  completedAt: Date.now(),
                  error: error instanceof Error ? error.message : "网页读取失败",
                  query: url,
                  results: [],
                  status: "error",
                  tool: "read_webpage",
                  url,
                };
                controller.enqueue(encodeToolEvent(encoder, errorState));
                toolResultMessages.push({
                  content: formatToolResultForModel(errorState, toolResultMaxChars),
                  role: "tool",
                  tool_call_id: toolCall.id,
                });
              }
              continue;
            }

            const query = getToolSearchQuery(toolCall);
            const searchingState: WebSearchState = {
              query,
              results: [],
              status: "searching",
              tool: "web_search",
            };
            controller.enqueue(encodeToolEvent(encoder, searchingState));

            try {
              const result = await searchTavily({ query, signal });
              const doneState: WebSearchState = {
                answer: result.answer,
                completedAt: Date.now(),
                costTime: result.costTime,
                query: result.query,
                results: assignCitationIds(result.results),
                status: "done",
                tool: "web_search",
              };
              controller.enqueue(encodeToolEvent(encoder, doneState));
              toolResultMessages.push({
                content: formatToolResultForModel(doneState, toolResultMaxChars),
                role: "tool",
                tool_call_id: toolCall.id,
              });
            } catch (error) {
              const errorState: WebSearchState = {
                completedAt: Date.now(),
                error: error instanceof Error ? error.message : "联网搜索失败",
                query,
                results: [],
                status: "error",
                tool: "web_search",
              };
              controller.enqueue(encodeToolEvent(encoder, errorState));
              toolResultMessages.push({
                content: formatToolResultForModel(errorState, toolResultMaxChars),
                role: "tool",
                tool_call_id: toolCall.id,
              });
            }
          }

          currentMessages = [...currentMessages, assistantToolMessage, ...toolResultMessages];
        }

        if (cumulativeUsage) {
          controller.enqueue(encodeUsageEvent(encoder, cumulativeUsage));
        }
        controller.close();
      } catch (error) {
        console.error("OpenAI compatible chat error:", error);
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
};
