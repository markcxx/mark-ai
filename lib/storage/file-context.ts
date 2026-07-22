import mammoth from "mammoth";

import type { ChatMessage, ModelImageInput } from "@/lib/chat/server/types";
import { getStoredFileBytes, getStoredFilesByIds, type StoredFileRecord } from "./file-storage";
import { extractPdfContent } from "./pdf";
import { extractSpreadsheetContent } from "./spreadsheet";

const MAX_FILE_CONTEXT_CHARS = 120_000;
const MAX_TOTAL_CONTEXT_CHARS = 180_000;

type CachedContent = { content: string; updatedAt: number };

const globalFileCache = globalThis as typeof globalThis & {
  __markaiFileContentCache?: Map<string, CachedContent>;
};
const fileContentCache =
  globalFileCache.__markaiFileContentCache ?? new Map<string, CachedContent>();
globalFileCache.__markaiFileContentCache = fileContentCache;

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() || "";

const decodeText = (bytes: Uint8Array) => {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  return new TextDecoder("utf-8").decode(bytes);
};

const extractFileContent = async (file: StoredFileRecord) => {
  const updatedAt = file.updatedAt.getTime();
  const cached = fileContentCache.get(file.id);
  if (cached?.updatedAt === updatedAt) return cached.content;

  const bytes = await getStoredFileBytes(file);
  const extension = extensionOf(file.originalName);
  let content = "";

  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    content = result.value;
  } else if (extension === "xlsx") {
    content = extractSpreadsheetContent(bytes, MAX_FILE_CONTEXT_CHARS);
  } else if (extension === "pdf" || file.contentType === "application/pdf") {
    content = (await extractPdfContent(bytes)).content;
  } else if (
    file.contentType.startsWith("text/") ||
    ["txt", "md", "markdown", "csv", "json", "xml", "yaml", "yml", "log"].includes(extension)
  ) {
    content = decodeText(bytes);
  } else {
    throw new Error(`暂不支持解析 ${extension ? `.${extension}` : file.contentType} 文件`);
  }

  content = content.replaceAll("\0", "").trim();
  if (!content) throw new Error("文件中没有提取到可读文字");
  if (content.length > MAX_FILE_CONTEXT_CHARS) {
    content = `${content.slice(0, MAX_FILE_CONTEXT_CHARS)}\n\n[文件内容过长，已截断]`;
  }
  fileContentCache.set(file.id, { content, updatedAt });
  if (fileContentCache.size > 500) fileContentCache.delete(fileContentCache.keys().next().value!);
  return content;
};

const escapeAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const prepareImageInput = async (file: StoredFileRecord): Promise<ModelImageInput> => {
  const bytes = await getStoredFileBytes(file);
  return {
    data: Buffer.from(bytes).toString("base64"),
    mediaType: file.contentType,
    name: file.originalName,
  };
};

export const injectFileContexts = async (messages: ChatMessage[], userId: string) => {
  const fileIds = Array.from(
    new Set(
      messages.flatMap((message) =>
        message.role === "user" ? (message.attachments || []).map((file) => file.id) : [],
      ),
    ),
  );
  if (fileIds.length === 0) return messages;

  const records = await getStoredFilesByIds(fileIds, userId);
  const byId = new Map(records.map((file) => [file.id, file]));
  let usedChars = 0;

  const prepared = [...messages];

  // Newer attachments are more likely to belong to the active question. Process messages from
  // newest to oldest so historical files cannot consume the shared context budget first.
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user" || !message.attachments?.length) continue;

    const fileNodes: string[] = [];
    const imageInputs: ModelImageInput[] = [];
    for (const attachment of message.attachments) {
      const file = byId.get(attachment.id);
      if (!file) continue;
      if (file.contentType.startsWith("image/")) {
        try {
          imageInputs.push(await prepareImageInput(file));
        } catch (error) {
          const detail = error instanceof Error ? error.message : "图片读取失败";
          fileNodes.push(
            `<file id="${escapeAttribute(file.id)}" name="${escapeAttribute(file.originalName)}" type="${escapeAttribute(file.contentType)}" size="${file.size}">[${detail}]</file>`,
          );
        }
        continue;
      }
      if (usedChars >= MAX_TOTAL_CONTEXT_CHARS) continue;
      try {
        let content = await extractFileContent(file);
        const remaining = MAX_TOTAL_CONTEXT_CHARS - usedChars;
        if (content.length > remaining) {
          content = `${content.slice(0, remaining)}\n[总附件内容过长，已截断]`;
        }
        usedChars += content.length;
        fileNodes.push(
          `<file id="${escapeAttribute(file.id)}" name="${escapeAttribute(file.originalName)}" type="${escapeAttribute(file.contentType)}" size="${file.size}">${content}</file>`,
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : "文件解析失败";
        fileNodes.push(
          `<file id="${escapeAttribute(file.id)}" name="${escapeAttribute(file.originalName)}" type="${escapeAttribute(file.contentType)}" size="${file.size}">[${detail}]</file>`,
        );
      }
    }

    const context = fileNodes.length
      ? `<!-- SYSTEM CONTEXT (NOT PART OF USER QUERY) -->
<context.instruction>以下内容是系统从用户上传文件中提取的正文。回答依赖附件的问题时，请直接阅读并使用这些内容，不要声称无法访问附件。</context.instruction>
<files_info>
<files>
<files_docstring>here are user upload files you can refer to</files_docstring>
${fileNodes.join("\n")}
</files>
</files_info>
<!-- END SYSTEM CONTEXT -->`
      : "";
    prepared[index] = {
      ...message,
      content: context ? `${message.content}\n\n${context}`.trim() : message.content,
      ...(imageInputs.length ? { imageInputs } : {}),
    };
  }

  return prepared;
};
