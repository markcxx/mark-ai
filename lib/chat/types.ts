import type { ComponentType } from 'react';

export type Message = {
  id: string;
  role: 'user' | 'model';
  content: string;
  reasoning?: string;
  reasoningDuration?: number;
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
  model?: string;
  provider?: string;
  messageCount: number;
};

export type ChatStreamEvent = {
  text?: string;
  type?: 'content' | 'reasoning';
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
