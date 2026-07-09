import type { Message } from './types';

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/g;

export const estimateTextTokens = (text = '') => {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const cjkCount = trimmed.match(CJK_RE)?.length || 0;
  const nonCjkCount = Math.max(trimmed.length - cjkCount, 0);

  return Math.max(1, Math.ceil(cjkCount / 1.7 + nonCjkCount / 4));
};

export const estimateMessageTokens = (message: Pick<Message, 'content' | 'reasoning'>) =>
  estimateTextTokens(message.content) + estimateTextTokens(message.reasoning);

export const estimateMessagesTokens = (messages: Pick<Message, 'content' | 'reasoning'>[]) =>
  messages.reduce((total, message) => total + estimateMessageTokens(message), 0);

export const formatDuration = (duration?: number) => {
  if (!duration || duration < 0) return undefined;
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60_000) return `${(duration / 1000).toFixed(1)}s`;

  const minutes = Math.floor(duration / 60_000);
  const seconds = Math.round((duration % 60_000) / 1000);
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
};

export const formatRelativeTime = (time?: number) => {
  if (!time) return undefined;

  const diff = Date.now() - time;
  if (diff < 10_000) return '刚刚';
  if (diff < 60_000) return `${Math.floor(diff / 1000)} 秒前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)} 天前`;

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(time);
};
