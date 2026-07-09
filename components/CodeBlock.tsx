import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

const countLines = (value: string) => (value.match(/\n/g)?.length || 0) + 1;

const normalizeLanguage = (language?: string) => {
  if (!language?.trim()) return 'txt';
  return language.trim().toLowerCase();
};

export const Pre = ({ children, language }: { children: string, language: string }) => {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const normalizedLanguage = normalizeLanguage(language);
  const lineCount = countLines(children.replace(/\n$/, ''));
  const collapsible = lineCount > 8;
  const [collapsed, setCollapsed] = useState(false);
  const syntaxTheme = resolvedTheme === 'dark' ? oneDark : oneLight;

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-5 overflow-hidden rounded-xl border border-gray-200 bg-[#f8f9fa] dark:border-gray-700 dark:bg-gray-950">
      <div
        className={cn(
          'flex h-10 w-full items-center justify-between bg-white/80 px-3 text-left transition-colors dark:bg-gray-900/80',
          !collapsed && 'border-b border-gray-200/80 dark:border-gray-700',
          collapsible && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800',
        )}
        onClick={() => {
          if (collapsible) setCollapsed((value) => !value);
        }}
        onKeyDown={(event) => {
          if (!collapsible) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setCollapsed((value) => !value);
          }
        }}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
      >
        <span className="rounded-md bg-gray-100 px-2 py-1 font-jakarta text-xs font-medium uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {normalizedLanguage}
        </span>
        <div className="flex items-center gap-1">
          {collapsible && (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              title={collapsed ? '展开代码' : '折叠代码'}
            >
              {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </span>
          )}
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            onClick={(event) => {
              event.stopPropagation();
              handleCopy();
            }}
            title="复制代码"
            type="button"
          >
            {copied ? <Check className="text-green-600" size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <div
        className={cn(
          'relative overflow-x-auto px-4 py-4 font-mono text-[13px] leading-relaxed transition-[max-height,padding] duration-200 ease-out',
          collapsed && 'max-h-0 overflow-hidden py-0',
        )}
      >
        <SyntaxHighlighter
          language={normalizedLanguage}
          style={syntaxTheme as any}
          showLineNumbers={true}
          customStyle={{ margin: 0, padding: 0, background: 'transparent' }}
          lineNumberStyle={{ minWidth: '2.5em', paddingRight: '1em', color: '#cbd5e1', textAlign: 'right', userSelect: 'none' }}
        >
          {children.replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export const PreSingleLine = ({ children }: { children: React.ReactNode }) => {
  return (
    <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-[#f3f4f5] text-gray-800 text-[13px] font-mono border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
      {children}
    </code>
  );
};
