import { useCallback, useRef, useState } from "react";

const BOTTOM_SCROLL_THRESHOLD = 48;

export const useConversationScroll = (autoScroll: boolean) => {
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userHasScrolledAwayRef = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [isAwayFromBottom, setIsAwayFromBottom] = useState(false);

  const scrollToBottom = useCallback(
    (force = false) => {
      if (!force && !autoScroll) return;
      const container = messagesScrollRef.current;
      if (!container) {
        messagesEndRef.current?.scrollIntoView({ behavior: force ? "smooth" : "auto" });
        return;
      }
      if (!force && userHasScrolledAwayRef.current) return;
      isAutoScrollingRef.current = true;
      userHasScrolledAwayRef.current = false;
      setIsAwayFromBottom(false);
      requestAnimationFrame(() => {
        container.scrollTo({
          behavior: force ? "smooth" : "auto",
          top: container.scrollHeight,
        });
        if (!force) {
          requestAnimationFrame(() => {
            isAutoScrollingRef.current = false;
          });
        }
      });
    },
    [autoScroll],
  );

  const handleScroll = useCallback(() => {
    const container = messagesScrollRef.current;
    if (!container) return;

    const awayFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight >
      BOTTOM_SCROLL_THRESHOLD;
    if (isAutoScrollingRef.current) {
      if (!awayFromBottom) isAutoScrollingRef.current = false;
      return;
    }
    userHasScrolledAwayRef.current = awayFromBottom;
    setIsAwayFromBottom((current) => (current === awayFromBottom ? current : awayFromBottom));

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
    setIsAwayFromBottom(false);
  }, []);

  return {
    activeMessageId,
    handleScroll,
    isAwayFromBottom,
    messagesEndRef,
    messagesScrollRef,
    resetScrollIntent,
    scrollToBottom,
  };
};
