"use client";

import { Quote } from "lucide-react";
import { useEffect, useState } from "react";

import type { QuotedSelection } from "@/lib/chat/types";

type SelectionAction = QuotedSelection & {
  left: number;
  top: number;
};

const getSelectionAction = (): SelectionAction | null => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const content = selection.toString().replace(/\s+/g, " ").trim();
  if (content.length < 2) return null;

  const range = selection.getRangeAt(0);
  const ancestor =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  const source = ancestor?.closest<HTMLElement>('[data-selection-quote-source="true"]');
  if (!source) return null;

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return {
    content: content.slice(0, 6000),
    left: Math.min(window.innerWidth - 112, Math.max(8, rect.left + rect.width / 2 - 52)),
    sourceMessageId: source.dataset.messageId,
    top: Math.min(window.innerHeight - 48, Math.max(8, rect.bottom + 8)),
  };
};

export function SelectionQuoteAction({ onQuote }: { onQuote: (quote: QuotedSelection) => void }) {
  const [action, setAction] = useState<SelectionAction | null>(null);

  useEffect(() => {
    const handlePointerUp = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest("[data-selection-quote-ui]")) return;
      window.setTimeout(() => setAction(getSelectionAction()), 0);
    };
    const hide = () => setAction(null);
    document.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!action) return null;

  return (
    <button
      className="fixed z-[75] inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-800 shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition-colors hover:bg-gray-50 dark:border-white/15 dark:bg-[#191919] dark:text-gray-100 dark:hover:bg-[#222]"
      data-selection-quote-ui
      onClick={() => {
        onQuote({ content: action.content, sourceMessageId: action.sourceMessageId });
        setAction(null);
        window.getSelection()?.removeAllRanges();
      }}
      onPointerDown={(event) => event.preventDefault()}
      style={{ left: action.left, top: action.top }}
      type="button"
    >
      <Quote size={14} />
      引用提问
    </button>
  );
}
