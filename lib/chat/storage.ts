import { isCloudMode } from "@/lib/env";

import type { MessageWriteOptions, StorageAdapter } from "./storage-adapter";
import type { Message } from "./types";

let _storage: StorageAdapter | undefined;

export const getStorage = (): StorageAdapter => {
  if (_storage) return _storage;

  if (isCloudMode()) {
    const { PostgresStorage } = require("./postgres-storage");
    _storage = new PostgresStorage();
  } else {
    const { SqliteStorage } = require("./sqlite-storage");
    _storage = new SqliteStorage();
  }

  return _storage!;
};

export const listChatSessions = (userId?: string) => getStorage().listChatSessions(userId);

export const createChatSession = (params: {
  initialMessage?: string;
  model?: string;
  provider?: string;
  title?: string;
  userId?: string;
}) => getStorage().createChatSession(params);

export const getChatSession = (sessionId: string, userId?: string) =>
  getStorage().getChatSession(sessionId, userId);

export const getChatMessages = (sessionId: string, userId?: string) =>
  getStorage().getChatMessages(sessionId, userId);

export const updateChatSessionTitle = (sessionId: string, title: string, userId?: string) =>
  getStorage().updateChatSessionTitle(sessionId, title, userId);

export const updateChatSessionFavorite = (sessionId: string, favorite: boolean, userId?: string) =>
  getStorage().updateChatSessionFavorite(sessionId, favorite, userId);

export const deleteChatSession = (sessionId: string, userId?: string) =>
  getStorage().deleteChatSession(sessionId, userId);

export const replaceChatMessages = (
  sessionId: string,
  messages: Message[],
  userId?: string,
  options?: Pick<MessageWriteOptions, "expectedRevision">,
) => getStorage().replaceChatMessages(sessionId, messages, userId, options);

export const upsertChatMessage = (
  sessionId: string,
  message: Message,
  userId?: string,
  options?: MessageWriteOptions,
) => getStorage().upsertChatMessage(sessionId, message, userId, options);

export const deleteChatMessage = (
  sessionId: string,
  messageId: string,
  userId?: string,
  options?: Pick<MessageWriteOptions, "expectedRevision">,
) => getStorage().deleteChatMessage(sessionId, messageId, userId, options);
