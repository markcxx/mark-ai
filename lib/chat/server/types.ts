import type { FileAttachment } from "@/lib/chat/types";

export type ModelImageInput = {
  data: string;
  mediaType: string;
  name: string;
};

export type ChatMessage = {
  attachments?: FileAttachment[];
  content: string;
  imageInputs?: ModelImageInput[];
  role: "user" | "model" | "assistant" | "system";
};

export type OpenAIContentPart =
  | { text: string; type: "text" }
  | { image_url: { url: string }; type: "image_url" };

export type OpenAIChatMessage = {
  content: string | OpenAIContentPart[] | null;
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
