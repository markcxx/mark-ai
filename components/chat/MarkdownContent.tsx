"use client";

import React from "react";
import { rehypeStreamAnimated } from "@lobehub/ui";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Pre, PreSingleLine } from "@/components/CodeBlock";
import type { GeneralSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

import { HtmlPreviewBlock } from "./HtmlPreviewBlock";

const getTextFromNode = (node: React.ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextFromNode).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getTextFromNode(node.props.children);
  }
  return "";
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

const tableToMarkdown = (table: HTMLTableElement) => {
  const rows = Array.from(table.rows).map((row) =>
    Array.from(row.cells).map((cell) =>
      (cell.textContent || "").trim().replaceAll("|", "\\|").replace(/\r?\n/g, "<br>"),
    ),
  );
  if (rows.length === 0) return "";

  const columnCount = Math.max(...rows.map((row) => row.length));
  const formatRow = (row: string[]) =>
    `| ${Array.from({ length: columnCount }, (_, index) => row[index] || "").join(" | ")} |`;

  return [
    formatRow(rows[0]),
    `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`,
    ...rows.slice(1).map(formatRow),
  ].join("\n");
};

function MarkdownTable({
  children,
  node: _node,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & { node?: unknown }) {
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [copied, setCopied] = React.useState(false);

  const copyTable = async () => {
    if (!tableRef.current) return;
    await navigator.clipboard.writeText(tableToMarkdown(tableRef.current));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="lobe-markdown-table-wrapper">
      <button
        aria-label={copied ? "表格已复制" : "复制表格"}
        className="lobe-markdown-table-copy"
        onClick={() => void copyTable()}
        title={copied ? "已复制" : "复制表格"}
        type="button"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <table className="lobe-markdown-table" ref={tableRef} {...props}>
        {children}
      </table>
    </div>
  );
}

const markdownComponents = {
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-primary transition-colors hover:text-blue-700 hover:underline dark:hover:text-blue-300"
      {...props}
    />
  ),
  blockquote: (props: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="my-4 border-0 border-l-4 border-solid border-l-gray-300 px-4 py-0 text-gray-500 dark:border-l-gray-600 dark:text-gray-400"
      {...props}
    />
  ),
  code({ children, className }: { children?: React.ReactNode; className?: string }) {
    const match = /language-(\w+)/.exec(className || "");
    const language = match?.[1]?.toLowerCase() || "text";
    const isInline = !match && !String(children).includes("\n");
    if (isInline) {
      return <PreSingleLine>{children}</PreSingleLine>;
    }
    if (language === "html" || language === "htm") {
      return <HtmlPreviewBlock>{String(children)}</HtmlPreviewBlock>;
    }
    return <Pre language={language}>{String(children)}</Pre>;
  },
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mb-4 mt-6 text-2xl font-semibold text-gray-900 dark:text-gray-100" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mb-4 mt-6 text-xl font-semibold text-gray-900 dark:text-gray-100" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mb-4 mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100" {...props} />
  ),
  ol: (props: React.OlHTMLAttributes<HTMLOListElement>) => (
    <ol
      className="mb-4 ml-2 list-inside list-decimal space-y-1 text-gray-700 dark:text-gray-300"
      {...props}
    />
  ),
  p: ({ children }: { children?: React.ReactNode }) => renderAdmonitionParagraph(children),
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  table: MarkdownTable,
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => <td {...props} />,
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => <th {...props} />,
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className="mb-4 ml-2 list-inside list-disc space-y-1 text-gray-700 dark:text-gray-300"
      {...props}
    />
  ),
};

export function MarkdownContent({
  animation = "none",
  children,
  streaming = false,
}: {
  animation?: GeneralSettings["responseAnimation"];
  children: string;
  streaming?: boolean;
}) {
  const animateNewWords = streaming && animation === "fade";

  return (
    <div className={cn(animateNewWords && "streaming-markdown")}>
      <ReactMarkdown
        components={markdownComponents}
        rehypePlugins={
          animateNewWords ? [[rehypeStreamAnimated, { granularity: "word" }]] : undefined
        }
        remarkPlugins={[remarkGfm]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
