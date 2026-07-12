import type { ChatSession, Message } from './types';

export interface StorageAdapter {
  listChatSessions(userId?: string): ChatSession[] | Promise<ChatSession[]>;
  createChatSession(params: {
    initialMessage?: string;
    model?: string;
    provider?: string;
    title?: string;
    userId?: string;
  }): ChatSession | Promise<ChatSession>;
  getChatSession(sessionId: string, userId?: string): ChatSession | undefined | Promise<ChatSession | undefined>;
  getChatMessages(sessionId: string, userId?: string): Message[] | Promise<Message[]>;
  updateChatSessionTitle(sessionId: string, title: string, userId?: string): ChatSession | undefined | Promise<ChatSession | undefined>;
  updateChatSessionFavorite(sessionId: string, favorite: boolean, userId?: string): ChatSession | undefined | Promise<ChatSession | undefined>;
  deleteChatSession(sessionId: string, userId?: string): void | Promise<void>;
  replaceChatMessages(sessionId: string, messages: Message[], userId?: string): { messages: Message[]; session: ChatSession | undefined } | Promise<{ messages: Message[]; session: ChatSession | undefined }>;
}
