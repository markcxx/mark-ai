'use client';

import type { RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { MenuItem } from '@/lib/chat/types';
import { cn } from '@/lib/utils';

const MENU_WIDTH = 208;
const VIEWPORT_PADDING = 8;

type MenuPosition = {
  left: number;
  maxHeight: number;
  top: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function FloatingMenu({
  align = 'left',
  anchorRef,
  items,
  onClose,
  open,
}: {
  align?: 'left' | 'right';
  anchorRef: RefObject<HTMLElement | null>;
  items: MenuItem[];
  onClose: () => void;
  open: boolean;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight || Math.min(items.length * 38 + 8, 440);
      const availableBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
      const availableAbove = rect.top - VIEWPORT_PADDING;
      const showAbove = availableBelow < menuHeight && availableAbove > availableBelow;
      const maxHeight = Math.max(160, (showAbove ? availableAbove : availableBelow) - 4);
      const preferredLeft = align === 'right' ? rect.right - MENU_WIDTH : rect.left;

      setPosition({
        left: clamp(preferredLeft, VIEWPORT_PADDING, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING),
        maxHeight,
        top: showAbove
          ? Math.max(VIEWPORT_PADDING, rect.top - Math.min(menuHeight, maxHeight) - 6)
          : Math.min(window.innerHeight - VIEWPORT_PADDING, rect.bottom + 6),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, anchorRef, items.length, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed z-50 w-52 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-[0_12px_36px_rgba(0,0,0,0.16)]"
      ref={menuRef}
      style={{
        left: position?.left ?? -9999,
        maxHeight: position?.maxHeight,
        top: position?.top ?? -9999,
      }}
    >
      {items.map(({ danger, icon: Icon, label, onClick }) => (
        <button
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100',
            danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700',
          )}
          key={label}
          onClick={() => {
            onClick();
            onClose();
          }}
          type="button"
        >
          <Icon size={15} />
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
