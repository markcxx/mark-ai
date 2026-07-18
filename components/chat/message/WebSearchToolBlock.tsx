import { ChevronRight, ExternalLink, Globe, Loader2, X } from "lucide-react";

import type { WebCitation } from "@/lib/chat/citations";
import type { WebSearchResult, WebSearchState } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

import { SourceFavicon, SourcePopover } from "./MessageSources";

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
  const toolName = isWebpageRead ? "read_webpage" : "web_search";
  const toolLabel = isWebpageRead ? "网页读取" : "联网搜索";
  const argumentLabel = isWebpageRead ? "url:" : "query:";
  const argumentValue = isWebpageRead ? webSearch.url || webSearch.query : webSearch.query;
  const summaryLabel = searching
    ? `正在调用${toolLabel}`
    : failed
      ? `${toolLabel}调用失败`
      : `已调用${toolLabel}`;

  return (
    <details className="group/tool mb-2.5 overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors open:border-gray-300 dark:border-white/10 dark:bg-white/[0.025] dark:open:border-white/15">
      <summary className="flex h-9 cursor-pointer list-none items-center gap-2 px-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
            failed
              ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
              : done
                ? "bg-primary/10 text-primary"
                : "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
          )}
        >
          {searching ? (
            <Loader2 className="animate-spin" size={12} />
          ) : failed ? (
            <X size={12} />
          ) : (
            <Globe size={12} />
          )}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs font-medium",
            failed ? "text-red-600 dark:text-red-300" : "text-gray-600 dark:text-gray-300",
          )}
        >
          {summaryLabel}
        </span>
        <ChevronRight
          className="shrink-0 text-gray-400 transition-transform duration-200 group-open/tool:-rotate-90"
          size={14}
        />
      </summary>

      <div className="border-t border-gray-100 dark:border-white/[0.08]">
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
              <Globe size={14} />
              <span>
                {isWebpageRead
                  ? "正在读取网页、提取正文和页面信息..."
                  : "正在检索网页、整理摘要和来源..."}
              </span>
            </div>
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  className="h-[86px] min-w-[172px] animate-pulse rounded-lg border border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-white/[0.05]"
                  key={index}
                >
                  <div className="m-3 h-3 w-4/5 rounded bg-gray-200 dark:bg-white/10" />
                  <div className="mx-3 mt-2 h-3 w-2/3 rounded bg-gray-200 dark:bg-white/10" />
                  <div className="mx-3 mt-5 h-3 w-1/2 rounded bg-gray-200 dark:bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        ) : failed ? (
          <div className="px-3 pb-3">
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
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
                    <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
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
                    className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
                    href={webSearch.url}
                    rel="noreferrer"
                    target="_blank"
                    title="打开网页"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </SourcePopover>
            ) : null}
            {webSearch.content && (
              <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 font-sans text-[13px] leading-relaxed text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
                {webSearch.content.slice(0, 2400)}
                {webSearch.content.length > 2400 ? "\n\n..." : ""}
              </pre>
            )}
          </div>
        ) : (
          <div className="px-1 pb-2">
            {webSearch.answer && (
              <pre className="mx-2 my-1 max-h-[120px] overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 px-2 py-1.5 font-sans text-[13px] leading-relaxed text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
                {webSearch.answer}
              </pre>
            )}
            <div className="flex min-w-0 flex-col">
              {webSearch.results.slice(0, 8).map((result, index) => {
                const citation = toCitation(result, index + 1);
                return (
                  <SourcePopover citation={citation} key={result.url}>
                    <a
                      className="group/search-result flex min-w-0 items-start gap-2.5 border-b border-gray-100 px-2 py-2 transition-colors last:border-b-0 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/[0.04]"
                      href={result.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <SourceFavicon citation={citation} size={20} />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="min-w-0 truncate text-[13px] font-medium leading-relaxed text-gray-900 group-hover/search-result:text-primary dark:text-gray-100">
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
    </details>
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
