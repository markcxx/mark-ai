import type { Message } from "./types";

export const SHARE_DURATIONS = [
  { label: "1 小时", value: 3600 },
  { label: "1 天", value: 86400 },
  { label: "7 天", value: 604800 },
  { label: "30 天", value: 2592000 },
];

export type ConversationSnapshot = {
  title: string;
  messages: Message[];
};

export const isShareDuration = (value: unknown): value is number =>
  SHARE_DURATIONS.some((option) => option.value === value);

// Publish only the currently displayed answer, never hidden alternative versions.
export const toReadonlyMessages = (messages: Message[]): Message[] =>
  messages.map(({ variants: _variants, activeVariantId: _activeVariantId, ...message }) => ({
    ...message,
    isStreaming: false,
    isReasoning: false,
    segments: message.segments?.map((segment) => {
      if (segment.type === "thinking") return { ...segment, isActive: false };
      if (segment.type === "generated-file") {
        const { preview: _preview, ...generatedFile } = segment.generatedFile;
        return {
          ...segment,
          generatedFile: {
            ...generatedFile,
            file: generatedFile.file ? { ...generatedFile.file, url: "" } : undefined,
            status: generatedFile.status === "running" ? "error" : generatedFile.status,
          },
        };
      }
      return segment;
    }),
  }));
