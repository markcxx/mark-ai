export const WORD_DOCUMENT_TYPES = [
  "general-clean",
  "contract",
  "business-proposal",
  "formal-report",
  "academic-paper",
  "meeting-minutes",
  "official-notice",
  "operations-manual",
  "resume",
  "product-spec",
] as const;

export type WordDocumentType = (typeof WORD_DOCUMENT_TYPES)[number];

export const LEGACY_WORD_DOCUMENT_PRESETS = [
  "formal-report-cn",
  "business-clean",
  "academic-cn",
] as const;

export const WORD_DOCUMENT_PRESETS = [
  ...WORD_DOCUMENT_TYPES,
  ...LEGACY_WORD_DOCUMENT_PRESETS,
] as const;

export type WordDocumentPresetId = (typeof WORD_DOCUMENT_PRESETS)[number];

export const resolveWordDocumentType = (
  value: WordDocumentPresetId | WordDocumentType,
): WordDocumentType => {
  if (value === "formal-report-cn") return "formal-report";
  if (value === "business-clean") return "general-clean";
  if (value === "academic-cn") return "academic-paper";
  return value;
};

export const WORD_DOCUMENT_STYLE_SCOPES = [
  "all-text",
  "body",
  "headings",
  "title",
  "tables",
] as const;

export type WordDocumentStyleScope = (typeof WORD_DOCUMENT_STYLE_SCOPES)[number];

export type WordDocumentTextStyleOverride = {
  color?: string;
  font?: string;
  size?: number;
};

export type WordDocumentFeature = "header" | "page-number" | "table-of-contents";

export type WordDocumentMetadataItem = {
  label: string;
  value: string;
};

export type WordOutlineItem = {
  id: string;
  level: 1 | 2 | 3;
  title: string;
};

export type WordTextRun = {
  bold?: boolean;
  color?: string;
  font?: string;
  highlight?: "cyan" | "green" | "lightGray" | "magenta" | "red" | "yellow";
  italics?: boolean;
  size?: number;
  strike?: boolean;
  text: string;
  underline?: boolean;
};

export type WordParagraphFormat = {
  alignment?: "center" | "justified" | "left" | "right";
  firstLineIndentChars?: number;
  keepNext?: boolean;
  lineSpacing?: number;
  spacingAfter?: number;
  spacingBefore?: number;
};

type WordBlockBase = {
  format?: WordParagraphFormat;
  id: string;
};

export type WordHeadingBlock = WordBlockBase & {
  level: 1 | 2 | 3;
  text: string;
  type: "heading";
};

export type WordParagraphBlock = WordBlockBase & {
  runs?: WordTextRun[];
  style?: "body" | "caption" | "note";
  text?: string;
  type: "paragraph";
};

export type WordQuoteBlock = WordBlockBase & {
  runs?: WordTextRun[];
  text?: string;
  type: "quote";
};

export type WordListBlock = WordBlockBase & {
  items: string[];
  level?: number;
  ordered?: boolean;
  type: "list";
};

export type WordTableBlock = WordBlockBase & {
  header?: boolean;
  rows: string[][];
  type: "table";
};

export type WordPageBreakBlock = WordBlockBase & {
  type: "page-break";
};

export type WordDocumentBlock =
  | WordHeadingBlock
  | WordParagraphBlock
  | WordQuoteBlock
  | WordListBlock
  | WordTableBlock
  | WordPageBreakBlock;

export type WordDocumentJob = {
  blocks: WordDocumentBlock[];
  completedSectionIds: string[];
  createdAt: number;
  documentType: WordDocumentType;
  features: WordDocumentFeature[];
  filename?: string;
  generatedFileId?: string;
  id: string;
  inspectedRevision?: number;
  outline: WordOutlineItem[];
  preset: WordDocumentPresetId;
  revision: number;
  sectionBlockIds: Record<string, string[]>;
  styleOverrides?: Partial<Record<WordDocumentStyleScope, WordDocumentTextStyleOverride>>;
  subtitle?: string;
  metadata?: WordDocumentMetadataItem[];
  title: string;
};

export type WordDocumentPreviewState = {
  blocks: WordDocumentBlock[];
  completedSectionIds: string[];
  documentId: string;
  documentType: WordDocumentType;
  features: WordDocumentFeature[];
  kind: "word-document";
  metadata?: WordDocumentMetadataItem[];
  outline: WordOutlineItem[];
  revision: number;
  styleOverrides?: Partial<Record<WordDocumentStyleScope, WordDocumentTextStyleOverride>>;
  subtitle?: string;
  title: string;
};

export type WordDocumentInspection = {
  blockCount: number;
  canFinalize: boolean;
  completedSections: number;
  documentId: string;
  missingSections: Array<{ id: string; title: string }>;
  outlineSections: number;
  revision: number;
  summary: Array<{
    id: string;
    preview: string;
    type: WordDocumentBlock["type"];
  }>;
  warnings: string[];
};
