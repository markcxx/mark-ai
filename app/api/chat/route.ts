import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { findAvailableModel } from "@/lib/available-models";
import { estimateTextTokens } from "@/lib/chat/metrics";
import { searchTavily } from "@/lib/search/tavily";
import { readWebpage } from "@/lib/search/webpage";
import type { FileAttachment, TokenUsageSource, WebSearchState } from "@/lib/chat/types";
import { injectFileContexts } from "@/lib/storage/file-context";

type ChatMessage = {
  attachments?: FileAttachment[];
  content: string;
  role: "user" | "model" | "assistant" | "system";
};

type OpenAIChatMessage = {
  content: string | null;
  role: "system" | "user" | "assistant" | "tool";
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
};

type OpenAIToolCall = {
  function: {
    arguments: string;
    name: string;
  };
  id: string;
  type: "function";
};

type StreamEventType = "content" | "reasoning";

type UsagePayload = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  tokenUsageSource?: TokenUsageSource;
};

type ResolvedUsage = Required<Omit<UsagePayload, "tokenUsageSource">> & {
  tokenUsageSource: TokenUsageSource;
};

const MAX_CHAT_MESSAGES = 200;
const MAX_CHAT_MESSAGE_CHARS = 200_000;
const MAX_CHAT_PAYLOAD_BYTES = 2_000_000;
const unsupportedStreamUsage = new Set<string>();

const WEB_SEARCH_TOOL = {
  function: {
    description:
      "Search the public web for fresh, current, or externally verifiable information. Use this only when the answer needs information beyond the conversation or your internal knowledge.",
    name: "web_search",
    parameters: {
      additionalProperties: false,
      properties: {
        query: {
          description:
            "A concise search query in the same language as the user question when possible.",
          type: "string",
        },
      },
      required: ["query"],
      type: "object",
    },
  },
  type: "function",
} as const;

const READ_WEBPAGE_TOOL = {
  function: {
    description:
      "Read and extract visible text content from a specific public webpage URL. Use this when the user gives a URL or when search results need deeper inspection.",
    name: "read_webpage",
    parameters: {
      additionalProperties: false,
      properties: {
        url: {
          description: "The public http/https URL to read.",
          type: "string",
        },
      },
      required: ["url"],
      type: "object",
    },
  },
  type: "function",
} as const;

const WEB_SEARCH_SYSTEM_PROMPT =
  "联网工具可用：web_search 用于搜索公开网页，read_webpage 用于读取具体公开网页 URL。只有当用户问题需要实时信息、外部事实核验、最新资料、明确要求联网，或用户提供 URL 需要阅读时才调用；普通推理、写作、翻译、代码解释不要调用。工具结果中的 citationId 是可信来源编号；凡是依据工具来源陈述的事实，都应在对应句子后使用 [citationId] 标注，例如 [1]。只能引用工具实际返回的编号，不要自行编造编号或 URL。";

const getSafeTimeZone = (timezone?: unknown) => {
  const candidate =
    typeof timezone === "string" && timezone.trim() ? timezone.trim() : "Asia/Shanghai";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
};

const getDatePart = (date: Date, timezone: string, part: Intl.DateTimeFormatPartTypes) =>
  new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  })
    .formatToParts(date)
    .find((item) => item.type === part)?.value || "";

const getCurrentDatePrompt = (timezone?: unknown) => {
  const tz = getSafeTimeZone(timezone);
  const now = new Date();
  const year = getDatePart(now, tz, "year");
  const month = getDatePart(now, tz, "month");
  const day = getDatePart(now, tz, "day");
  return `Current date: ${year}-${month}-${day} (${tz})`;
};

const getRuntimeSystemPrompt = ({
  timezone,
  webSearchEnabled,
}: {
  timezone?: unknown;
  webSearchEnabled: boolean;
}) =>
  [getCurrentDatePrompt(timezone), webSearchEnabled ? WEB_SEARCH_SYSTEM_PROMPT : ""]
    .filter(Boolean)
    .join("\n\n");

const toOpenAIChatEndpoint = (baseUrl?: string) => {
  if (!baseUrl) return undefined;

  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
};

const getTextValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (!Array.isArray(value)) return "";

  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "text" in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("");
};

const getChoiceText = (choice: any, fields: string[]) => {
  for (const source of [choice?.delta, choice?.message, choice]) {
    for (const field of fields) {
      const text = getTextValue(source?.[field]);
      if (text) return text;
    }
  }

  return "";
};

const encodeStreamEvent = (encoder: TextEncoder, type: StreamEventType, text: string) =>
  encoder.encode(`${JSON.stringify({ type, text })}\n`);

const encodeUsageEvent = (encoder: TextEncoder, usage: UsagePayload) =>
  encoder.encode(`${JSON.stringify({ type: "usage", ...usage })}\n`);

const getUsageNumber = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === "number" && Number.isFinite(item));
  return typeof value === "number" ? Math.max(0, Math.round(value)) : undefined;
};

const resolveUsage = ({
  estimatedInputTokens,
  estimatedOutputTokens,
  providerUsage,
}: {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  providerUsage?: UsagePayload;
}): ResolvedUsage => {
  let inputTokens = getUsageNumber(providerUsage?.inputTokens);
  let outputTokens = getUsageNumber(providerUsage?.outputTokens);
  const providerTotalTokens = getUsageNumber(providerUsage?.totalTokens);

  if (
    inputTokens === undefined &&
    outputTokens !== undefined &&
    providerTotalTokens !== undefined
  ) {
    inputTokens = Math.max(providerTotalTokens - outputTokens, 0);
  }
  if (
    outputTokens === undefined &&
    inputTokens !== undefined &&
    providerTotalTokens !== undefined
  ) {
    outputTokens = Math.max(providerTotalTokens - inputTokens, 0);
  }

  const isProviderUsage = inputTokens !== undefined && outputTokens !== undefined;
  const resolvedInputTokens = inputTokens ?? estimatedInputTokens;
  const resolvedOutputTokens = outputTokens ?? estimatedOutputTokens;

  return {
    inputTokens: resolvedInputTokens,
    outputTokens: resolvedOutputTokens,
    tokenUsageSource: isProviderUsage ? "provider" : "estimated",
    totalTokens: providerTotalTokens ?? resolvedInputTokens + resolvedOutputTokens,
  };
};

const addUsage = (current: ResolvedUsage | undefined, next: ResolvedUsage): ResolvedUsage => ({
  inputTokens: (current?.inputTokens || 0) + next.inputTokens,
  outputTokens: (current?.outputTokens || 0) + next.outputTokens,
  tokenUsageSource:
    !current || (current.tokenUsageSource === "provider" && next.tokenUsageSource === "provider")
      ? next.tokenUsageSource
      : "estimated",
  totalTokens: (current?.totalTokens || 0) + next.totalTokens,
});

const isUnsupportedStreamUsageError = (status: number, detail: string) =>
  [400, 404, 422].includes(status) &&
  /stream[_ ]options|include[_ ]usage/i.test(detail) &&
  /unsupported|not support|unknown|unrecognized|unexpected|invalid|extra|not permitted|not allowed|不支持/i.test(
    detail,
  );

const encodeToolEvent = (encoder: TextEncoder, webSearch: WebSearchState) =>
  encoder.encode(`${JSON.stringify({ type: "tool", webSearch })}\n`);

const toOpenAIMessages = ({
  messages,
  timezone,
  webSearchEnabled,
}: {
  messages: ChatMessage[];
  timezone?: unknown;
  webSearchEnabled: boolean;
}): OpenAIChatMessage[] => {
  const openAIMessages = messages.map((message) => ({
    content: message.content,
    role: message.role === "model" ? "assistant" : message.role,
  })) as OpenAIChatMessage[];

  return [
    {
      content: getRuntimeSystemPrompt({ timezone, webSearchEnabled }),
      role: "system",
    },
    ...openAIMessages,
  ];
};

const tryParseToolArgs = (value: string) => {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const getToolSearchQuery = (toolCall: OpenAIToolCall) => {
  const args = tryParseToolArgs(toolCall.function.arguments);
  const query = typeof args.query === "string" ? args.query.trim() : "";
  return query || toolCall.function.arguments.trim();
};

const getToolWebpageUrl = (toolCall: OpenAIToolCall) => {
  const args = tryParseToolArgs(toolCall.function.arguments);
  const url = typeof args.url === "string" ? args.url.trim() : "";
  return url || toolCall.function.arguments.trim();
};

const formatToolResultForModel = (webSearch: WebSearchState) =>
  JSON.stringify({
    answer: webSearch.answer,
    content: webSearch.content,
    description: webSearch.description,
    error: webSearch.error,
    query: webSearch.query,
    results: webSearch.results.slice(0, 8).map((item) => ({
      citationId: item.citationId,
      content: item.content,
      title: item.title,
      url: item.url,
    })),
    siteName: webSearch.siteName,
    status: webSearch.status,
    title: webSearch.title,
    tool: webSearch.tool,
    url: webSearch.url,
  });

const normalizeToolCalls = (toolCalls: OpenAIToolCall[]) =>
  toolCalls
    .filter((toolCall) => toolCall.id && toolCall.function.name)
    .map((toolCall) => ({
      function: {
        arguments: toolCall.function.arguments || "{}",
        name: toolCall.function.name,
      },
      id: toolCall.id,
      type: "function" as const,
    }));

const createOpenAICompatibleStream = async (
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  baseUrl?: string,
  webSearchEnabled = false,
  timezone?: unknown,
  signal?: AbortSignal,
) => {
  const endpoint = toOpenAIChatEndpoint(baseUrl);
  if (!endpoint) {
    return NextResponse.json({ error: "Model base URL is not configured" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const openAIMessages = toOpenAIMessages({
    messages,
    timezone,
    webSearchEnabled,
  });

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
                tools: [WEB_SEARCH_TOOL, READ_WEBPAGE_TOOL],
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
          throw new Error("No upstream response body");
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
                  tools: [WEB_SEARCH_TOOL, READ_WEBPAGE_TOOL],
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
        let providerUsage: UsagePayload | undefined;

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

          for (const choice of choices) {
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
              assistantReasoning += reasoning;
              controller.enqueue(encodeStreamEvent(encoder, "reasoning", reasoning));
            }
            if (content) {
              assistantContent += content;
              controller.enqueue(encodeStreamEvent(encoder, "content", content));
            }
            if (Array.isArray(deltaToolCalls)) {
              deltaToolCalls.forEach(appendToolCall);
            }
          }
        };

        const getPassResult = () => {
          const toolCalls = normalizeToolCalls([...toolCallsByIndex.values()]);
          return {
            assistantContent,
            toolCalls,
            usage: resolveUsage({
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
        let cumulativeUsage: ResolvedUsage | undefined;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const pass = await streamModelResponse(currentMessages, webSearchEnabled);
          cumulativeUsage = addUsage(cumulativeUsage, pass.usage);
          const executableToolCalls = pass.toolCalls.filter((toolCall) =>
            ["web_search", "read_webpage"].includes(toolCall.function.name),
          );

          if (executableToolCalls.length === 0) break;

          const assistantToolMessage: OpenAIChatMessage = {
            content: pass.assistantContent || null,
            role: "assistant",
            tool_calls: executableToolCalls,
          };
          const toolResultMessages: OpenAIChatMessage[] = [];

          for (const toolCall of executableToolCalls) {
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
                  content: formatToolResultForModel(doneState),
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
                  content: formatToolResultForModel(errorState),
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
                content: formatToolResultForModel(doneState),
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
                content: formatToolResultForModel(errorState),
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
    },
  });
};

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorizeApiRequest(req);
    if (!authorization.authorized) return authorization.response;
    const limited = enforceRateLimit({ key: authorization.key, limit: 30, scope: "chat" });
    if (limited) return limited;

    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_CHAT_PAYLOAD_BYTES) {
      return NextResponse.json({ error: "Chat payload is too large" }, { status: 413 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { messages, model, provider, timezone, webSearchEnabled } = body;
    const selectedModel = await findAvailableModel(model, provider, authorization.userId);

    if (!selectedModel) {
      return NextResponse.json({ error: "Model is not configured" }, { status: 400 });
    }

    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > MAX_CHAT_MESSAGES ||
      !messages.every(
        (message) =>
          message &&
          typeof message === "object" &&
          (message.role === "user" || message.role === "model") &&
          typeof message.content === "string" &&
          message.content.length <= MAX_CHAT_MESSAGE_CHARS &&
          (!message.attachments ||
            (Array.isArray(message.attachments) &&
              message.attachments.length <= 4 &&
              message.attachments.every(
                (file: unknown) =>
                  file &&
                  typeof file === "object" &&
                  typeof (file as FileAttachment).id === "string",
              ))),
      )
    ) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    const resolvedMessages = authorization.userId
      ? await injectFileContexts(messages as ChatMessage[], authorization.userId)
      : (messages as ChatMessage[]);

    if (selectedModel.runtime === "openai-compatible") {
      return createOpenAICompatibleStream(
        resolvedMessages,
        selectedModel.id,
        selectedModel.apiKey,
        selectedModel.baseUrl,
        Boolean(webSearchEnabled),
        timezone,
        req.signal,
      );
    }

    const ai = new GoogleGenAI({
      apiKey: selectedModel.apiKey,
      ...(selectedModel.baseUrl ? { httpOptions: { baseUrl: selectedModel.baseUrl } } : {}),
    });

    const prompt = resolvedMessages[resolvedMessages.length - 1].content;
    const runtimeSystemPrompt = getRuntimeSystemPrompt({
      timezone,
      webSearchEnabled: false,
    });
    const history = resolvedMessages.slice(0, -1).map((message: ChatMessage) => ({
      parts: [{ text: message.content }],
      role: message.role === "model" ? "model" : "user",
    }));

    const contents = [
      { role: "user", parts: [{ text: runtimeSystemPrompt }] },
      { role: "model", parts: [{ text: "了解。" }] },
      ...history,
      { role: "user", parts: [{ text: prompt }] },
    ];
    const responseStream = await ai.models.generateContentStream({
      contents,
      model: selectedModel.id,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let outputText = "";
        let providerUsage: UsagePayload | undefined;

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
            resolveUsage({
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
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
