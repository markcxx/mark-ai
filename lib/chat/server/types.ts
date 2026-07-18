import type { FileAttachment } from "@/lib/chat/types";

export type ChatMessage = {
  attachments?: FileAttachment[];
  content: string;
  role: "user" | "model" | "assistant" | "system";
};

export type OpenAIChatMessage = {
  content: string | null;
  role: "system" | "user" | "assistant" | "tool";
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
};

export type OpenAIToolCall = {
  function: {
    arguments: string;
    name: string;
  };
  id: string;
  type: "function";
};
