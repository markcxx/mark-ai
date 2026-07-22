"use client";

import React from "react";
import { Check, Copy } from "lucide-react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Pre, PreSingleLine } from "@/components/CodeBlock";
import type { WebCitation } from "@/lib/chat/citations";
import type { GeneralSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { rehypeStreamAnimated } from "@/lib/markdown/rehype-stream-animated";

import { HtmlPreviewBlock } from "./HtmlPreviewBlock";
import { CitationReference } from "./message/MessageSources";

const EChartsPreviewBlock = dynamic(
  () => import("./EChartsPreviewBlock").then((module) => module.EChartsPreviewBlock),
  {
    loading: () => (
      <div className="my-5 h-[340px] animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.04]" />
    ),
    ssr: false,
  },
);

const MermaidPreviewBlock = dynamic(
  () => import("./MermaidPreviewBlock").then((module) => module.MermaidPreviewBlock),
  {
    loading: () => (
      <div className="my-5 h-[340px] animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.04]" />
    ),
    ssr: false,
  },
);

const MarkmapPreviewBlock = dynamic(
  () => import("./MarkmapPreviewBlock").then((module) => module.MarkmapPreviewBlock),
  {
    loading: () => (
      <div className="my-5 h-[340px] animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.04]" />
    ),
    ssr: false,
  },
);

type MarkdownNode = {
  children?: MarkdownNode[];
  type: string;
  url?: string;
  value?: string;
};

const createCitationPlugin = (citationIds: Set<number>) => () => (tree: MarkdownNode) => {
  const transform = (node: MarkdownNode) => {
    if (!node.children || node.type === "link" || node.type === "linkReference") return;

    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (child.type !== "text" || !child.value) {
        transform(child);
        continue;
      }

      const parts: MarkdownNode[] = [];
      const pattern = /\[(\d+)\]/g;
      let cursor = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(child.value))) {
        const citationId = Number(match[1]);
        if (!citationIds.has(citationId)) continue;
        if (match.index > cursor) {
          parts.push({ type: "text", value: child.value.slice(cursor, match.index) });
        }
        parts.push({
          children: [{ type: "text", value: match[0] }],
          type: "link",
          url: `#citation-${citationId}`,
        });
        cursor = match.index + match[0].length;
      }

      if (parts.length === 0) continue;
      if (cursor < child.value.length) {
        parts.push({ type: "text", value: child.value.slice(cursor) });
      }
      node.children.splice(index, 1, ...parts);
      index += parts.length - 1;
    }
  };

  transform(tree);
};

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
    <div className="markdown-table-wrapper">
      <button
        aria-label={copied ? "表格已复制" : "复制表格"}
        className="markdown-table-copy"
        onClick={() => void copyTable()}
        title={copied ? "已复制" : "复制表格"}
        type="button"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <table className="markdown-table" ref={tableRef} {...props}>
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
    if (language === "echarts" || language === "echart" || language === "chart") {
      return <EChartsPreviewBlock>{String(children)}</EChartsPreviewBlock>;
    }
    if (language === "mermaid") {
      return <MermaidPreviewBlock>{String(children)}</MermaidPreviewBlock>;
    }
    if (language === "markmap" || language === "mindmap") {
      return <MarkmapPreviewBlock>{String(children)}</MarkmapPreviewBlock>;
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
  citations = [],
  streaming = false,
}: {
  animation?: GeneralSettings["responseAnimation"];
  children: string;
  citations?: WebCitation[];
  streaming?: boolean;
}) {
  const animateNewWords = streaming && animation === "fade";
  const citationById = React.useMemo(
    () => new Map(citations.map((citation) => [citation.citationId, citation])),
    [citations],
  );
  const citationPlugin = React.useMemo(
    () =>
      createCitationPlugin(
        new Set(
          citations
            .filter((citation) => citation.structured)
            .map((citation) => citation.citationId),
        ),
      ),
    [citations],
  );
  const components = React.useMemo(
    () => ({
      ...markdownComponents,
      a: ({
        href,
        node: _node,
        ...props
      }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => {
        const match = href?.match(/^#citation-(\d+)$/);
        const citation = match ? citationById.get(Number(match[1])) : undefined;
        if (citation) return <CitationReference citation={citation} />;

        return (
          <a
            className="text-primary transition-colors hover:text-blue-700 hover:underline dark:hover:text-blue-300"
            href={href}
            {...props}
          />
        );
      },
    }),
    [citationById],
  );

  return (
    <div className={cn(animateNewWords && "streaming-markdown")}>
      <ReactMarkdown
        components={components}
        rehypePlugins={
          animateNewWords ? [[rehypeStreamAnimated, { granularity: "word" }]] : undefined
        }
        remarkPlugins={[remarkGfm, citationPlugin]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
