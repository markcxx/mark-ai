'use client';

import type { RefObject } from 'react';
import { useState } from 'react';
import { ModelIcon } from '@lobehub/icons';
import { ChevronRight, Globe2, Mic, Paperclip, Search, SendHorizontal, Square } from 'lucide-react';

import type { ConfiguredModel } from '@/lib/chat/types';
import { cn } from '@/lib/utils';
import { ModelSelectorDialog } from './ModelSelectorDialog';

export function ChatInput({
  availableModels,
  input,
  isLoading,
  isLoadingModels,
  modelSearchKeyword,
  onAttachment,
  onInput,
  onKeyDown,
  onMic,
  onSend,
  placement = 'bottom',
  providerNames,
  selectedModel,
  selectedModelKey,
  setModelSearchKeyword,
  setSelectedModelKey,
  textareaRef,
  webSearchEnabled,
  onToggleWebSearch,
}: {
  availableModels: ConfiguredModel[];
  input: string;
  isLoading: boolean;
  isLoadingModels: boolean;
  modelSearchKeyword: string;
  onAttachment: () => void;
  onInput: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onMic: () => void;
  onSend: () => void;
  placement?: 'bottom' | 'center';
  providerNames: Record<string, string>;
  selectedModel?: ConfiguredModel;
  selectedModelKey: string;
  setModelSearchKeyword: (keyword: string) => void;
  setSelectedModelKey: (key: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
}) {
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);

  const providerDisplayName = selectedModel
    ? providerNames[selectedModel.provider] || selectedModel.provider
    : undefined;

  return (
    <>
      <div
        className={cn(
          placement === 'bottom'
            ? 'pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex justify-center bg-gradient-to-t from-[var(--chat-input-overlay-from)] via-[var(--chat-input-overlay-via)] to-transparent px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-8 md:p-4 md:px-8 md:pb-8 md:pt-10'
            : 'w-full',
        )}
      >
        <div
          className={cn(
            'w-full',
            placement === 'bottom' ? 'pointer-events-auto max-w-[840px]' : 'max-w-[760px]',
          )}
        >
          <div className="relative flex flex-col rounded-xl border border-gray-200 bg-[var(--chat-input-bg)] shadow-[0_12px_32px_rgba(0,0,0,0.06)] transition-all duration-300 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/20 dark:border-white/10 dark:shadow-[0_14px_40px_rgba(0,0,0,0.35)] dark:focus-within:border-white/20 dark:focus-within:ring-white/[0.06]">
            <textarea
              className="max-h-[36dvh] min-h-[56px] w-full resize-none border-none bg-transparent px-3 py-3 text-[16px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100 dark:placeholder:text-gray-500 md:max-h-[200px] md:min-h-[64px] md:px-4 md:py-4 md:text-[15px]"
              disabled={isLoading || !selectedModel}
              onChange={onInput}
              onKeyDown={onKeyDown}
              placeholder={selectedModel ? '尽管问，带图也行...' : '请先在环境变量中配置可用模型'}
              ref={textareaRef}
              rows={1}
              value={input}
            />

            <div className="flex items-center justify-between px-2.5 pb-2.5 pt-1 md:px-3 md:pb-3">
              <div className="flex items-center gap-1">
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={onAttachment}
                  title="添加附件"
                  type="button"
                >
                  <Paperclip size={20} />
                </button>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={onMic}
                  title="语音输入"
                  type="button"
                >
                  <Mic size={20} />
                </button>
                <button
                  className={cn(
                    'flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors',
                    webSearchEnabled
                      ? 'text-sky-700 hover:bg-sky-50 dark:text-sky-200 dark:hover:bg-sky-500/10'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200',
                    isLoading && 'cursor-not-allowed opacity-60',
                  )}
                  disabled={isLoading}
                  onClick={onToggleWebSearch}
                  title={webSearchEnabled ? '关闭联网搜索' : '开启联网搜索'}
                  type="button"
                >
                  <Globe2 size={18} />
                  <span className="hidden text-sm sm:inline">联网搜索</span>
                  <span
                    className={cn(
                      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                      webSearchEnabled ? 'bg-sky-500' : 'bg-gray-300 dark:bg-gray-600',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
                        webSearchEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]',
                      )}
                    />
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="flex h-9 max-w-[240px] items-center gap-2 rounded-lg px-2.5 text-sm text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoadingModels || availableModels.length === 0}
                  onClick={() => {
                    if (availableModels.length > 0) setIsModelDialogOpen(true);
                  }}
                  title="选择模型"
                  type="button"
                >
                  {selectedModel ? (
                    <>
                      <ModelIcon model={selectedModel.id} size={20} type="avatar" />
                      <span className="hidden max-w-[160px] truncate text-[13px] sm:inline">
                        {selectedModel.id}
                      </span>
                    </>
                  ) : (
                    <span className="max-w-[120px] truncate">
                      {isLoadingModels ? '加载中' : '未配置模型'}
                    </span>
                  )}
                  <ChevronRight
                    className="shrink-0 text-gray-400"
                    size={14}
                  />
                </button>
                <button
                  aria-label={isLoading ? '停止生成' : '发送消息'}
                  className={cn(
                    'relative flex h-9 w-9 min-w-9 items-center justify-center overflow-hidden rounded-full bg-gray-950 text-white shadow-sm transition-transform duration-150 ease-out hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:scale-100 dark:bg-white dark:text-gray-950 dark:disabled:bg-gray-700 dark:disabled:text-gray-400',
                    isLoading && 'bg-red-500 text-white hover:bg-red-600 dark:bg-red-500 dark:text-white dark:hover:bg-red-600',
                  )}
                  disabled={(!input.trim() && !isLoading) || !selectedModel}
                  onClick={onSend}
                  title={isLoading ? '停止生成' : '发送'}
                  type="button"
                >
                  {isLoading ? (
                    <>
                      <span className="absolute inset-1 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <Square className="relative z-10" fill="currentColor" size={11} />
                    </>
                  ) : (
                    <SendHorizontal size={17} />
                  )}
                </button>
              </div>
            </div>
          </div>

          <p className="mt-3 hidden text-center font-jakarta text-xs text-gray-400 sm:block">
            内容由 AI 生成，请注意甄别。
          </p>
        </div>
      </div>

      <ModelSelectorDialog
        availableModels={availableModels}
        modelSearchKeyword={modelSearchKeyword}
        onClose={() => {
          setIsModelDialogOpen(false);
          setModelSearchKeyword('');
        }}
        open={isModelDialogOpen}
        providerNames={providerNames}
        selectedModelKey={selectedModelKey}
        setModelSearchKeyword={setModelSearchKeyword}
        setSelectedModelKey={setSelectedModelKey}
      />
    </>
  );
}
