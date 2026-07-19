"use client";

import type { RefObject } from "react";
import { ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { MenuItem } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const MENU_WIDTH = 208;
const VIEWPORT_PADDING = 8;

type MenuPosition = {
  left: number;
  maxHeight: number;
  top: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function FloatingMenu({
  align = "left",
  anchorRef,
  items,
  onClose,
  open,
}: {
  align?: "left" | "right";
  anchorRef: RefObject<HTMLElement | null>;
  items: MenuItem[];
  onClose: () => void;
  open: boolean;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [openSubmenuLabel, setOpenSubmenuLabel] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight || Math.min(items.length * 38 + 8, 440);
      const availableBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
      const availableAbove = rect.top - VIEWPORT_PADDING;
      const showAbove = availableBelow < menuHeight && availableAbove > availableBelow;
      const maxHeight = Math.max(160, (showAbove ? availableAbove : availableBelow) - 4);
      const preferredLeft = align === "right" ? rect.right - MENU_WIDTH : rect.left;

      setPosition({
        left: clamp(
          preferredLeft,
          VIEWPORT_PADDING,
          window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING,
        ),
        maxHeight,
        top: showAbove
          ? Math.max(VIEWPORT_PADDING, rect.top - Math.min(menuHeight, maxHeight) - 6)
          : Math.min(window.innerHeight - VIEWPORT_PADDING, rect.bottom + 6),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, anchorRef, items.length, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (submenuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (openSubmenuLabel) setOpenSubmenuLabel(null);
        else onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose, open, openSubmenuLabel]);

  if (!open || typeof document === "undefined") return null;

  const activeSubmenu = items.find((item) => item.label === openSubmenuLabel)?.submenu;
  const submenuWidth = 176;
  const submenuLeft = position
    ? position.left + MENU_WIDTH + 6 + submenuWidth <= window.innerWidth - VIEWPORT_PADDING
      ? position.left + MENU_WIDTH + 6
      : position.left - submenuWidth - 6
    : -9999;
  const submenuIndex = Math.max(0, items.findIndex((item) => item.label === openSubmenuLabel));

  return createPortal(
    <>
      <div
        className="fixed z-50 w-52 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:border-gray-700 dark:bg-gray-800"
        ref={menuRef}
        style={{
          left: position?.left ?? -9999,
          maxHeight: position?.maxHeight,
          top: position?.top ?? -9999,
        }}
      >
      {items.map(({ danger, icon: Icon, label, onClick, submenu }) => (
        <button
          aria-expanded={submenu ? openSubmenuLabel === label : undefined}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700",
            danger
              ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              : "text-gray-700 dark:text-gray-300",
          )}
          key={label}
          onClick={() => {
            if (submenu) {
              setOpenSubmenuLabel((current) => (current === label ? null : label));
              return;
            }
            onClick?.();
            onClose();
          }}
          onMouseEnter={() => {
            if (submenu) setOpenSubmenuLabel(label);
            else setOpenSubmenuLabel(null);
          }}
          type="button"
        >
          <Icon size={15} />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {submenu && <ChevronRight className="text-gray-400" size={14} />}
        </button>
      ))}
      </div>
      {activeSubmenu && (
        <div
          className="fixed z-[51] max-h-[min(70vh,420px)] w-44 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:border-gray-700 dark:bg-gray-800"
          onMouseLeave={() => setOpenSubmenuLabel(null)}
          ref={submenuRef}
          style={{
            left: submenuLeft,
            top: Math.min(
              (position?.top ?? 0) + submenuIndex * 36,
              window.innerHeight - Math.min(activeSubmenu.length * 36 + 8, 420) - VIEWPORT_PADDING,
            ),
          }}
        >
          {activeSubmenu.map((item) => (
            <button
              className="flex h-9 w-full items-center px-3 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              key={item.label}
              onClick={() => {
                item.onClick();
                setOpenSubmenuLabel(null);
                onClose();
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>,
    document.body,
  );
}
