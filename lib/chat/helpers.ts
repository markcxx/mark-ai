import type { ConfiguredModel } from "./types";

export const createMessageId = () => {
  if (globalThis.crypto?.randomUUID) {
    return `message-${globalThis.crypto.randomUUID()}`;
  }

  return `message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const getModelKey = (model: ConfiguredModel) => `${model.provider}:${model.id}`;

export const getModelDisplayName = (modelId: string) => {
  const slashIndex = modelId.lastIndexOf("/");
  return slashIndex >= 0 ? modelId.slice(slashIndex + 1) : modelId;
};

const THINKING_TAGS = [
  { close: "</think>", open: "<think>" },
];

export const extractThinkingFromText = (text: string) => {
  let content = "";
  let reasoning = "";
  let cursor = 0;
  let hasOpenThinking = false;

  while (cursor < text.length) {
    const nextTag = THINKING_TAGS.map((tag) => ({ ...tag, index: text.indexOf(tag.open, cursor) }))
      .filter((tag) => tag.index >= 0)
      .sort((a, b) => a.index - b.index)[0];

    if (!nextTag) {
      content += text.slice(cursor);
      break;
    }

    content += text.slice(cursor, nextTag.index);
    const reasoningStart = nextTag.index + nextTag.open.length;
    const reasoningEnd = text.indexOf(nextTag.close, reasoningStart);

    if (reasoningEnd < 0) {
      reasoning += text.slice(reasoningStart);
      hasOpenThinking = true;
      break;
    }

    reasoning += text.slice(reasoningStart, reasoningEnd);
    cursor = reasoningEnd + nextTag.close.length;
  }

  return {
    content: content.replace(/\n{3,}/g, "\n\n").trimStart(),
    hasOpenThinking,
    reasoning: reasoning.replace(/\n{3,}/g, "\n\n").trimStart(),
  };
};
