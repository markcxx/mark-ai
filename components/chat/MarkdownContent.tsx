'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Pre, PreSingleLine } from '@/components/CodeBlock';

const getTextFromNode = (node: React.ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getTextFromNode).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getTextFromNode(node.props.children);
  }
  return '';
};

const renderAdmonitionParagraph = (children: React.ReactNode) => {
  const text = getTextFromNode(children);
  const match = text.match(/^\[!(TIP|NOTE|WARNING|IMPORTANT|CAUTION)\]\s*([\s\S]*)/);

  if (!match) {
    return <p className="mb-4 leading-relaxed last:mb-0">{children}</p>;
  }

  const [, type, body] = match;
  return (
    <p className="mb-0 leading-relaxed">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">
        {type}
      </span>
      {body.trim()}
    </p>
  );
};

const markdownComponents = {
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-primary transition-colors hover:text-blue-700 hover:underline" {...props} />
  ),
  blockquote: (props: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="my-4 rounded-lg border border-blue-100 border-l-4 border-l-primary/70 bg-blue-50/70 px-4 py-3 text-gray-700 shadow-sm"
      {...props}
    />
  ),
  code({ children, className }: { children?: React.ReactNode; className?: string }) {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match && !String(children).includes('\n');
    if (isInline) {
      return <PreSingleLine>{children}</PreSingleLine>;
    }
    return <Pre language={match?.[1] || 'text'}>{String(children)}</Pre>;
  },
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mb-4 mt-6 text-2xl font-semibold text-gray-900" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mb-4 mt-6 text-xl font-semibold text-gray-900" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mb-4 mt-6 text-lg font-semibold text-gray-900" {...props} />
  ),
  ol: (props: React.OlHTMLAttributes<HTMLOListElement>) => (
    <ol className="mb-4 ml-2 list-inside list-decimal space-y-1 text-gray-700" {...props} />
  ),
  p: ({ children }: { children?: React.ReactNode }) => renderAdmonitionParagraph(children),
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="w-full border-collapse" {...props} />
    </div>
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-b border-gray-200 px-4 py-3 text-sm text-gray-600" {...props} />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-700"
      {...props}
    />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="mb-4 ml-2 list-inside list-disc space-y-1 text-gray-700" {...props} />
  ),
};

export function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
      {children}
    </ReactMarkdown>
  );
}

