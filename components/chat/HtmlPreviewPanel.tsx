'use client';

import { Code2, Download, Eye, Maximize2, Minimize2, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Pre } from '@/components/CodeBlock';
import { cn } from '@/lib/utils';

import { downloadHtmlFile, getHtmlPreviewDocument, type HtmlPreviewPayload } from './htmlPreviewUtils';

type PreviewMode = 'preview' | 'code';

function PreviewFrame({ content, title }: { content: string; title: string }) {
  return (
    <iframe
      className="h-full w-full bg-white"
      referrerPolicy="no-referrer"
      sandbox="allow-forms allow-modals allow-scripts"
      srcDoc={content}
      title={title}
    />
  );
}

function PreviewTabs({
  mode,
  onModeChange,
}: {
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
}) {
  return (
    <div className="relative grid h-8 w-[70px] grid-cols-2 rounded-lg bg-gray-100 p-0.5 dark:bg-white/[0.06]">
      <span
        className={cn(
          'absolute bottom-0.5 top-0.5 w-[33px] rounded-md bg-white shadow-sm transition-transform duration-200 dark:bg-[#262626]',
          mode === 'code' && 'translate-x-[33px]',
        )}
      />
      {[
        { icon: Eye, key: 'preview' as const, title: '预览' },
        { icon: Code2, key: 'code' as const, title: '源码' },
      ].map((item) => {
        const Icon = item.icon;
        const active = mode === item.key;

        return (
          <button
            className={cn(
              'relative z-10 flex h-7 items-center justify-center rounded-md transition-colors',
              active
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
            )}
            key={item.key}
            onClick={() => onModeChange(item.key)}
            title={item.title}
            type="button"
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}

export function HtmlPreviewPanel({
  fullscreen,
  onClose,
  onFullscreenChange,
  preview,
}: {
  fullscreen: boolean;
  onClose: () => void;
  onFullscreenChange: (fullscreen: boolean) => void;
  preview: HtmlPreviewPayload;
}) {
  const [mode, setMode] = useState<PreviewMode>('preview');
  const previewDocument = useMemo(() => getHtmlPreviewDocument(preview.content), [preview.content]);

  return (
    <aside className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#e5e5e5] bg-[var(--chat-panel-bg)] opacity-100 shadow-none transition-opacity duration-300 ease-out dark:border-gray-700">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-gray-200 bg-[var(--chat-header-bg)] px-3 backdrop-blur-md dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2">
          <PreviewTabs mode={mode} onModeChange={setMode} />
          <div className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {preview.title}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
            onClick={() => downloadHtmlFile(preview.content, preview.title)}
            title="下载 HTML"
            type="button"
          >
            <Download size={15} />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
            onClick={() => onFullscreenChange(!fullscreen)}
            title={fullscreen ? '恢复分栏' : '全屏预览'}
            type="button"
          >
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
            onClick={onClose}
            title="关闭预览"
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === 'preview' ? (
          <PreviewFrame content={previewDocument} title={preview.title} />
        ) : (
          <div className="h-full overflow-auto p-4">
            <Pre language="html">{preview.content}</Pre>
          </div>
        )}
      </div>
    </aside>
  );
}
