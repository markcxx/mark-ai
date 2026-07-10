import type { ChatSession, Message } from './types';

const EXPORT_SCHEMA_VERSION = 1;

export type SessionExportPayload = {
  app: 'MARKAI';
  exportedAt: string;
  messages: Message[];
  schemaVersion: number;
  session: ChatSession | null;
};

export const getExportTitle = (session?: ChatSession | null) =>
  (session?.title || '新对话').trim() || '新对话';

export const sanitizeExportFileName = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'markai-chat';

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const formatExportDateTime = (timestamp?: number) => {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(timestamp);
};

export const buildSessionExportPayload = (
  session: ChatSession | null | undefined,
  messages: Message[],
): SessionExportPayload => ({
  app: 'MARKAI',
  exportedAt: new Date().toISOString(),
  messages,
  schemaVersion: EXPORT_SCHEMA_VERSION,
  session: session || null,
});

export const exportSessionJson = (
  session: ChatSession | null | undefined,
  messages: Message[],
) => {
  const payload = buildSessionExportPayload(session, messages);
  const filename = `${sanitizeExportFileName(`MARKAI-${getExportTitle(session)}`)}.json`;
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
    filename,
  );
};

export const exportSessionImage = async ({
  previewId = 'markai-export-preview',
  session,
}: {
  previewId?: string;
  session: ChatSession | null | undefined;
}) => {
  const { snapdom } = await import('@zumer/snapdom');
  const target = document.getElementById(previewId);
  if (!target) throw new Error('找不到图片预览区域');

  const blob = await snapdom.toBlob(target, {
    scale: 2,
    type: 'png',
  });

  if (!blob) throw new Error('图片生成失败');
  downloadBlob(blob, `${sanitizeExportFileName(`MARKAI-${getExportTitle(session)}`)}.png`);
};
