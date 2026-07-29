import { useChatStore } from "@/stores/useChatStore";
import { navigateToNewChat, useSessionStore } from "@/stores/useSessionStore";
import { useUIStore } from "@/stores/useUIStore";

const resetTransientChatUI = () => {
  useUIStore.getState().exitMultiSelect();
  useUIStore.getState().setOpenMenuMessageId(null);
};

const cancelQueuedMessage = () => {
  if (useChatStore.getState().queuedMessage) {
    useChatStore.getState().cancelQueuedMessage();
  }
};

export const loadChatSession = async (
  sessionId: string,
  options: { history?: "none" | "push" | "replace" } = {},
) => {
  cancelQueuedMessage();
  useChatStore.getState().abortStreaming();
  const loadedMessages = await useSessionStore.getState().loadSession(sessionId, options);
  if (!loadedMessages) return false;

  useChatStore.getState().setMessages(loadedMessages);
  useChatStore.setState({ editingContent: "", editingMessageId: null });
  resetTransientChatUI();
  return true;
};

export const startNewChat = (history: "none" | "push" | "replace" = "push") => {
  cancelQueuedMessage();
  useChatStore.getState().reset();
  useSessionStore.getState().resetActiveSession();
  resetTransientChatUI();
  navigateToNewChat(history);
};

export const deleteChatSession = async (sessionId: string) => {
  const deletedActiveSession = await useSessionStore.getState().deleteSession(sessionId);
  if (!deletedActiveSession) return;

  cancelQueuedMessage();
  useChatStore.getState().reset();
  resetTransientChatUI();
};

export const renameChatSession = (sessionId: string) => {
  const sessionStore = useSessionStore.getState();
  const messages =
    sessionStore.activeSessionId === sessionId ? useChatStore.getState().messages : undefined;
  return sessionStore.renameSession(sessionId, messages);
};
