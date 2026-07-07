import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export const Pre = ({ children, language }: { children: string, language: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-5 rounded-xl border border-gray-100 bg-[#f8f9fa] overflow-hidden">
      <button 
        onClick={handleCopy} 
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-800 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="复制代码"
      >
        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
      </button>
      <div className="px-4 py-4 overflow-x-auto text-[13px] font-mono leading-relaxed relative">
        <SyntaxHighlighter
          language={language}
          style={oneLight as any}
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
    <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-[#f3f4f5] text-gray-800 text-[13px] font-mono border border-gray-200">
      {children}
    </code>
  );
};
