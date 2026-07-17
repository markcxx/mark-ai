import { useCallback, useRef, useState } from "react";

const BOTTOM_SCROLL_THRESHOLD = 48;

export const useConversationScroll = (autoScroll: boolean) => {
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userHasScrolledAwayRef = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const scrollToBottom = useCallback(
    (force = false) => {
      if (!force && !autoScroll) return;
      const container = messagesScrollRef.current;
      if (!container) {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        return;
      }
      if (!force && userHasScrolledAwayRef.current) return;
      isAutoScrollingRef.current = true;
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
        requestAnimationFrame(() => {
          isAutoScrollingRef.current = false;
        });
      });
    },
    [autoScroll],
  );

  const handleScroll = useCallback(() => {
    if (isAutoScrollingRef.current) return;
    const container = messagesScrollRef.current;
    if (!container) return;

    userHasScrolledAwayRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight >
      BOTTOM_SCROLL_THRESHOLD;

    const containerTop = container.getBoundingClientRect().top;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-message-id]"));
    let nextActiveId: string | null = null;

    for (const node of nodes) {
      if (node.getBoundingClientRect().top - containerTop <= 96) {
        nextActiveId = node.dataset.messageId || nextActiveId;
      } else {
        break;
      }
    }

    if (!nextActiveId && nodes[0]) nextActiveId = nodes[0].dataset.messageId || null;
    setActiveMessageId((current) => (current === nextActiveId ? current : nextActiveId));
  }, []);

  const resetScrollIntent = useCallback(() => {
    userHasScrolledAwayRef.current = false;
  }, []);

  return {
    activeMessageId,
    handleScroll,
    messagesEndRef,
    messagesScrollRef,
    resetScrollIntent,
    scrollToBottom,
  };
};
