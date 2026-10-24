"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import type { QuotedSelection } from "@/lib/chat/types";

type SelectionToolbarState = QuotedSelection & {
  /** Horizontal anchor: where the pointer was released, or the selection focus. */
  anchorX: number;
  /** Top and bottom of the text line that holds the selection focus. */
  lineBottom: number;
  lineTop: number;
  rawText: string;
  touch: boolean;
};

const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 10;

const getFocusRect = (selection: Selection) => {
  if (!selection.focusNode) return null;
  try {
    const range = document.createRange();
    range.setStart(selection.focusNode, selection.focusOffset);
    range.collapse(true);
    const rect = range.getClientRects()[0] || range.getBoundingClientRect();
    if (rect && (rect.height > 0 || rect.width > 0)) return rect;
  } catch {
    // Some focus positions cannot host a collapsed range.
  }
  return null;
};

const readSelection = (
  pointer?: { pointerType: string; x: number; y: number },
): SelectionToolbarState | null => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const rawText = selection.toString();
  const content = rawText.replace(/\s+/g, " ").trim();
  if (content.length < 2) return null;

  const range = selection.getRangeAt(0);
  const ancestor =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  const source = ancestor?.closest<HTMLElement>('[data-selection-quote-source="true"]');
  if (!source) return null;

  // Anchor to the selection focus, the end the user dragged to, instead of the
  // whole range box, which spans full paragraph widths for multi-line selections.
  const rects = range.getClientRects();
  const fallbackRect = rects[rects.length - 1] || range.getBoundingClientRect();
  const focusRect = getFocusRect(selection) || fallbackRect;
  if (!focusRect || (focusRect.width === 0 && focusRect.height === 0 && !pointer)) return null;

  const lineTop = focusRect.height > 0 ? focusRect.top : (pointer?.y ?? focusRect.top) - 10;
  const lineBottom = focusRect.height > 0 ? focusRect.bottom : (pointer?.y ?? focusRect.top) + 10;

  return {
    anchorX: pointer?.x ?? focusRect.left,
    content: content.slice(0, 6000),
    lineBottom,
    lineTop,
    rawText,
    sourceMessageId: source.dataset.messageId,
    touch: pointer?.pointerType === "touch" || pointer?.pointerType === "pen",
  };
};

export function SelectionQuoteAction({ onQuote }: { onQuote: (quote: QuotedSelection) => void }) {
  const [toolbar, setToolbar] = useState<SelectionToolbarState | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const hide = useCallback(() => {
    setToolbar(null);
    setPosition(null);
  }, []);

  useEffect(() => {
    const isToolbarTarget = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest("[data-selection-quote-ui]"));

    const handlePointerUp = (event: PointerEvent) => {
      if (isToolbarTarget(event.target)) return;
      const pointer = { pointerType: event.pointerType, x: event.clientX, y: event.clientY };
      // Let the browser finish updating the selection before reading it.
      window.setTimeout(() => {
        setPosition(null);
        setToolbar(readSelection(pointer));
      }, 0);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!isToolbarTarget(event.target)) hide();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.shiftKey && event.key !== "Shift") return;
      setPosition(null);
      setToolbar(readSelection());
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    // Touch selection handles are dragged without a reliable pointerup, so show
    // the toolbar once the selection has settled.
    let lastPointerType = "mouse";
    let settleTimer: number | undefined;
    const handleSelectionChange = () => {
      window.clearTimeout(settleTimer);
      if (window.getSelection()?.isCollapsed) {
        hide();
        return;
      }
      if (lastPointerType === "mouse") return;
      settleTimer = window.setTimeout(() => {
        const next = readSelection();
        setPosition(null);
        setToolbar(next && { ...next, touch: true });
      }, 400);
    };
    const trackPointerType = (event: PointerEvent) => {
      lastPointerType = event.pointerType || "mouse";
    };
    document.addEventListener("pointerdown", trackPointerType, true);

    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("selectionchange", handleSelectionChange);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.clearTimeout(settleTimer);
      document.removeEventListener("pointerdown", trackPointerType, true);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [hide]);

  // Measure the rendered toolbar so it can be centered on the anchor and kept on screen.
  useLayoutEffect(() => {
    if (!toolbar || !toolbarRef.current) return;
    const { height, width } = toolbarRef.current.getBoundingClientRect();
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(toolbar.anchorX - width / 2, maxLeft));
    // Touch platforms draw their native selection callout above the text, so go below.
    const above = toolbar.lineTop - ANCHOR_GAP - height;
    const below = toolbar.lineBottom + ANCHOR_GAP + (toolbar.touch ? 18 : 0);
    const fitsAbove = above >= VIEWPORT_MARGIN;
    const fitsBelow = below + height <= window.innerHeight - VIEWPORT_MARGIN;
    const top = toolbar.touch
      ? fitsBelow || !fitsAbove
        ? below
        : above
      : fitsAbove || !fitsBelow
        ? above
        : below;
    setPosition({
      left,
      top: Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - height - VIEWPORT_MARGIN)),
    });
  }, [toolbar]);

  if (!toolbar) return null;

  const actionClassName =
    "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 dark:text-gray-200 dark:hover:bg-white/[0.07] [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:px-3";

  return (
    <div
      aria-label="选中文字操作"
      className="fixed z-[75] flex animate-[menu-in_150ms_cubic-bezier(0.22,1,0.36,1)] items-center gap-0.5 rounded-lg border border-gray-200 bg-[var(--chat-popover-bg)] p-1 shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:border-white/10 dark:shadow-[0_16px_44px_rgba(0,0,0,0.5)]"
      data-selection-quote-ui
      onPointerDown={(event) => event.preventDefault()}
      ref={toolbarRef}
      role="toolbar"
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
    >
      <button
        className={actionClassName}
        onClick={() => {
          onQuote({ content: toolbar.content, sourceMessageId: toolbar.sourceMessageId });
          hide();
          window.getSelection()?.removeAllRanges();
        }}
        type="button"
      >
        引用
      </button>
      <span aria-hidden="true" className="h-4 w-px bg-gray-200 dark:bg-white/10" />
      <button
        className={actionClassName}
        onClick={() => {
          const text = toolbar.rawText.trim();
          hide();
          void navigator.clipboard
            .writeText(text)
            .then(() => toast.success("已复制"))
            .catch(() => toast.error("复制失败，请手动复制"));
        }}
        type="button"
      >
        复制
      </button>
    </div>
  );
}
