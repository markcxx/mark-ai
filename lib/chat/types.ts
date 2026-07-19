import type { ComponentType } from "react";

export type ThinkingSegment = {
  type: "thinking";
  content: string;
  duration?: number;
  isActive?: boolean;
};

export type ToolSegment = {
  type: "tool";
  webSearch: WebSearchState;
};

export type ContentSegment = {
  type: "content";
  content: string;
};

export type GeneratedFileState = {
  callId: string;
  error?: string;
  file?: FileAttachment & { url: string };
  status: "running" | "done" | "error";
  toolId: string;
  toolName: string;
};

export type GeneratedFileSegment = {
  type: "generated-file";
  generatedFile: GeneratedFileState;
};

export type TranslationSegment = {
  type: "translation";
  content: string;
  language: string;
};

export type MessageSegment =
  | ThinkingSegment
  | ToolSegment
  | ContentSegment
  | GeneratedFileSegment
  | TranslationSegment;

export type FileAttachment = {
  id: string;
  name: string;
  size: number;
  contentType: string;
  kind?: "attachment" | "avatar";
};

export type MessageVariant = {
  id: string;
  content: string;
  createdAt?: number;
  reasoning?: string;
  reasoningDuration?: number;
  generationDuration?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  tokenUsageSource?: TokenUsageSource;
  interrupted?: boolean;
  isReasoning?: boolean;
  isStreaming?: boolean;
  model?: string;
  provider?: string;
  webSearch?: WebSearchState[];
  segments?: MessageSegment[];
};

export type TokenUsageSource = "estimated" | "provider";

export type Message = MessageVariant & {
  activeVariantId?: string;
  attachments?: FileAttachment[];
  role: "user" | "model";
  variants?: MessageVariant[];
};

export type RegenerateMode = "preserve" | "replace";

export type WebSearchResult = {
  citationId?: number;
  content?: string;
  favicon?: string;
  publishedDate?: string;
  score?: number;
  title: string;
  url: string;
};

export type WebSearchState = {
  answer?: string;
  completedAt?: number;
  content?: string;
  costTime?: number;
  description?: string;
  error?: string;
  query: string;
  siteName?: string;
  results: WebSearchResult[];
  title?: string;
  tool?: "web_search" | "read_webpage";
  status: "searching" | "done" | "error";
  url?: string;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  favorite?: boolean;
  model?: string;
  provider?: string;
  revision: number;
  messageCount: number;
};

export type ChatStreamEvent = {
  generatedFile?: GeneratedFileState;
  inputTokens?: number;
  outputTokens?: number;
  text?: string;
  totalTokens?: number;
  tokenUsageSource?: TokenUsageSource;
  type?: "content" | "file" | "reasoning" | "tool" | "usage";
  webSearch?: WebSearchState;
};

export type ConfiguredModel = {
  id: string;
  provider: string;
};

export type MenuItem = {
  danger?: boolean;
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  submenu?: Array<{
    label: string;
    onClick: () => void;
  }>;
};
