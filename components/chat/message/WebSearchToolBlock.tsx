import { ExternalLink, ScanText, Search } from "lucide-react";

import type { WebCitation } from "@/lib/chat/citations";
import type { WebSearchResult, WebSearchState } from "@/lib/chat/types";

import { SourceFavicon, SourcePopover } from "./MessageSources";
import { ToolCallDisclosure } from "./ToolCallDisclosure";

const toCitation = (result: WebSearchResult, fallbackId: number): WebCitation => ({
  ...result,
  citationId: result.citationId || fallbackId,
  structured: Boolean(result.citationId),
});

export function WebSearchToolBlockItem({ webSearch }: { webSearch: WebSearchState }) {
  const searching = webSearch.status === "searching";
  const failed = webSearch.status === "error";
  const done = webSearch.status === "done";
  const isWebpageRead = webSearch.tool === "read_webpage";
  const Icon = isWebpageRead ? ScanText : Search;
  const toolName = isWebpageRead ? "read_webpage" : "web_search";
  const toolLabel = isWebpageRead ? "网页读取" : "联网搜索";
  const argumentLabel = isWebpageRead ? "url:" : "query:";
  const argumentValue = isWebpageRead ? webSearch.url || webSearch.query : webSearch.query;
  const summaryLabel = searching
    ? isWebpageRead
      ? "正在读取网页"
      : "正在搜索网页"
    : failed
      ? `${toolLabel}调用失败`
      : isWebpageRead
        ? "已读取网页"
        : "已搜索网页";

  return (
    <ToolCallDisclosure
      icon={Icon}
      label={summaryLabel}
      status={searching ? "running" : failed ? "error" : "done"}
    >
      <div className="min-w-0 pl-4">
        <div className="flex min-w-0 items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="shrink-0 font-mono text-[11px] text-gray-400 dark:text-gray-500">
            {toolName}
          </span>
          <span className="h-3 w-px shrink-0 bg-gray-200 dark:bg-white/10" />
          <span className="shrink-0 font-mono text-[11px] text-gray-400 dark:text-gray-500">
            {argumentLabel}
          </span>
          <span className="min-w-0 truncate font-mono">{argumentValue || "—"}</span>
          {done && (
            <span className="ml-auto shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
              {isWebpageRead ? "已读取" : `${webSearch.results.length} 个结果`}
              {webSearch.costTime ? ` · ${(webSearch.costTime / 1000).toFixed(1)}s` : ""}
            </span>
          )}
        </div>

        {searching ? (
          <div className="px-3 pb-3">
            <div className="mb-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Icon size={14} strokeWidth={1.5} />
              <span className="markai-text-shimmer">
                {isWebpageRead
                  ? "正在读取网页、提取正文和页面信息..."
                  : "正在检索网页、整理摘要和来源..."}
              </span>
            </div>
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="min-w-0 flex-1 animate-pulse" key={index}>
                  <div className="m-3 h-3 w-4/5 rounded bg-gray-200 dark:bg-white/10" />
                  <div className="mx-3 mt-2 h-3 w-2/3 rounded bg-gray-200 dark:bg-white/10" />
                  <div className="mx-3 mt-5 h-3 w-1/2 rounded bg-gray-200 dark:bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        ) : failed ? (
          <div className="px-3 pb-3">
            <div className="py-2 text-xs text-red-600 dark:text-red-400">
              {webSearch.error || (isWebpageRead ? "网页读取服务暂时不可用" : "搜索服务暂时不可用")}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              已跳过{toolLabel}结果，继续使用当前模型回复。
            </div>
          </div>
        ) : isWebpageRead ? (
          <div className="px-3 pb-3">
            {webSearch.url ? (
              <SourcePopover
                citation={toCitation(
                  webSearch.results[0] || {
                    content: webSearch.description || webSearch.content?.slice(0, 600),
                    title: webSearch.title || webSearch.url,
                    url: webSearch.url,
                  },
                  1,
                )}
              >
                <div
                  className="flex min-w-0 items-start justify-between gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04]"
                  tabIndex={0}
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">
                      {webSearch.title || webSearch.url}
                    </div>
                    {webSearch.description && (
                      <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        {webSearch.description}
                      </div>
                    )}
                    <div className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">
                      {webSearch.siteName ? `${webSearch.siteName} · ` : ""}
                      {webSearch.url}
                    </div>
                  </div>
                  <a
                    aria-label="打开网页"
                    className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
                    data-markai-tooltip="打开网页"
                    href={webSearch.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </SourcePopover>
            ) : null}
            {webSearch.content && (
              <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap break-words py-2 font-sans text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {webSearch.content.slice(0, 2400)}
                {webSearch.content.length > 2400 ? "\n\n..." : ""}
              </pre>
            )}
          </div>
        ) : (
          <div className="px-1 pb-2">
            {webSearch.answer && (
              <pre className="mx-2 my-1 max-h-[120px] overflow-auto whitespace-pre-wrap break-words py-1.5 font-sans text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {webSearch.answer}
              </pre>
            )}
            <div className="flex min-w-0 flex-col">
              {webSearch.results.slice(0, 8).map((result, index) => {
                const citation = toCitation(result, index + 1);
                return (
                  <SourcePopover citation={citation} key={result.url}>
                    <a
                      className="group/search-result flex min-w-0 items-start gap-2.5 px-2 py-2 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
                      href={result.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <SourceFavicon citation={citation} size={20} />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="min-w-0 truncate text-xs leading-relaxed text-gray-500 group-hover/search-result:text-gray-800 dark:text-gray-400 dark:group-hover/search-result:text-gray-200">
                            {result.title}
                          </span>
                          <ExternalLink
                            className="shrink-0 text-gray-400 opacity-0 transition-opacity group-hover/search-result:opacity-100"
                            size={12}
                          />
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-gray-400 dark:text-gray-500">
                          {result.url}
                        </span>
                        {result.content && (
                          <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                            {result.content}
                          </span>
                        )}
                      </span>
                    </a>
                  </SourcePopover>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ToolCallDisclosure>
  );
}

export function WebSearchToolBlock({
  webSearch,
}: {
  webSearch?: WebSearchState[] | WebSearchState;
}) {
  if (!webSearch) return null;
  const items = Array.isArray(webSearch) ? webSearch : [webSearch];
  if (items.length === 0) return null;

  return items.map((item, index) => (
    <WebSearchToolBlockItem key={`${item.tool}-${item.query}-${index}`} webSearch={item} />
  ));
}
