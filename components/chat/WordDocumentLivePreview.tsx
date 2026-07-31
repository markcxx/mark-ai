"use client";

import { Check, FileText, Loader2 } from "lucide-react";
import { useMemo } from "react";

import type { ToolProgress } from "@/lib/tools/types";
import { getWordDocumentPreset } from "@/lib/tools/word/presets";
import type {
  WordDocumentBlock,
  WordDocumentPreviewState,
  WordDocumentStyleScope,
  WordDocumentTextStyleOverride,
  WordTextRun,
} from "@/lib/tools/word/types";
import { cn } from "@/lib/utils";

type LivePreviewProps = {
  document: WordDocumentPreviewState;
  progress?: ToolProgress;
  status: "running" | "done" | "error";
};

const color = (value: string | undefined, fallback = "111827") =>
  `#${(value || fallback).replace(/^#/, "")}`;

const textAlign = (value: "center" | "justified" | "left" | "right") =>
  value === "justified" ? ("justify" as const) : value;

const highlightColors: Record<NonNullable<WordTextRun["highlight"]>, string> = {
  cyan: "#67e8f9",
  green: "#86efac",
  lightGray: "#e5e7eb",
  magenta: "#f0abfc",
  red: "#fca5a5",
  yellow: "#fde047",
};

const getText = (block: Extract<WordDocumentBlock, { type: "paragraph" | "quote" }>) =>
  block.runs?.map((run) => run.text).join("") || block.text || "";

const getOverride = (document: WordDocumentPreviewState, scope: WordDocumentStyleScope) => ({
  ...document.styleOverrides?.["all-text"],
  ...(scope === "all-text" ? {} : document.styleOverrides?.[scope]),
});

const getFontFamily = (eastAsia: string, latin: string, override?: string) =>
  [override, eastAsia, latin, "Noto Sans SC", "sans-serif"].filter(Boolean).join(", ");

function InlineRuns({
  defaultColor,
  defaultFont,
  defaultSize,
  runs,
}: {
  defaultColor: string;
  defaultFont: string;
  defaultSize: number;
  runs?: WordTextRun[];
}) {
  if (!runs?.length) return null;
  return runs.map((run, index) => (
    <span
      key={`${index}-${run.text.slice(0, 12)}`}
      style={{
        backgroundColor: run.highlight ? highlightColors[run.highlight] : undefined,
        color: color(run.color, defaultColor),
        fontFamily: run.font || defaultFont,
        fontSize: `${run.size || defaultSize}pt`,
        fontStyle: run.italics ? "italic" : undefined,
        fontWeight: run.bold ? 700 : undefined,
        textDecoration: [run.strike ? "line-through" : "", run.underline ? "underline" : ""]
          .filter(Boolean)
          .join(" ") || undefined,
      }}
    >
      {run.text}
    </span>
  ));
}

function Paper({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-[920px] w-full max-w-[760px] overflow-hidden rounded-sm bg-white px-[8.5%] py-[7.5%] text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.08),0_12px_36px_rgba(0,0,0,0.12)]">
      {children}
    </div>
  );
}

function Opening({ document }: { document: WordDocumentPreviewState }) {
  const preset = getWordDocumentPreset(document.documentType);
  const titleOverride = getOverride(document, "title");
  const bodyOverride = getOverride(document, "body");
  const centered = ["cover", "legal", "notice"].includes(preset.opening.layout);
  const cover = preset.opening.layout === "cover";

  return (
    <div
      className={cn(
        centered ? "text-center" : "text-left",
        cover && "flex min-h-[660px] flex-col items-center justify-center",
      )}
    >
      {["cover", "masthead", "meeting"].includes(preset.opening.layout) && (
        <div
          className="mb-8 text-[10pt] font-bold tracking-[0.08em]"
          style={{ color: color(preset.palette.accent) }}
        >
          {preset.opening.label}
        </div>
      )}
      <h1
        className={cn("font-bold leading-[1.12]", preset.title.rule && "border-b pb-5")}
        style={{
          borderColor: color(preset.title.ruleColor),
          color: color(titleOverride.color, preset.title.color),
          fontFamily: getFontFamily(preset.font.eastAsia, preset.font.latin, titleOverride.font),
          fontSize: `${titleOverride.size || preset.title.size}pt`,
          textAlign: textAlign(preset.title.alignment),
        }}
      >
        {document.title}
      </h1>
      {document.subtitle && (
        <p
          className="mt-5 leading-relaxed"
          style={{
            color: color(preset.palette.muted),
            fontFamily: getFontFamily(preset.font.eastAsia, preset.font.latin, bodyOverride.font),
            fontSize: "12pt",
          }}
        >
          {document.subtitle}
        </p>
      )}
      {document.metadata?.length ? (
        <dl
          className={cn(
            "mt-8 grid gap-x-6 gap-y-3 text-[9.5pt] leading-relaxed",
            preset.opening.layout === "meeting" || preset.opening.layout === "masthead"
              ? "grid-cols-[auto_1fr] rounded-md bg-gray-50 p-5 text-left"
              : "grid-cols-1",
          )}
          style={{
            color: color(preset.palette.muted),
            fontFamily: getFontFamily(preset.font.eastAsia, preset.font.latin, bodyOverride.font),
          }}
        >
          {document.metadata.map((item) => (
            <div className="contents" key={`${item.label}-${item.value}`}>
              <dt className="font-semibold">{item.label}</dt>
              <dd className="m-0">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function TableOfContents({ document }: { document: WordDocumentPreviewState }) {
  const preset = getWordDocumentPreset(document.documentType);
  const completed = new Set(document.completedSectionIds);
  return (
    <div className="mt-10">
      <h2
        className="mb-7 text-[18pt] font-bold"
        style={{ color: color(preset.headings[1].color) }}
      >
        目录
      </h2>
      <div className="space-y-4">
        {document.outline.map((item) => (
          <div
            className="flex items-end gap-2 text-[10.5pt]"
            key={item.id}
            style={{
              color: color(item.level === 1 ? preset.headings[1].color : preset.palette.muted),
              marginLeft: `${(item.level - 1) * 18}px`,
            }}
          >
            <span className="font-medium">{item.title}</span>
            <span className="mb-1 min-w-6 flex-1 border-b border-dotted border-current opacity-55" />
            <span className="inline-flex min-w-12 items-center justify-end gap-1 text-[9pt] opacity-75">
              {completed.has(item.id) ? <Check size={12} /> : "待生成"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const addHeadingNumbers = (
  blocks: WordDocumentBlock[],
  mode: "decimal" | "legal" | "none",
) => {
  const counters = [0, 0, 0];
  return blocks.map((block) => {
    if (block.type !== "heading" || mode === "none") return { block, text: undefined };
    const level = block.level - 1;
    counters[level] += 1;
    for (let index = level + 1; index < counters.length; index += 1) counters[index] = 0;
    const number = counters.slice(0, level + 1).filter(Boolean).join(".");
    return {
      block,
      text: mode === "legal" && level === 0 ? `第${number}条 ${block.text}` : `${number}. ${block.text}`,
    };
  });
};

function DocumentBlocks({ document }: { document: WordDocumentPreviewState }) {
  const preset = getWordDocumentPreset(document.documentType);
  const bodyOverride = getOverride(document, "body");
  const headingOverride = getOverride(document, "headings");
  const tableOverride = getOverride(document, "tables");
  const bodyColor = bodyOverride.color || preset.body.color;
  const bodyFont = getFontFamily(preset.font.eastAsia, preset.font.latin, bodyOverride.font);
  const numberedBlocks = useMemo(
    () => addHeadingNumbers(document.blocks, preset.headingNumbering),
    [document.blocks, preset.headingNumbering],
  );

  if (numberedBlocks.length === 0) {
    return (
      <div className="mt-10 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-400">
        正文将在模型完成第一个章节后显示在这里
      </div>
    );
  }

  return (
    <div className="mt-8" style={{ color: color(bodyColor), fontFamily: bodyFont }}>
      {numberedBlocks.map(({ block, text }) => {
        if (block.type === "page-break") {
          return <div className="my-8 border-t border-dashed border-gray-200" key={block.id} />;
        }
        if (block.type === "heading") {
          const token = preset.headings[block.level];
          return (
            <div
              className="font-bold"
              key={block.id}
              style={{
                color: color(headingOverride.color, token.color),
                fontFamily: getFontFamily(
                  preset.font.eastAsia,
                  preset.font.latin,
                  headingOverride.font,
                ),
                fontSize: `${headingOverride.size || token.size}pt`,
                lineHeight: token.lineSpacing,
                marginBottom: `${token.after}pt`,
                marginTop: `${token.before}pt`,
                textAlign: textAlign(block.format?.alignment || token.alignment),
              }}
            >
              {text || block.text}
            </div>
          );
        }
        if (block.type === "paragraph" || block.type === "quote") {
          const paragraphStyle = block.type === "paragraph" ? block.style : undefined;
          const isNote = block.type === "quote" || paragraphStyle === "note";
          return (
            <p
              className={cn(
                "whitespace-pre-wrap",
                isNote && "border-l-4 px-4 py-2",
                block.type === "quote" && "italic",
                paragraphStyle === "caption" && "text-center italic",
              )}
              key={block.id}
              style={{
                backgroundColor: isNote ? color(preset.palette.calloutFill) : undefined,
                borderColor: isNote ? color(preset.palette.accent) : undefined,
                fontSize: `${bodyOverride.size || preset.body.size}pt`,
                lineHeight: block.format?.lineSpacing || preset.body.lineSpacing,
                marginBottom: `${block.format?.spacingAfter ?? preset.body.after}pt`,
                marginTop: `${block.format?.spacingBefore ?? preset.body.before}pt`,
                textAlign: textAlign(block.format?.alignment || preset.body.alignment),
                textIndent:
                  isNote || paragraphStyle === "caption"
                    ? undefined
                    : `${block.format?.firstLineIndentChars ?? preset.body.firstLineIndentChars}em`,
              }}
            >
              {block.runs?.length ? (
                <InlineRuns
                  defaultColor={bodyColor}
                  defaultFont={bodyFont}
                  defaultSize={bodyOverride.size || preset.body.size}
                  runs={block.runs}
                />
              ) : (
                getText(block)
              )}
            </p>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              className={cn("my-3 space-y-2 pl-7", block.ordered ? "list-decimal" : "list-disc")}
              key={block.id}
              style={{ fontSize: `${bodyOverride.size || preset.body.size}pt` }}
            >
              {block.items.map((item, index) => (
                <li key={`${index}-${item.slice(0, 16)}`}>{item}</li>
              ))}
            </List>
          );
        }
        return (
          <div className="my-5 overflow-x-auto" key={block.id}>
            <table
              className="w-full border-collapse text-left"
              style={{ fontSize: `${tableOverride.size || preset.table.bodyFontSize}pt` }}
            >
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr
                    className={cn(
                      preset.table.alternateRows && rowIndex > 0 && rowIndex % 2 === 0 &&
                        "bg-gray-50",
                    )}
                    key={`${rowIndex}-${row.join("-").slice(0, 24)}`}
                  >
                    {row.map((cell, columnIndex) => {
                      const Cell = block.header && rowIndex === 0 ? "th" : "td";
                      return (
                        <Cell
                          className="border px-3 py-2 align-middle"
                          key={`${columnIndex}-${cell.slice(0, 16)}`}
                          style={{
                            backgroundColor:
                              block.header && rowIndex === 0
                                ? color(preset.table.headerFill)
                                : undefined,
                            borderColor: color(preset.palette.border),
                            color:
                              block.header && rowIndex === 0
                                ? color(preset.table.headerTextColor)
                                : color(tableOverride.color, bodyColor),
                            fontWeight: block.header && rowIndex === 0 ? 700 : undefined,
                            textAlign: block.header && rowIndex === 0 ? "center" : "left",
                          }}
                        >
                          {cell}
                        </Cell>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export function WordDocumentLivePreview({ document, progress, status }: LivePreviewProps) {
  const preset = getWordDocumentPreset(document.documentType);
  const hasToc = document.features.includes("table-of-contents");
  const hasCover = preset.opening.pageBreakAfter;

  return (
    <div className="h-full overflow-auto bg-[#e8e9ec] p-3 dark:bg-[#101113] md:p-5">
      <div className="mx-auto mb-3 flex w-full max-w-[760px] items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#191919]/95">
        <span className="flex min-w-0 items-center gap-2 font-medium text-gray-700 dark:text-gray-200">
          {status === "running" ? (
            <Loader2 className="shrink-0 animate-spin text-primary" size={14} />
          ) : (
            <FileText className="shrink-0 text-primary" size={14} />
          )}
          <span className="truncate">
            {status === "running" ? progress?.label || "正在更新实时预览" : "实时预览已更新"}
          </span>
        </span>
        <span className="shrink-0 text-gray-400">
          {document.completedSectionIds.length}/{document.outline.length} 章节
        </span>
      </div>

      <div className="space-y-5 pb-8">
        <Paper>
          <Opening document={document} />
          {!hasCover && hasToc && <TableOfContents document={document} />}
          {!hasCover && !hasToc && <DocumentBlocks document={document} />}
        </Paper>
        {hasCover && hasToc && (
          <Paper>
            <TableOfContents document={document} />
          </Paper>
        )}
        {(hasCover || hasToc) && (
          <Paper>
            <DocumentBlocks document={document} />
          </Paper>
        )}
      </div>
    </div>
  );
}
