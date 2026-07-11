'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ModelIcon } from '@lobehub/icons';
import { Check, Search, X } from 'lucide-react';

import type { ConfiguredModel } from '@/lib/chat/types';
import { getModelDisplayName, getModelKey } from '@/lib/chat/helpers';
import { cn } from '@/lib/utils';

type ModelGroup = {
  displayName: string;
  models: ConfiguredModel[];
  provider: string;
};

export function ModelSelectorDialog({
  availableModels,
  modelSearchKeyword,
  onClose,
  open,
  providerNames,
  selectedModelKey,
  setModelSearchKeyword,
  setSelectedModelKey,
}: {
  availableModels: ConfiguredModel[];
  modelSearchKeyword: string;
  onClose: () => void;
  open: boolean;
  providerNames: Record<string, string>;
  selectedModelKey: string;
  setModelSearchKeyword: (keyword: string) => void;
  setSelectedModelKey: (key: string) => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        if (selectedItemRef.current) {
          selectedItemRef.current.scrollIntoView({ block: 'center' });
        }
        searchInputRef.current?.focus();
      });
    }
  }, [open]);

  const keyword = modelSearchKeyword.trim().toLowerCase();

  const groups = useMemo(() => {
    const providerOrder: string[] = [];
    const providerMap = new Map<string, ConfiguredModel[]>();

    for (const model of availableModels) {
      if (keyword && !model.id.toLowerCase().includes(keyword) && !getModelDisplayName(model.id).toLowerCase().includes(keyword)) continue;
      const p = model.provider;
      if (!providerMap.has(p)) {
        providerOrder.push(p);
        providerMap.set(p, []);
      }
      providerMap.get(p)!.push(model);
    }

    return providerOrder.map(
      (p): ModelGroup => ({
        displayName: providerNames[p] || p,
        models: providerMap.get(p)!,
        provider: p,
      }),
    );
  }, [availableModels, providerNames, keyword]);

  const totalFiltered = groups.reduce((sum, g) => sum + g.models.length, 0);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(80dvh,600px)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_18px_60px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-[#191919]">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-4 dark:border-white/10">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">选择模型</h3>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.06]"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex h-10 shrink-0 items-center border-b border-gray-100 px-3 dark:border-white/[0.06]">
          <div className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-gray-400 focus-within:bg-gray-50 dark:focus-within:bg-white/[0.04]">
            <Search size={15} />
            <input
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
              onChange={(e) => setModelSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="搜索模型..."
              ref={searchInputRef}
              value={modelSearchKeyword}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {totalFiltered > 0 ? (
            groups.map((group) => (
              <div key={group.provider}>
                <div className="sticky top-0 z-10 flex h-8 items-center gap-2 bg-gray-50/90 px-4 backdrop-blur-sm dark:bg-[#1f1f1f]/90">
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                    {group.displayName}
                  </span>
                  <div className="h-px flex-1 bg-gray-200 dark:bg-white/[0.06]" />
                  <span className="text-[11px] tabular-nums text-gray-300 dark:text-gray-600">
                    {group.models.length}
                  </span>
                </div>
                <div className="px-1.5 pb-1">
                  {group.models.map((model) => {
                    const key = getModelKey(model);
                    const isSelected = key === selectedModelKey;

                    return (
                      <button
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          isSelected
                            ? 'bg-gray-100 text-gray-950 dark:bg-white/[0.08] dark:text-gray-50'
                            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]',
                        )}
                        key={key}
                        onClick={() => {
                          setSelectedModelKey(key);
                          setModelSearchKeyword('');
                          onClose();
                        }}
                        ref={isSelected ? selectedItemRef : undefined}
                        type="button"
                      >
                        <ModelIcon model={model.id} size={22} type="avatar" />
                        <span className="min-w-0 flex-1 truncate">{getModelDisplayName(model.id)}</span>
                        {isSelected && (
                          <Check className="shrink-0 text-gray-400" size={16} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm text-gray-400">没有匹配的模型</div>
          )}
        </div>
      </div>
    </div>
  );
}
