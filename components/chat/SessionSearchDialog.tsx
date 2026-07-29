"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { AppDialog } from "@/components/ui/AppDialog";
import type { ChatSession } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";

const PAGE_SIZE = 30;

function HighlightedText({ query, text }: { query: string; text: string }) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return text;

  const parts: Array<{ highlighted: boolean; text: string }> = [];
  const normalizedText = text.toLocaleLowerCase();
  let start = 0;
  let matchIndex = normalizedText.indexOf(normalizedQuery);
  while (matchIndex >= 0) {
    if (matchIndex > start) {
      parts.push({ highlighted: false, text: text.slice(start, matchIndex) });
    }
    const end = matchIndex + normalizedQuery.length;
    parts.push({ highlighted: true, text: text.slice(matchIndex, end) });
    start = end;
    matchIndex = normalizedText.indexOf(normalizedQuery, start);
  }
  if (start < text.length) parts.push({ highlighted: false, text: text.slice(start) });
  if (parts.length === 0) return text;

  return parts.map((part, index) =>
    part.highlighted ? (
      <mark
        className="rounded-sm bg-primary/15 px-0.5 text-current dark:bg-primary/25"
        key={`${part.text}-${index}`}
      >
        {part.text}
      </mark>
    ) : (
      <Fragment key={`${part.text}-${index}`}>{part.text}</Fragment>
    ),
  );
}

export function SessionSearchDialog({
  onSelectSession,
}: {
  onSelectSession: (sessionId: string) => void;
}) {
  const open = useUIStore((state) => state.sessionSearchOpen);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatSession[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const loadMoreRequestRef = useRef<AbortController | null>(null);
  const currentQueryRef = useRef("");
  currentQueryRef.current = query.trim();

  const close = () => {
    requestRef.current?.abort();
    loadMoreRequestRef.current?.abort();
    setQuery("");
    setResults([]);
    setNextCursor(null);
    setLoading(false);
    setLoadingMore(false);
    useUIStore.getState().setSessionSearchOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    requestRef.current?.abort();
    loadMoreRequestRef.current?.abort();
    setLoadingMore(false);
    const searchQuery = query.trim();
    if (!open || !searchQuery) {
      setResults([]);
      setNextCursor(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setResults([]);
    setNextCursor(null);
    setLoading(true);
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), q: searchQuery });
      void fetch(`/api/sessions?${params}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("搜索会话失败");
          const data = await response.json();
          if (controller.signal.aborted || currentQueryRef.current !== searchQuery) return;
          setResults(Array.isArray(data.sessions) ? data.sessions : []);
          setNextCursor(typeof data.nextCursor === "string" ? data.nextCursor : null);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          console.error("Session search error:", error);
          setResults([]);
          setNextCursor(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  const loadMore = async () => {
    const searchQuery = query.trim();
    if (!searchQuery || !nextCursor || loadingMore) return;
    const controller = new AbortController();
    loadMoreRequestRef.current = controller;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        cursor: nextCursor,
        limit: String(PAGE_SIZE),
        q: searchQuery,
      });
      const response = await fetch(`/api/sessions?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("加载更多搜索结果失败");
      const data = await response.json();
      if (controller.signal.aborted || currentQueryRef.current !== searchQuery) return;
      const nextResults: ChatSession[] = Array.isArray(data.sessions) ? data.sessions : [];
      setResults((current) => {
        const merged = new Map(current.map((session) => [session.id, session]));
        nextResults.forEach((session) => merged.set(session.id, session));
        return [...merged.values()];
      });
      setNextCursor(typeof data.nextCursor === "string" ? data.nextCursor : null);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("More session search results error:", error);
    } finally {
      if (loadMoreRequestRef.current === controller) {
        loadMoreRequestRef.current = null;
        setLoadingMore(false);
      }
    }
  };

  return (
    <AppDialog
      bodyClassName="overflow-visible"
      closable={false}
      maskClassName="!bg-transparent !backdrop-blur-none"
      onClose={close}
      open={open}
      panelClassName="w-[calc(100vw-24px)] overflow-visible border-0 bg-transparent drop-shadow-[0_16px_36px_rgba(0,0,0,0.16)] dark:bg-transparent dark:drop-shadow-[0_20px_44px_rgba(0,0,0,0.42)]"
      title={false}
      width={640}
      wrapperClassName="!items-start !pt-[max(72px,30dvh)]"
    >
      <div className="relative rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/15 dark:bg-[#191919] dark:shadow-none">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          size={18}
        />
        <input
          aria-label="搜索会话标题和消息内容"
          className="h-13 w-full rounded-xl bg-transparent pl-11 pr-11 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索会话标题或消息内容"
          ref={inputRef}
          value={query}
        />
        {query && (
          <button
            aria-label="清除搜索"
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-white/[0.07] dark:hover:text-gray-100"
            data-markai-tooltip="清除搜索"
            onClick={() => setQuery("")}
            type="button"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity,transform] duration-200 ease-out",
          query.trim()
            ? "grid-rows-[1fr] translate-y-0 opacity-100"
            : "pointer-events-none grid-rows-[0fr] -translate-y-2 opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className="markai-scrollbar-auto-hide mt-2 max-h-[min(62dvh,520px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-white/15 dark:bg-[#191919] dark:shadow-none"
            onScroll={(event) => {
              const target = event.currentTarget;
              if (target.scrollHeight - target.scrollTop - target.clientHeight <= 120) {
                void loadMore();
              }
            }}
          >
            {loading && (
              <div className="space-y-1">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="rounded-lg px-3 py-3" key={index}>
                    <div className="h-4 w-2/5 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                    <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-gray-100 dark:bg-white/[0.06]" />
                  </div>
                ))}
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="flex h-36 items-center justify-center text-sm text-gray-400">
                没有找到相关会话
              </div>
            )}
            {!loading &&
              results.map((session) => (
                <button
                  className="w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 dark:hover:bg-white/[0.06]"
                  key={session.id}
                  onClick={() => {
                    close();
                    onSelectSession(session.id);
                  }}
                  type="button"
                >
                  <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    <HighlightedText query={query} text={session.title || "新对话"} />
                  </div>
                  {session.searchSnippet && (
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                      <HighlightedText
                        query={query}
                        text={session.searchSnippet.replace(/\s+/g, " ").trim()}
                      />
                    </div>
                  )}
                  <div className="mt-1.5 font-jakarta text-[11px] text-gray-400">
                    {session.messageCount || 0} 条消息 ·{" "}
                    {new Date(session.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            {loadingMore && (
              <div className="flex h-10 items-center justify-center text-gray-400">
                <LoaderCircle className="animate-spin" size={16} />
              </div>
            )}
            {!loading && !loadingMore && results.length > 0 && !nextCursor && (
              <div className="py-3 text-center text-xs text-gray-400">已显示全部结果</div>
            )}
          </div>
        </div>
      </div>
    </AppDialog>
  );
}
