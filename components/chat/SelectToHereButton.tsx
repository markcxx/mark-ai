'use client';

import { useCallback, useRef } from 'react';
import { ArrowDownToLine } from 'lucide-react';

export function SelectToHereButton({
  onSelectToHere,
}: {
  onSelectToHere: (messageId?: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const handleClick = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const lineY = rect.top + rect.height / 2;
    let targetId: string | undefined;

    for (const node of wrap.ownerDocument.querySelectorAll<HTMLElement>('[data-message-id]')) {
      if (node.getBoundingClientRect().top <= lineY) {
        targetId = node.dataset.messageId || targetId;
      }
    }

    onSelectToHere(targetId);
  }, [onSelectToHere]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-[75%] z-20 flex -translate-y-1/2 items-center gap-3 px-4 md:px-8"
      ref={wrapRef}
    >
      <div className="h-px flex-1 border-t border-dashed border-gray-300 dark:border-white/15" />
      <button
        className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs text-gray-600 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-colors hover:bg-gray-50 hover:text-gray-950 dark:border-white/10 dark:bg-[#191919] dark:text-gray-300 dark:shadow-[0_10px_30px_rgba(0,0,0,0.36)] dark:hover:bg-[#222] dark:hover:text-white"
        onClick={handleClick}
        type="button"
      >
        <ArrowDownToLine size={14} />
        选择到这里
      </button>
      <div className="h-px flex-1 border-t border-dashed border-gray-300 dark:border-white/15" />
    </div>
  );
}
