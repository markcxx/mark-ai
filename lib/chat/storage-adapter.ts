import type { ChatSession, Message } from "./types";

export type MessageWriteOptions = {
  expectedRevision?: number;
  position?: number;
};

export class ChatRevisionConflictError extends Error {
  constructor(public readonly currentRevision: number) {
    super("Chat session revision conflict");
    this.name = "ChatRevisionConflictError";
  }
}

export interface StorageAdapter {
  listChatSessions(userId?: string): ChatSession[] | Promise<ChatSession[]>;
  createChatSession(params: {
    initialMessage?: string;
    model?: string;
    provider?: string;
    title?: string;
    userId?: string;
  }): ChatSession | Promise<ChatSession>;
  getChatSession(
    sessionId: string,
    userId?: string,
  ): ChatSession | undefined | Promise<ChatSession | undefined>;
  getChatMessages(sessionId: string, userId?: string): Message[] | Promise<Message[]>;
  updateChatSessionTitle(
    sessionId: string,
    title: string,
    userId?: string,
  ): ChatSession | undefined | Promise<ChatSession | undefined>;
  updateChatSessionFavorite(
    sessionId: string,
    favorite: boolean,
    userId?: string,
  ): ChatSession | undefined | Promise<ChatSession | undefined>;
  deleteChatSession(sessionId: string, userId?: string): void | Promise<void>;
  replaceChatMessages(
    sessionId: string,
    messages: Message[],
    userId?: string,
    options?: Pick<MessageWriteOptions, "expectedRevision">,
  ):
    | { messages: Message[]; session: ChatSession | undefined }
    | Promise<{ messages: Message[]; session: ChatSession | undefined }>;
  upsertChatMessage(
    sessionId: string,
    message: Message,
    userId?: string,
    options?: MessageWriteOptions,
  ):
    | { message: Message | undefined; session: ChatSession | undefined }
    | Promise<{ message: Message | undefined; session: ChatSession | undefined }>;
  deleteChatMessage(
    sessionId: string,
    messageId: string,
    userId?: string,
    options?: Pick<MessageWriteOptions, "expectedRevision">,
  ): { session: ChatSession | undefined } | Promise<{ session: ChatSession | undefined }>;
}
