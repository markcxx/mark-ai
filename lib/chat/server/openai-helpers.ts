import type { WebSearchState } from "@/lib/chat/types";
import { contentWithWebContext } from "@/lib/chat/web-context";

import { getRuntimeSystemPrompt } from "./runtime-prompt";
import type { ChatMessage, OpenAIChatMessage, OpenAIToolCall } from "./types";

// Character limits, not token estimates: shared by all model protocols.
export const WEB_TOOL_RESULT_MAX_CHARS = 8_000;
export const WEB_TOOL_HISTORY_MAX_CHARS = 48_000;

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
  personalization,
  messages,
  preserveReasoning = false,
  skillPrompt,
  timezone,
  webSearchEnabled,
}: {
  personalization?: unknown;
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
      content: getRuntimeSystemPrompt({ skillPrompt, timezone, webSearchEnabled, personalization }),
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

/** Reduce metadata before evidence; any discarded text is explicitly marked. */
export function fitWebToolPayload(payload: Record<string, any>, maxChars: number): string {
  const copy = structuredClone(payload);
  const encoded = () => JSON.stringify(copy);
  if (encoded().length <= maxChars) return encoded();
  copy.truncated = true;
  delete copy.links;
  delete copy.description;
  delete copy.siteName;
  // Placement guidance is also in the system prompt; preserve image context first.
  if (copy.image_display) delete copy.image_display.guidance;
  if (copy.images)
    copy.images = copy.images.map((image: any) => ({
      id: image.id,
      title: image.title?.slice(0, 100),
      description: image.description?.slice(0, 160),
    }));
  // Keep page coordinates truthful after shortening the evidence window.
  const trimContent = (limit: number) => {
    if (typeof copy.content !== "string" || copy.content.length <= limit) return;
    const numbered = copy.page && /^\d+: /.test(copy.content);
    let text = copy.content.slice(0, limit);
    if (numbered) {
      text = text.slice(0, Math.max(0, text.lastIndexOf("\n")));
      const last = text.match(/(?:^|\n)(\d+): [^\n]*$/);
      copy.page = {
        ...copy.page,
        truncated: true,
        endLine: last ? Number(last[1]) : copy.page.startLine - 1,
        nextLine: last ? Number(last[1]) + 1 : copy.page.startLine,
      };
    }
    copy.content = text;
  };
  if (encoded().length > maxChars) {
    const count = Math.max(1, copy.results?.length || 0);
    copy.results = copy.results?.map((item: any) => ({
      ...item,
      content: item.content?.slice(0, Math.max(80, Math.floor(maxChars / (count * 3)))),
    }));
    trimContent(Math.floor(maxChars * 0.55));
  }
  if (encoded().length > maxChars) {
    delete copy.images;
    delete copy.image_display;
    delete copy.query;
    delete copy.title;
    copy.results = copy.results?.map((item: any) => ({
      citationId: item.citationId,
      title: item.title?.slice(0, 100),
      url: item.url,
      publishedDate: item.publishedDate,
    }));
    trimContent(Math.floor(maxChars * 0.3));
  }
  while (encoded().length > maxChars && copy.results?.length > 1) copy.results.pop();
  if (encoded().length > maxChars) {
    trimContent(0);
    delete copy.results;
    delete copy.url;
    delete copy.next_action;
    delete copy.error;
  }
  if (encoded().length > maxChars)
    return JSON.stringify({ tool: copy.tool, status: copy.status, context_compacted: true });
  return encoded();
}

export const formatToolResultForModel = (
  webSearch: WebSearchState,
  maxChars = WEB_TOOL_RESULT_MAX_CHARS,
) => {
  const images = webSearch.images || [];
  if (webSearch.tool === "show_images" && webSearch.status === "done") {
    return fitWebToolPayload(
      {
        tool: webSearch.tool,
        status: webSearch.status,
        image_ids: images.map(({ id }) => id),
        untrusted_external_content: true,
      },
      maxChars,
    );
  }
  const payload = {
    content_kind: webSearch.contentKind,
    untrusted_external_content: true,
    reader: webSearch.retrieval
      ? {
          requested_provider: webSearch.retrieval.requestedProvider,
          provider: webSearch.retrieval.provider,
          cached: webSearch.retrieval.cached || false,
        }
      : undefined,
    next_action:
      webSearch.status === "done" &&
      webSearch.contentKind === "search_snippets" &&
      webSearch.results.length > 0
        ? "Answer with citations if sufficient; read only for required missing evidence."
        : undefined,
    image_display:
      webSearch.status === "done" && images.length && webSearch.tool !== "show_images"
        ? {
            candidate_count: images.length,
            tool: "show_images",
          }
        : undefined,
    // The server owns image URLs; the model needs IDs and relevance metadata only.
    images: images.length
      ? images.map(({ id, title, description }) => ({
          id,
          title: title.slice(0, 100),
          description: description && description !== title ? description.slice(0, 160) : undefined,
        }))
      : undefined,
    page: webSearch.page,
    links: webSearch.links?.slice(0, 12),
    content: webSearch.content,
    error: webSearch.error,
    query: webSearch.tool === "web_search" ? webSearch.query.slice(0, 240) : undefined,
    results: webSearch.results.map((item) => ({
      citationId: item.citationId,
      content:
        webSearch.contentKind === "page" || webSearch.contentKind === "page_matches"
          ? undefined
          : item.content,
      title: item.title.slice(0, 160),
      url: item.url,
      publishedDate: item.publishedDate,
    })),
    status: webSearch.status,
    tool: webSearch.tool,
    url: webSearch.url,
  };
  return fitWebToolPayload(payload, maxChars);
};

/** Keep model context bounded without changing persisted evidence or tool protocol. */
export function compactWebToolHistory(
  entries: { content: string; replace: (value: string) => void }[],
  budget = WEB_TOOL_HISTORY_MAX_CHARS,
) {
  // Keep the newest copy of identical successful evidence. Persisted tool/UI
  // records are untouched; only the next model request uses these short markers.
  const seen = new Set<string>();
  entries = entries.map((entry) => ({ ...entry }));
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    try {
      const payload = JSON.parse(entry.content);
      if (
        !payload.untrusted_external_content ||
        payload.status !== "done" ||
        payload.context_compacted ||
        payload.tool === "show_images"
      )
        continue;
      const signature = JSON.stringify({ ...payload, reader: undefined });
      if (seen.has(signature)) {
        entry.content = JSON.stringify({
          tool: payload.tool,
          status: payload.status,
          url: payload.url,
          context_compacted: true,
          duplicate_result: true,
        });
        entry.replace(entry.content);
      } else seen.add(signature);
    } catch {
      /* Non-web payloads keep their original protocol. */
    }
  }
  let totalChars = entries.reduce((sum, entry) => sum + entry.content.length, 0);
  // Reclaim older evidence first. Dividing the budget across every call also
  // shrinks the newest excerpt, encouraging repeated reads of missing lines.
  for (const entry of entries) {
    if (totalChars <= budget) break;
    try {
      const payload = JSON.parse(entry.content);
      if (!payload.untrusted_external_content && !payload.context_compacted) continue;
      const allowance = Math.max(120, entry.content.length - (totalChars - budget));
      const compact = fitWebToolPayload({ ...payload, context_compacted: true }, allowance);
      if (compact.length >= entry.content.length) continue;
      totalChars -= entry.content.length - compact.length;
      entry.replace(compact);
    } catch {
      /* Leave non-web tool protocols untouched. */
    }
  }
}

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
