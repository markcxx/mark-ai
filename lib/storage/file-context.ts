import mammoth from 'mammoth';
import { and, eq, inArray } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { storageFiles } from '@/lib/db/schema';
import type { FileAttachment } from '@/lib/chat/types';
import { getR2ObjectBytes } from './r2';
import { extractSpreadsheetContent } from './spreadsheet';

const MAX_FILE_CONTEXT_CHARS = 120_000;
const MAX_TOTAL_CONTEXT_CHARS = 180_000;

type FileRecord = typeof storageFiles.$inferSelect;
type CachedContent = { content: string; updatedAt: number };

const globalFileCache = globalThis as typeof globalThis & {
  __markaiFileContentCache?: Map<string, CachedContent>;
};
const fileContentCache = globalFileCache.__markaiFileContentCache ?? new Map<string, CachedContent>();
globalFileCache.__markaiFileContentCache = fileContentCache;

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() || '';

const decodeText = (bytes: Uint8Array) => {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  return new TextDecoder('utf-8').decode(bytes);
};

const extractFileContent = async (file: FileRecord) => {
  const updatedAt = file.updatedAt.getTime();
  const cached = fileContentCache.get(file.id);
  if (cached?.updatedAt === updatedAt) return cached.content;

  const bytes = await getR2ObjectBytes(file.bucket, file.objectKey);
  const extension = extensionOf(file.originalName);
  let content = '';

  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    content = result.value;
  } else if (extension === 'xlsx') {
    content = extractSpreadsheetContent(bytes, MAX_FILE_CONTEXT_CHARS);
  } else if (
    file.contentType.startsWith('text/') ||
    ['txt', 'md', 'markdown', 'csv', 'json', 'xml', 'yaml', 'yml', 'log'].includes(extension)
  ) {
    content = decodeText(bytes);
  } else {
    throw new Error(`暂不支持解析 ${extension ? `.${extension}` : file.contentType} 文件`);
  }

  content = content.replaceAll('\0', '').trim();
  if (!content) throw new Error('文件中没有提取到可读文字');
  if (content.length > MAX_FILE_CONTEXT_CHARS) {
    content = `${content.slice(0, MAX_FILE_CONTEXT_CHARS)}\n\n[文件内容过长，已截断]`;
  }
  fileContentCache.set(file.id, { content, updatedAt });
  if (fileContentCache.size > 500) fileContentCache.delete(fileContentCache.keys().next().value!);
  return content;
};

const escapeAttribute = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

export const injectFileContexts = async <T extends {
  attachments?: FileAttachment[];
  content: string;
  role: string;
}>(messages: T[], userId: string) => {
  const fileIds = Array.from(new Set(messages.flatMap((message) =>
    message.role === 'user' ? (message.attachments || []).map((file) => file.id) : [],
  )));
  if (fileIds.length === 0) return messages;

  const records = await getDb().select().from(storageFiles).where(and(
    eq(storageFiles.userId, userId),
    eq(storageFiles.status, 'ready'),
    inArray(storageFiles.id, fileIds),
  ));
  const byId = new Map(records.map((file) => [file.id, file]));
  let usedChars = 0;

  return Promise.all(messages.map(async (message) => {
    if (message.role !== 'user' || !message.attachments?.length) return message;
    const fileNodes = await Promise.all(message.attachments.map(async (attachment) => {
      const file = byId.get(attachment.id);
      if (!file || usedChars >= MAX_TOTAL_CONTEXT_CHARS) return '';
      try {
        let content = await extractFileContent(file);
        const remaining = MAX_TOTAL_CONTEXT_CHARS - usedChars;
        if (content.length > remaining) content = `${content.slice(0, remaining)}\n[总附件内容过长，已截断]`;
        usedChars += content.length;
        return `<file id="${escapeAttribute(file.id)}" name="${escapeAttribute(file.originalName)}" type="${escapeAttribute(file.contentType)}" size="${file.size}">${content}</file>`;
      } catch (error) {
        const detail = error instanceof Error ? error.message : '文件解析失败';
        return `<file id="${escapeAttribute(file.id)}" name="${escapeAttribute(file.originalName)}" type="${escapeAttribute(file.contentType)}" size="${file.size}">[${detail}]</file>`;
      }
    }));
    const validNodes = fileNodes.filter(Boolean);
    if (validNodes.length === 0) return message;
    const context = `<!-- SYSTEM CONTEXT (NOT PART OF USER QUERY) -->
<context.instruction>以下内容是系统从用户上传文件中提取的正文。回答依赖附件的问题时，请直接阅读并使用这些内容，不要声称无法访问附件。</context.instruction>
<files_info>
<files>
<files_docstring>here are user upload files you can refer to</files_docstring>
${validNodes.join('\n')}
</files>
</files_info>
<!-- END SYSTEM CONTEXT -->`;
    return { ...message, content: `${message.content}\n\n${context}`.trim() };
  }));
};
