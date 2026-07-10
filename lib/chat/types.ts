import type { ComponentType } from 'react';

export type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt?: number;
  reasoning?: string;
  reasoningDuration?: number;
  generationDuration?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  interrupted?: boolean;
  isReasoning?: boolean;
  isStreaming?: boolean;
  model?: string;
  provider?: string;
  webSearch?: WebSearchState;
};

export type WebSearchResult = {
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
  tool?: 'web_search' | 'read_webpage';
  status: 'searching' | 'done' | 'error';
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
  messageCount: number;
};

export type ChatStreamEvent = {
  inputTokens?: number;
  outputTokens?: number;
  text?: string;
  totalTokens?: number;
  type?: 'content' | 'reasoning' | 'tool' | 'usage';
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
  onClick: () => void;
};
