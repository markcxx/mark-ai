"use client";

import { useEffect, useRef, useState } from "react";

type TooltipState = {
  content: string;
  left: number;
  placement: "bottom" | "top";
  top: number;
  visible: boolean;
};

const TOOLTIP_ATTRIBUTE = "data-markai-tooltip";
const SHOW_DELAY_MS = 360;

const migrateTitle = (element: Element) => {
  const title = element.getAttribute("title")?.trim();
  if (!title) return;
  element.setAttribute(TOOLTIP_ATTRIBUTE, title);
  element.removeAttribute("title");

  if (
    !element.hasAttribute("aria-label") &&
    element instanceof HTMLElement &&
    !element.innerText.trim()
  ) {
    element.setAttribute("aria-label", title);
  }
};

const migrateTitlesWithin = (root: ParentNode) => {
  if (root instanceof Element && root.hasAttribute("title")) migrateTitle(root);
  root.querySelectorAll?.("[title]").forEach(migrateTitle);
};

const getTooltipTarget = (target: EventTarget | null) =>
  target instanceof Element
    ? (target.closest(`[${TOOLTIP_ATTRIBUTE}]`) as HTMLElement | null)
    : null;

export function GlobalTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const keyboardNavigationRef = useRef(false);
  const showTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearShowTimer = () => {
      if (showTimerRef.current === null) return;
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    };

    const hide = () => {
      clearShowTimer();
      activeTargetRef.current = null;
      setTooltip((current) => (current ? { ...current, visible: false } : null));
    };

    const show = (target: HTMLElement) => {
      const content = target.getAttribute(TOOLTIP_ATTRIBUTE)?.trim();
      if (!content || target.hasAttribute("disabled")) return;
      if (activeTargetRef.current === target) return;

      clearShowTimer();
      activeTargetRef.current = target;
      showTimerRef.current = window.setTimeout(() => {
        if (
          activeTargetRef.current !== target ||
          !target.isConnected ||
          target.hasAttribute("disabled")
        ) {
          if (activeTargetRef.current === target) activeTargetRef.current = null;
          showTimerRef.current = null;
          return;
        }
        const rect = target.getBoundingClientRect();
        const placement = rect.top >= 56 ? "top" : "bottom";
        const left = Math.min(Math.max(rect.left + rect.width / 2, 88), window.innerWidth - 88);
        setTooltip({
          content,
          left,
          placement,
          top: placement === "top" ? rect.top - 9 : rect.bottom + 9,
          visible: true,
        });
        showTimerRef.current = null;
      }, SHOW_DELAY_MS);
    };

    migrateTitlesWithin(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          migrateTitle(mutation.target);
          return;
        }
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) migrateTitlesWithin(node);
        });
      });
      if (activeTargetRef.current && !activeTargetRef.current.isConnected) hide();
    });
    observer.observe(document.body, {
      attributeFilter: ["title"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    const handlePointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const target = getTooltipTarget(event.target);
      if (target) show(target);
    };
    const handlePointerOut = (event: PointerEvent) => {
      const target = getTooltipTarget(event.target);
      if (!target) return;
      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof Node && target.contains(relatedTarget)) return;
      if (activeTargetRef.current === target) hide();
    };
    const handlePointerDown = () => {
      keyboardNavigationRef.current = false;
      hide();
    };
    const handleFocusIn = (event: FocusEvent) => {
      const target = getTooltipTarget(event.target);
      if (target && keyboardNavigationRef.current) show(target);
    };
    const handleFocusOut = (event: FocusEvent) => {
      const target = getTooltipTarget(event.target);
      if (target && activeTargetRef.current === target) hide();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") keyboardNavigationRef.current = true;
      if (event.key === "Escape") hide();
    };

    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerout", handlePointerOut, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", hide);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);

    return () => {
      clearShowTimer();
      observer.disconnect();
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerout", handlePointerOut, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("focusout", handleFocusOut, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", hide);
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!tooltip) return null;

  return (
    <div
      aria-hidden={!tooltip.visible}
      className={`pointer-events-none fixed z-[10000] max-w-64 rounded-md bg-gray-950 px-2.5 py-1.5 text-center text-xs leading-5 text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition-[opacity,transform] duration-150 dark:bg-gray-100 dark:text-gray-950 ${
        tooltip.visible ? "opacity-100" : "opacity-0"
      } ${tooltip.placement === "top" ? "-translate-x-1/2 -translate-y-full" : "-translate-x-1/2"}`}
      role="tooltip"
      style={{ left: tooltip.left, top: tooltip.top }}
    >
      {tooltip.content}
    </div>
  );
}
