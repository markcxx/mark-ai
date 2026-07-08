'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const DEFAULT_MAX_HEIGHT = 280;
const VIEWPORT_RATIO = 0.35;
const OVERFLOW_THRESHOLD = 32;

const computeThreshold = () => {
  if (typeof window === 'undefined') return DEFAULT_MAX_HEIGHT;
  return Math.min(DEFAULT_MAX_HEIGHT, Math.round(window.innerHeight * VIEWPORT_RATIO));
};

export function CollapsibleContent({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState(() => computeThreshold());
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(true);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const measure = () => setNaturalHeight(el.scrollHeight);
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => setMaxHeight(computeThreshold());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shouldCollapse = naturalHeight > maxHeight + OVERFLOW_THRESHOLD;
  const isCollapsed = shouldCollapse && collapsed;

  return (
    <div className="relative w-full">
      <div
        className={isCollapsed ? 'overflow-hidden' : 'overflow-visible'}
        ref={contentRef}
        style={
          isCollapsed
            ? {
                maxHeight,
                WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 48px), transparent)',
                maskImage: 'linear-gradient(to bottom, #000 calc(100% - 48px), transparent)',
              }
            : undefined
        }
      >
        {children}
      </div>
      {shouldCollapse && (
        <div className="mt-1.5 flex justify-center">
          <button
            className="inline-flex h-6 items-center gap-1 rounded-full bg-gray-200/70 px-2.5 text-xs text-gray-500 transition-colors hover:bg-gray-300/70 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
            onClick={() => setCollapsed((value) => !value)}
            type="button"
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            {collapsed ? '展开' : '收起'}
          </button>
        </div>
      )}
    </div>
  );
}

