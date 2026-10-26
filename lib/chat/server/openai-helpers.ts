import type { WebSearchState } from "@/lib/chat/types";
import { contentWithWebContext } from "@/lib/chat/web-context";

import { getRuntimeSystemPrompt } from "./runtime-prompt";
import type { ChatMessage, OpenAIChatMessage, OpenAIToolCall } from "./types";

export const toOpenAIChatEndpoint = (baseUrl?: string) => {
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

export const getChoiceText = (choice: any, fields: string[]) => {
  for (const source of [choice?.delta, choice?.message, choice]) {
    for (const field of fields) {
      const text = getTextValue(source?.[field]);
      if (text) return text;
    }
  }

  return "";
};

export const isUnsupportedStreamUsageError = (status: number, detail: string) =>
  [400, 404, 422].includes(status) &&
  /stream[_ ]options|include[_ ]usage/i.test(detail) &&
  /unsupported|not support|unknown|unrecognized|unexpected|invalid|extra|not permitted|not allowed|不支持/i.test(
    detail,
  );

export const toOpenAIMessages = ({
  messages,
  preserveReasoning = false,
  skillPrompt,
  timezone,
  webSearchEnabled,
}: {
  messages: ChatMessage[];
  preserveReasoning?: boolean;
  skillPrompt?: string;
  timezone?: unknown;
  webSearchEnabled: boolean;
}): OpenAIChatMessage[] => {
  const openAIMessages = messages.map((message): OpenAIChatMessage => {
    const imageInputs = message.role === "user" ? message.imageInputs || [] : [];
    return {
      content:
        imageInputs.length > 0
          ? [
              { text: contentWithWebContext(message) || "请识别并说明图片内容。", type: "text" },
              ...imageInputs.map((image) => ({
                image_url: {
                  url: `data:${image.mediaType};base64,${image.data}`,
                },
                type: "image_url" as const,
              })),
            ]
          : contentWithWebContext(message),
      role: message.role === "model" ? "assistant" : message.role,
      ...(preserveReasoning && (message.role === "model" || message.role === "assistant")
        ? { reasoning_content: message.reasoning || "" }
        : {}),
    };
  });

  return [
    {
      content: getRuntimeSystemPrompt({ skillPrompt, timezone, webSearchEnabled }),
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

export const getToolSearchQuery = (toolCall: OpenAIToolCall) => {
  const args = tryParseToolArgs(toolCall.function.arguments);
  const query = typeof args.query === "string" ? args.query.trim() : "";
  return query || toolCall.function.arguments.trim();
};

export const getToolWebpageUrl = (toolCall: OpenAIToolCall) => {
  const args = tryParseToolArgs(toolCall.function.arguments);
  const url = typeof args.url === "string" ? args.url.trim() : "";
  return url || toolCall.function.arguments.trim();
};

export const formatToolResultForModel = (webSearch: WebSearchState, maxChars = 18_000) => {
  const payload = {
    content_kind: webSearch.contentKind,
    page: webSearch.page,
    images: webSearch.images?.map(({ id, title, url, sourceUrl, description }) => ({
      id,
      title,
      url,
      sourceUrl,
      description,
    })),
    links: webSearch.links,
    untrusted_external_content: true,
    next_action:
      webSearch.contentKind === "search_snippets"
        ? "For a specific page, detailed evidence or information absent from snippets, call read_webpage on a returned URL."
        : webSearch.page?.nextLine
          ? "More content is available: continue with read_webpage(start_line=nextLine), or find_in_page for a specific detail."
          : undefined,
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
  };
  const content = JSON.stringify(payload);
  if (content.length <= maxChars) return content;

  const resultContentChars = Math.max(
    160,
    Math.floor(maxChars / Math.max(webSearch.results.length * 3, 3)),
  );
  const compact = JSON.stringify({
    ...payload,
    answer: webSearch.answer?.slice(0, Math.floor(maxChars / 5)),
    content: webSearch.content?.slice(0, Math.floor(maxChars / 3)),
    results: webSearch.results.slice(0, 8).map((item) => ({
      citationId: item.citationId,
      content: item.content?.slice(0, resultContentChars),
      title: item.title,
      url: item.url,
    })),
    truncated: true,
    page: webSearch.page && { ...webSearch.page, nextLine: webSearch.page.startLine },
  });
  if (compact.length <= maxChars) return compact;

  const minimal = {
    content_kind: webSearch.contentKind,
    images:
      webSearch.images?.slice(0, 6).map(({ id, title }) => ({ id, title: title.slice(0, 100) })) ||
      [],
    page: webSearch.page && { ...webSearch.page, nextLine: webSearch.page.startLine },
    untrusted_external_content: true,
    next_action:
      "Response truncated. Use find_in_page for a specific detail or read_webpage with a smaller max_lines. Image IDs remain usable with show_images.",
    query: webSearch.query.slice(0, 300),
    results: webSearch.results.slice(0, 4).map((item) => ({
      citationId: item.citationId,
      title: item.title.slice(0, 100),
      url: item.url.slice(0, 2048),
    })),
    status: webSearch.status,
    tool: webSearch.tool,
    truncated: true,
    url: webSearch.url?.slice(0, 2048),
    error: webSearch.error?.slice(0, 300),
  };
  while (JSON.stringify(minimal).length > maxChars && minimal.results.length) minimal.results.pop();
  while (JSON.stringify(minimal).length > maxChars && minimal.images.length) minimal.images.pop();
  if (JSON.stringify(minimal).length > maxChars) {
    minimal.url = undefined;
    minimal.query = "";
  }
  return JSON.stringify(minimal);
};

export const normalizeToolCalls = (toolCalls: OpenAIToolCall[]) =>
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
