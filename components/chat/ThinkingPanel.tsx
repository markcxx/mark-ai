'use client';

import { useEffect, useRef, useState } from 'react';
import { Atom, ChevronDown, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

import { MarkdownContent } from './MarkdownContent';

export function ThinkingPanel({
  content,
  duration,
  thinking,
}: {
  content?: string;
  duration?: number;
  thinking?: boolean;
}) {
  const [showDetail, setShowDetail] = useState(() => Boolean(thinking));
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasContent = Boolean(content?.trim());
  const expanded = Boolean(thinking || showDetail);

  useEffect(() => {
    if (thinking && expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, expanded, thinking]);

  if (!thinking && !hasContent) return null;

  const title = thinking
    ? '正在深度思考...'
    : duration
      ? `已深度思考 (${(duration / 1000).toFixed(1)} 秒)`
      : '已深度思考';

  return (
    <div className="mb-4 text-sm">
      <button
        className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-left text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={() => setShowDetail((value) => !value)}
        type="button"
      >
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-400',
            expanded && !thinking && 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/30 text-purple-500 dark:text-purple-400',
          )}
        >
          {thinking ? <Loader2 className="animate-spin" size={14} /> : <Atom size={14} />}
        </span>
        <span
          className={cn(
            'text-sm',
            thinking
              ? 'animate-pulse bg-gradient-to-r from-gray-400 via-gray-600 to-gray-400 bg-[length:200%_100%] bg-clip-text text-transparent dark:via-gray-200'
              : 'text-gray-500 dark:text-gray-400',
          )}
        >
          {title}
        </span>
        <ChevronDown
          className={cn('text-gray-400 transition-transform', expanded && 'rotate-180')}
          size={14}
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className="mt-1 max-h-[min(40vh,320px)] overflow-y-auto px-2 pb-2 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400"
            ref={scrollRef}
            style={{
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent, black 12px, black calc(100% - 18px), transparent)',
              maskImage:
                'linear-gradient(to bottom, transparent, black 12px, black calc(100% - 18px), transparent)',
            }}
          >
            <div className="markdown-body [&_*]:!text-gray-500 dark:[&_*]:!text-gray-400">
              {hasContent ? <MarkdownContent>{content || ''}</MarkdownContent> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

