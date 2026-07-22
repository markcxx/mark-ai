import type { FileAttachment, Message } from "@/lib/chat/types";
import type { ModelMetadataWithContext } from "@/lib/model-metadata";
import { estimateTextTokens } from "./metrics";

const MIN_OUTPUT_RESERVE_TOKENS = 2048;
const MAX_OUTPUT_RESERVE_TOKENS = 32_768;
const TRUNCATION_MARKER = "\n\n[较早内容因上下文限制已截断]";

type ContextMessage = {
  content: string;
  role: string;
};

export type ContextPreparation<T> = {
  contentTruncated: boolean;
  contextWindowTokens: number;
  estimatedInputTokens: number;
  inputBudgetTokens: number;
  messages: T[];
  outputReserveTokens: number;
  removedMessageCount: number;
};

export const estimateContextMessagesTokens = (messages: ContextMessage[]) =>
  estimateTextTokens(
    JSON.stringify(messages.map((message) => ({ content: message.content, role: message.role }))),
  );

export const getOutputReserveTokens = (metadata: ModelMetadataWithContext) => {
  const proportionalReserve = Math.round(metadata.contextWindowTokens * 0.12);
  const preferredReserve = Math.min(
    Math.max(proportionalReserve, MIN_OUTPUT_RESERVE_TOKENS),
    MAX_OUTPUT_RESERVE_TOKENS,
  );
  return Math.min(
    metadata.maxOutputTokens ?? preferredReserve,
    preferredReserve,
    Math.floor(metadata.contextWindowTokens / 2),
  );
};

const truncateLastMessageToBudget = <T extends ContextMessage>(messages: T[], budget: number) => {
  const last = messages[messages.length - 1];
  if (!last) return messages;

  let low = 0;
  let high = last.content.length;
  let fittedContent = TRUNCATION_MARKER.trimStart();

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const content = `${last.content.slice(0, middle).trimEnd()}${TRUNCATION_MARKER}`;
    const candidate = [...messages.slice(0, -1), { ...last, content }];
    if (estimateContextMessagesTokens(candidate) <= budget) {
      fittedContent = content;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return [...messages.slice(0, -1), { ...last, content: fittedContent }];
};

export const prepareMessagesForContext = <T extends ContextMessage>(
  messages: T[],
  metadata: ModelMetadataWithContext,
  overheadTokens: number,
): ContextPreparation<T> => {
  const outputReserveTokens = getOutputReserveTokens(metadata);
  const inputBudgetTokens = Math.max(
    512,
    metadata.contextWindowTokens - outputReserveTokens - Math.max(overheadTokens, 0),
  );
  let prepared = [...messages];
  let removedMessageCount = 0;

  while (estimateContextMessagesTokens(prepared) > inputBudgetTokens) {
    const nextUserIndex = prepared.findIndex(
      (message, index) => index > 0 && message.role === "user",
    );
    if (nextUserIndex <= 0) break;
    prepared = prepared.slice(nextUserIndex);
    removedMessageCount += nextUserIndex;
  }

  let contentTruncated = false;
  if (estimateContextMessagesTokens(prepared) > inputBudgetTokens) {
    prepared = truncateLastMessageToBudget(prepared, inputBudgetTokens);
    contentTruncated = true;
  }

  return {
    contentTruncated,
    contextWindowTokens: metadata.contextWindowTokens,
    estimatedInputTokens:
      overheadTokens + Math.min(estimateContextMessagesTokens(prepared), inputBudgetTokens),
    inputBudgetTokens,
    messages: prepared,
    outputReserveTokens,
    removedMessageCount,
  };
};

const estimateAttachmentTokens = (file: FileAttachment) => {
  if (file.contentType.startsWith("image/")) return 32;
  const multiplier =
    file.contentType.includes("spreadsheet") || file.name.toLowerCase().endsWith(".xlsx")
      ? 0.5
      : 1 / 3;
  return Math.min(30_000, Math.max(64, Math.ceil(file.size * multiplier)));
};

export const estimateDraftContextTokens = ({
  attachments,
  draft,
  messages,
  toolContextTokens = 0,
  webSearchEnabled,
}: {
  attachments: FileAttachment[];
  draft: string;
  messages: Message[];
  toolContextTokens?: number;
  webSearchEnabled: boolean;
}) => {
  const draftContent = draft.trim();
  if (messages.length === 0 && !draftContent && attachments.length === 0) return 0;

  const draftMessage =
    draftContent || attachments.length > 0
      ? [{ content: draftContent || "请查看我上传的附件。", role: "user" }]
      : [];
  const messageTokens = estimateContextMessagesTokens([
    ...messages.map((message) => ({ content: message.content, role: message.role })),
    ...draftMessage,
  ]);
  const storedAttachments = messages.flatMap((message) => message.attachments || []);
  const attachmentTokens = [...storedAttachments, ...attachments].reduce(
    (total, file) => total + estimateAttachmentTokens(file),
    0,
  );

  return messageTokens + attachmentTokens + 512 + toolContextTokens + (webSearchEnabled ? 1200 : 0);
};
