"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronRight, ExternalLink, Globe } from "lucide-react";
import { useState } from "react";
import type { ReactElement } from "react";

import type { WebCitation } from "@/lib/chat/citations";
import { cn } from "@/lib/utils";

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const getFaviconUrl = (citation: WebCitation) => {
  if (citation.favicon?.startsWith("http://") || citation.favicon?.startsWith("https://")) {
    return citation.favicon;
  }

  const host = citation.favicon || getDomain(citation.url);
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
};

export function SourceFavicon({ citation, size = 16 }: { citation: WebCitation; size?: number }) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-gray-400 ring-1 ring-gray-200 dark:bg-[#252525] dark:ring-white/15"
      style={{ height: size, width: size }}
    >
      {failed ? (
        <Globe size={Math.max(10, size - 5)} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- Search results can use arbitrary favicon hosts that cannot be declared in Next image config.
        <img
          alt=""
          className="h-full w-full object-contain p-0.5"
          height={size}
          onError={() => setFailed(true)}
          src={getFaviconUrl(citation)}
          width={size}
        />
      )}
    </span>
  );
}

function SourcePreviewCard({ citation }: { citation: WebCitation }) {
  const domain = getDomain(citation.url);
  const publishedDate = citation.publishedDate
    ? new Intl.DateTimeFormat("zh-CN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(citation.publishedDate))
    : undefined;

  return (
    <div className="w-[min(340px,calc(100vw-32px))] p-1">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <SourceFavicon citation={citation} size={18} />
        <span className="min-w-0 flex-1 truncate">{domain}</span>
        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/[0.07] dark:text-gray-400">
          {citation.citationId}
        </span>
      </div>
      <div className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-gray-900 dark:text-gray-100">
        {citation.title || citation.url}
      </div>
      {citation.content && (
        <div className="mt-1.5 line-clamp-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
          {citation.content}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-2 dark:border-white/[0.08]">
        <span className="truncate text-[11px] text-gray-400">{publishedDate || citation.url}</span>
        <a
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          href={citation.url}
          rel="noreferrer"
          target="_blank"
        >
          打开来源
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

export function SourcePopover({
  children,
  citation,
}: {
  children: ReactElement;
  citation: WebCitation;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger closeDelay={120} delay={120} openOnHover render={children} />
      <Popover.Portal>
        <Popover.Positioner align="center" className="z-[120]" side="top" sideOffset={8}>
          <Popover.Popup
            className="origin-[var(--transform-origin)] rounded-xl border border-gray-200 bg-white p-2 shadow-[0_16px_48px_rgba(15,23,42,0.18)] outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-[0.96] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.96] data-[starting-style]:opacity-0 dark:border-white/15 dark:bg-[#202020]"
            initialFocus={false}
          >
            <Popover.Arrow className="h-2 w-2 rotate-45 border-b border-r border-gray-200 bg-white dark:border-white/15 dark:bg-[#202020]" />
            <SourcePreviewCard citation={citation} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function CitationReference({ citation }: { citation: WebCitation }) {
  return (
    <SourcePopover citation={citation}>
      <button
        aria-label={`查看来源 ${citation.citationId}：${citation.title}`}
        className="mx-0.5 inline-flex min-w-5 -translate-y-px items-center justify-center rounded-md bg-primary/10 px-1.5 py-0.5 align-middle font-jakarta text-[11px] font-semibold leading-4 text-primary transition-colors hover:bg-primary/20"
        type="button"
      >
        {citation.citationId}
      </button>
    </SourcePopover>
  );
}

export function MessageSources({ citations }: { citations: WebCitation[] }) {
  const [expanded, setExpanded] = useState(false);
  if (citations.length === 0) return null;

  return (
    <section className="mt-4 rounded-xl border border-gray-200/80 bg-gray-50/70 dark:border-white/[0.08] dark:bg-white/[0.025]">
      <button
        aria-expanded={expanded}
        className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-100/80 dark:hover:bg-white/[0.04]"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <Globe className="shrink-0 text-gray-400" size={15} />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {citations.length} 个来源
        </span>
        <span className="ml-1 flex min-w-0 flex-1 items-center pl-1">
          {citations.slice(0, 8).map((citation, index) => (
            <span className={index > 0 ? "-ml-1" : ""} key={citation.url}>
              <SourceFavicon citation={citation} size={18} />
            </span>
          ))}
        </span>
        <ChevronRight
          className={cn(
            "shrink-0 text-gray-400 transition-transform duration-200 ease-out",
            expanded && "-rotate-90",
          )}
          size={15}
        />
      </button>

      <div
        aria-hidden={!expanded}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-2 border-t border-gray-200/70 p-2 dark:border-white/[0.07] sm:grid-cols-2">
            {citations.map((citation) => (
              <SourcePopover citation={citation} key={citation.url}>
                <a
                  className="group/source flex min-w-0 items-start gap-2.5 rounded-lg border border-transparent bg-white px-2.5 py-2.5 transition-all hover:border-gray-200 hover:shadow-sm dark:bg-white/[0.035] dark:hover:border-white/10"
                  href={citation.url}
                  rel="noreferrer"
                  tabIndex={expanded ? 0 : -1}
                  target="_blank"
                >
                  <SourceFavicon citation={citation} size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs font-medium leading-4 text-gray-800 group-hover/source:text-primary dark:text-gray-200">
                      {citation.title || citation.url}
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-gray-400">
                      {citation.citationId} · {getDomain(citation.url)}
                    </span>
                  </span>
                </a>
              </SourcePopover>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
