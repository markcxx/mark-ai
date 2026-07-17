import { Check, ChevronDown, ExternalLink, Globe2, Loader2, X } from "lucide-react";

import type { WebSearchState } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function WebSearchToolBlockItem({ webSearch }: { webSearch: WebSearchState }) {
  const searching = webSearch.status === "searching";
  const failed = webSearch.status === "error";
  const done = webSearch.status === "done";
  const isWebpageRead = webSearch.tool === "read_webpage";
  const toolName = isWebpageRead ? "read_webpage" : "web_search";
  const toolLabel = isWebpageRead ? "网页读取" : "联网搜索";
  const argumentLabel = isWebpageRead ? "url:" : "query:";
  const argumentValue = isWebpageRead ? webSearch.url || webSearch.query : webSearch.query;

  return (
    <details
      className="group/tool mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-colors open:border-gray-300 dark:border-white/10 dark:bg-white/[0.035] dark:open:border-white/15"
      open
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
              failed
                ? "border-red-200 bg-red-50 text-red-600 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300"
                : done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-200",
            )}
          >
            {searching ? (
              <Loader2 className="animate-spin" size={15} />
            ) : failed ? (
              <X size={15} />
            ) : (
              <Check size={15} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <span>{searching ? "正在调用工具" : failed ? "工具调用失败" : "工具调用完成"}</span>
              <ChevronDown className="rotate-[-90deg] text-gray-400 dark:text-gray-500" size={14} />
              <span className="font-mono text-gray-600 dark:text-gray-300">{toolName}</span>
            </div>
            <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              <span className="font-mono text-gray-400 dark:text-gray-500">{argumentLabel}</span>
              <span className="ml-1 font-mono">{argumentValue}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className={cn(
              "rounded-full px-2 py-1 text-xs",
              failed
                ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
                : "bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400",
            )}
          >
            {searching
              ? "运行中"
              : failed
                ? "失败"
                : isWebpageRead
                  ? `已读取${webSearch.costTime ? ` · ${(webSearch.costTime / 1000).toFixed(1)}s` : ""}`
                  : `${webSearch.results.length} 个结果${webSearch.costTime ? ` · ${(webSearch.costTime / 1000).toFixed(1)}s` : ""}`}
          </div>
          <ChevronDown
            className="text-gray-400 transition-transform group-open/tool:rotate-180"
            size={16}
          />
        </div>
      </summary>

      {searching ? (
        <div className="border-t border-gray-100 p-3 dark:border-white/10">
          <div className="mb-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Globe2 size={14} />
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
        <div className="border-t border-gray-100 px-3 py-3 dark:border-white/10">
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
            {webSearch.error || (isWebpageRead ? "网页读取服务暂时不可用" : "搜索服务暂时不可用")}
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            已跳过{toolLabel}结果，继续使用当前模型回复。
          </div>
        </div>
      ) : isWebpageRead ? (
        <div className="border-t border-gray-100 px-3 py-3 dark:border-white/10">
          <div className="flex min-w-0 items-start justify-between gap-3">
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
            {webSearch.url && (
              <a
                className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
                href={webSearch.url}
                rel="noreferrer"
                target="_blank"
                title="打开网页"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          {webSearch.content && (
            <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 font-sans text-[13px] leading-relaxed text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
              {webSearch.content.slice(0, 2400)}
              {webSearch.content.length > 2400 ? "\n\n..." : ""}
            </pre>
          )}
        </div>
      ) : (
        <div className="border-t border-gray-100 px-1 py-2 dark:border-white/10">
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs">
            <span className="shrink-0 text-gray-400 dark:text-gray-500">Query</span>
            <span className="min-w-0 truncate text-gray-900 dark:text-gray-100">
              {webSearch.query}
            </span>
          </div>
          {webSearch.answer && (
            <pre className="mx-2 my-1 max-h-[120px] overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 px-2 py-1.5 font-sans text-[13px] leading-relaxed text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
              {webSearch.answer}
            </pre>
          )}
          <div className="flex min-w-0 flex-col">
            {webSearch.results.slice(0, 8).map((result) => (
              <a
                className="group/search-result min-w-0 border-b border-gray-100 px-2 py-1.5 transition-colors last:border-b-0 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/[0.04]"
                href={result.url}
                key={result.url}
                rel="noreferrer"
                target="_blank"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate text-[13px] font-medium leading-relaxed text-gray-900 group-hover/search-result:text-sky-600 dark:text-gray-100 dark:group-hover/search-result:text-sky-300">
                    {result.title}
                  </span>
                  <ExternalLink
                    className="shrink-0 text-gray-400 opacity-0 transition-opacity group-hover/search-result:opacity-100"
                    size={12}
                  />
                </div>
                <div className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                  {result.url}
                </div>
                {result.content && (
                  <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    {result.content}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
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
