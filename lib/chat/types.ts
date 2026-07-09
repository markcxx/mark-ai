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
  type?: 'content' | 'reasoning' | 'usage';
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
