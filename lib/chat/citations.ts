import type { Message, WebSearchResult, WebSearchState } from "@/lib/chat/types";

export type WebCitation = WebSearchResult & {
  citationId: number;
  structured: boolean;
};

const getSearchStates = (message: Message): WebSearchState[] => {
  const segmentStates = (message.segments || [])
    .filter((segment) => segment.type === "tool")
    .map((segment) => segment.webSearch);

  return segmentStates.length > 0 ? segmentStates : message.webSearch || [];
};

export const collectMessageCitations = (message: Message): WebCitation[] => {
  const results = getSearchStates(message).flatMap((state) => state.results || []);
  const maxStructuredId = results.reduce(
    (max, result) =>
      typeof result.citationId === "number" && result.citationId > 0
        ? Math.max(max, result.citationId)
        : max,
    0,
  );
  let nextFallbackId = maxStructuredId + 1;
  const byUrl = new Map<string, WebCitation>();

  for (const result of results) {
    const url = result.url.trim();
    if (!url) continue;

    const existing = byUrl.get(url);
    const structured = typeof result.citationId === "number" && result.citationId > 0;
    const citationId = structured ? result.citationId! : existing?.citationId || nextFallbackId++;

    byUrl.set(url, {
      ...existing,
      ...result,
      citationId,
      content: result.content || existing?.content,
      favicon: result.favicon || existing?.favicon,
      publishedDate: result.publishedDate || existing?.publishedDate,
      structured: structured || existing?.structured || false,
      url,
    });
  }

  return [...byUrl.values()].sort((a, b) => a.citationId - b.citationId);
};
