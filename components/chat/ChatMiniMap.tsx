'use client';

import { useMemo, useRef, useState } from 'react';

import type { Message } from '@/lib/chat/types';
import { cn } from '@/lib/utils';

const MIN_MESSAGES_THRESHOLD = 3;
const MIN_WIDTH = 5;
const MAX_WIDTH = 16;
const MAX_LENGTH = 80;
const CLOSE_DELAY_MS = 120;

type MiniMapItem = {
  id: string;
  messageIndex: number;
  preview: string;
  width: number;
};

const getIndicatorWidth = (content = '') => {
  const ratio = Math.min(Math.sqrt(content.length / MAX_LENGTH), 1);
  return MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * ratio;
};

const getPreviewText = (content = '') => {
  const normalized = content.replaceAll(/\s+/g, ' ').trim();
  if (!normalized) return '空消息';
  return normalized.slice(0, 100) + (normalized.length > 100 ? '...' : '');
};

export function ChatMiniMap({
  activeMessageId,
  messages,
}: {
  activeMessageId?: string | null;
  messages: Message[];
}) {
  const [hovered, setHovered] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = useMemo<MiniMapItem[]>(
    () =>
      messages.reduce<MiniMapItem[]>((acc, message, messageIndex) => {
        if (message.role !== 'user') return acc;
        acc.push({
          id: message.id,
          messageIndex,
          preview: getPreviewText(message.content),
          width: getIndicatorWidth(message.content),
        });
        return acc;
      }, []),
    [messages],
  );

  const activePosition = useMemo(() => {
    if (!activeMessageId) return null;

    const exact = items.findIndex((item) => item.id === activeMessageId);
    if (exact >= 0) return exact;

    const activeIndex = messages.findIndex((message) => message.id === activeMessageId);
    if (activeIndex < 0) return null;

    let matched: number | null = null;
    items.forEach((item, position) => {
      if (item.messageIndex <= activeIndex) matched = position;
    });
    return matched;
  }, [activeMessageId, items, messages]);

  if (items.length <= MIN_MESSAGES_THRESHOLD) return null;

  const handleEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setHovered(true);
  };

  const handleLeave = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setHovered(false);
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  };

  const handleJump = (id: string, close = false) => {
    document
      .querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (close) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setHovered(false);
    }
  };

  return (
    <div className="pointer-events-none absolute bottom-[120px] right-2 top-16 z-10 hidden flex-col items-end justify-center md:flex">
      <div
        className="pointer-events-auto relative flex flex-col items-end"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <div
          className={cn(
            'flex max-h-[50vh] flex-col items-end overflow-y-auto transition-opacity duration-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            hovered && 'pointer-events-none opacity-0',
          )}
          role="group"
        >
          {items.map((item, position) => {
            const active = activePosition === position;

            return (
              <button
                aria-current={active ? 'true' : undefined}
                aria-label={`跳转到第 ${position + 1} 条用户消息`}
                className="h-3 min-w-[5px] shrink-0 cursor-pointer py-[5px]"
                key={item.id}
                onClick={() => handleJump(item.id)}
                style={{ width: item.width }}
                type="button"
              >
                <span
                  className={cn(
                    'block h-0.5 w-full rounded-sm bg-gray-300 transition-colors dark:bg-white/20',
                    active && 'bg-primary dark:bg-primary',
                  )}
                />
              </button>
            );
          })}
        </div>

        <div
          aria-hidden={!hovered}
          className={cn(
            'pointer-events-none absolute right-0 top-1/2 flex max-h-[60vh] min-w-[240px] max-w-[360px] origin-right -translate-y-1/2 scale-95 overflow-hidden rounded-lg border border-gray-200 bg-white opacity-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-[opacity,transform] duration-200 dark:border-white/10 dark:bg-[var(--chat-popover-bg)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.42)]',
            hovered && 'pointer-events-auto scale-100 opacity-100',
          )}
        >
          <div className="flex max-h-[60vh] w-full flex-col gap-0.5 overflow-y-auto p-1 [scrollbar-width:thin]">
            {items.map((item, position) => {
              const active = activePosition === position;

              return (
                <button
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex items-center justify-end gap-2 rounded-md px-3 py-1.5 text-right text-[13px] leading-snug text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100',
                    active && 'font-medium text-primary dark:text-primary',
                  )}
                  key={item.id}
                  onClick={() => handleJump(item.id, true)}
                  type="button"
                >
                  <span className="line-clamp-1 min-w-0 flex-1 break-words">{item.preview}</span>
                  <span
                    className={cn(
                      'h-0.5 shrink-0 rounded-sm bg-gray-300 dark:bg-white/20',
                      active && 'bg-primary dark:bg-primary',
                    )}
                    style={{ width: item.width }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
