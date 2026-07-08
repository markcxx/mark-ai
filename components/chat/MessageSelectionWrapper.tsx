'use client';

import type { MouseEvent, ReactNode } from 'react';
import { Check } from 'lucide-react';

import type { Message } from '@/lib/chat/types';
import { cn } from '@/lib/utils';

export function MessageSelectionWrapper({
  children,
  isSelected,
  message,
  onToggle,
  selectionMode,
}: {
  children: ReactNode;
  isSelected: boolean;
  message: Message;
  onToggle: (id: string, shiftKey?: boolean) => void;
  selectionMode: boolean;
}) {
  if (!selectionMode) return <>{children}</>;

  const handleClick = (event: MouseEvent) => {
    onToggle(message.id, event.shiftKey);
  };

  return (
    <button
      className={cn(
        'group/selection -mx-4 flex w-[calc(100%+32px)] animate-in fade-in slide-in-from-left-1 items-center gap-3 px-4 py-2 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-gray-100/70 active:scale-[0.998] dark:hover:bg-gray-800/70 md:-mx-8 md:w-[calc(100%+64px)] md:px-8',
        isSelected && 'bg-gray-100/80 hover:bg-gray-100/80 dark:bg-gray-800/80 dark:hover:bg-gray-800/80',
      )}
      onClick={handleClick}
      type="button"
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color,color,transform] duration-150 ease-out',
          isSelected
            ? 'scale-100 border-primary bg-primary text-white'
            : 'scale-95 border-gray-300 bg-white text-transparent group-hover/selection:scale-100 group-hover/selection:border-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:group-hover/selection:border-gray-400',
        )}
      >
        <Check
          className={cn(
            'transition-[opacity,transform] duration-150 ease-out',
            isSelected ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
          )}
          size={14}
          strokeWidth={2.6}
        />
      </span>
      <span
        className={cn(
          'pointer-events-none block min-w-0 flex-1',
          message.role === 'model' && 'max-h-[84px] overflow-hidden',
        )}
        style={
          message.role === 'model'
            ? {
                WebkitMaskImage: 'linear-gradient(to bottom, #000 56%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, #000 56%, transparent 100%)',
              }
            : undefined
        }
      >
        {children}
      </span>
    </button>
  );
}
