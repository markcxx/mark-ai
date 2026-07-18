import toast from "react-hot-toast";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import { THINKING_TEXTS } from "@/lib/chat/constants";
import { createMessageId, getModelKey } from "@/lib/chat/helpers";
import { applyMessageVariant, toMessageVariant } from "@/lib/chat/message-variants";
import { estimateMessageTokens } from "@/lib/chat/metrics";
import type { ConfiguredModel, FileAttachment, Message, RegenerateMode } from "@/lib/chat/types";
import { createStreamAssistantMessage } from "./chat/stream-assistant-message";
import { useSessionStore } from "./useSessionStore";
import { useUIStore } from "./useUIStore";

type StreamedMessageResult = Pick<
  Message,
  "content" | "isReasoning" | "isStreaming" | "reasoning" | "reasoningDuration" | "segments"
> &
  Pick<
    Message,
    | "generationDuration"
    | "inputTokens"
    | "interrupted"
    | "outputTokens"
    | "tokenUsageSource"
    | "totalTokens"
    | "webSearch"
  >;

type StreamOptions = {
  initialContent?: string;
  webSearchEnabled?: boolean;
};

interface ChatState {
  messages: Message[];
  input: string;
  isLoading: boolean;
  loadingText: string;
  editingMessageId: string | null;
  editingContent: string;
  abortController: AbortController | null;
  pendingAttachments: FileAttachment[];
}

interface ChatActions {
  setMessages: (messages: Message[]) => void;
  setInput: (input: string) => void;
  setLoadingText: (text: string) => void;
  addPendingAttachment: (attachment: FileAttachment) => void;
  removePendingAttachment: (id: string) => void;
  sendMessage: () => Promise<void>;
  streamAssistantMessage: (
    historyMessages: Message[],
    modelMessageId: string,
    modelConfig: ConfiguredModel,
    options?: StreamOptions,
  ) => Promise<StreamedMessageResult>;
  continueMessage: (message: Message) => Promise<void>;
  regenerateMessage: (message: Message, mode?: RegenerateMode) => Promise<void>;
  selectMessageVariant: (messageId: string, variantId: string) => Promise<void>;
  startEditing: (message: Message) => void;
  saveEditing: () => void;
  cancelEditing: () => void;
  deleteMessage: (id: string) => void;
  copyMessage: (message: Message) => void;
  copyConversation: () => void;
  copySelectedMessages: () => void;
  deleteSelectedMessages: () => void;
  abortStreaming: () => void;
  reset: () => void;
}

export type ChatStore = ChatState & ChatActions;

const copyText = async (text: string, successMessage = "已复制") => {
  if (!text.trim()) {
    toast.error("没有可复制的内容");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("复制失败");
  }
};

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set, get) => ({
    messages: [],
    input: "",
    isLoading: false,
    loadingText: THINKING_TEXTS[0],
    editingMessageId: null,
    editingContent: "",
    abortController: null,
    pendingAttachments: [],

    setMessages: (messages) => set({ messages }),
    setInput: (input) => set({ input }),
    setLoadingText: (text) => set({ loadingText: text }),
    addPendingAttachment: (attachment) =>
      set((state) => ({
        pendingAttachments: [...state.pendingAttachments, attachment],
      })),
    removePendingAttachment: (id) =>
      set((state) => ({
        pendingAttachments: state.pendingAttachments.filter((item) => item.id !== id),
      })),

    abortStreaming: () => {
      const { abortController } = get();
      if (abortController) {
        abortController.abort();
        set((state) =>
          state.abortController === abortController
            ? { abortController: null, isLoading: false }
            : {},
        );
      }
    },

    reset: () => {
      get().abortController?.abort();
      set({
        messages: [],
        input: "",
        isLoading: false,
        editingMessageId: null,
        editingContent: "",
        abortController: null,
        pendingAttachments: [],
      });
    },

    streamAssistantMessage: createStreamAssistantMessage(set, get),

    sendMessage: async () => {
      const { input, isLoading, messages, pendingAttachments, streamAssistantMessage } = get();
      const { availableModels, selectedModelKey, webSearchEnabled } = useUIStore.getState();
      const selectedModel = availableModels.find((m) => getModelKey(m) === selectedModelKey);

      if ((!input.trim() && pendingAttachments.length === 0) || isLoading || !selectedModel) return;

      const prompt = input.trim() || "请查看我上传的附件。";
      const sessionStore = useSessionStore.getState();
      let targetSessionId = sessionStore.activeSessionId;
      let createdSession = false;
      let startedStream = false;
      const sessionCreationController = targetSessionId ? null : new AbortController();
      const now = Date.now();
      const userMessage: Message = {
        content: prompt,
        attachments: pendingAttachments,
        createdAt: now,
        id: createMessageId(),
        role: "user",
        totalTokens: estimateMessageTokens({ content: prompt }),
      };
      const modelMessageId = createMessageId();
      const modelMessage: Message = {
        content: "",
        createdAt: now,
        id: modelMessageId,
        isStreaming: true,
        model: selectedModel.id,
        provider: selectedModel.provider,
        role: "model",
      };

      set({
        abortController: sessionCreationController,
        input: "",
        isLoading: true,
        messages: [...messages, userMessage, modelMessage],
        pendingAttachments: [],
      });

      try {
        if (!targetSessionId) {
          try {
            const session = await sessionStore.createSession(prompt, selectedModel, {
              signal: sessionCreationController?.signal,
            });
            targetSessionId = session.id;
            createdSession = true;
            sessionStore.setSessionLoading(session.id, true);
          } catch (error) {
            console.error("Session create error:", error);
            set((state) => ({
              input: state.input || input,
              messages: state.messages.filter(
                (item) => item.id !== userMessage.id && item.id !== modelMessageId,
              ),
              pendingAttachments:
                state.pendingAttachments.length > 0 ? state.pendingAttachments : pendingAttachments,
            }));
            if (!(error instanceof DOMException && error.name === "AbortError")) {
              toast.error("创建会话失败");
            }
            return;
          }
        }
        if (!targetSessionId) return;

        startedStream = true;
        const streamedMessage = await streamAssistantMessage(
          [...messages, userMessage],
          modelMessageId,
          selectedModel,
          { webSearchEnabled },
        );
        const latestModelMessage = get().messages.find((m) => m.id === modelMessageId);
        const savedMessages = [
          ...messages,
          userMessage,
          { ...modelMessage, ...(latestModelMessage || {}), ...streamedMessage },
        ];
        if (useSessionStore.getState().activeSessionId === targetSessionId) {
          set({ messages: savedMessages });
        }

        await sessionStore.persistSessionMessages(targetSessionId, savedMessages);
        if (createdSession) {
          try {
            await sessionStore.generateSessionTitle(targetSessionId, savedMessages);
          } finally {
            sessionStore.setSessionLoading(targetSessionId, false);
          }
        }
      } finally {
        if (!startedStream) {
          set({ isLoading: false, abortController: null });
          if (targetSessionId && createdSession) {
            sessionStore.setSessionLoading(targetSessionId, false);
          }
        }
      }
    },

    continueMessage: async (message) => {
      const { isLoading, messages, streamAssistantMessage } = get();
      if (isLoading) {
        toast.error("请等待当前回复完成");
        return;
      }
      if (message.role !== "model") return;

      const targetSessionId = useSessionStore.getState().activeSessionId;
      if (!targetSessionId) return;

      const index = messages.findIndex((item) => item.id === message.id);
      if (index < 0) return;

      const { availableModels, selectedModelKey, setOpenMenuMessageId } = useUIStore.getState();
      const selectedModel = availableModels.find((m) => getModelKey(m) === selectedModelKey);
      const modelConfig =
        availableModels.find((m) => m.id === message.model && m.provider === message.provider) ||
        selectedModel;

      if (!modelConfig) {
        toast.error("请先配置可用模型");
        return;
      }

      const baseContent = message.content.trimEnd();
      const previousUsage = {
        inputTokens: message.inputTokens || 0,
        outputTokens: message.outputTokens || 0,
        tokenUsageSource: message.tokenUsageSource || "estimated",
        totalTokens: message.totalTokens || 0,
      } as const;
      const initialContent = baseContent ? `${baseContent}\n\n` : "";
      const continuePrompt: Message = {
        content: "请从上次中断的位置继续，不要重复已经输出过的内容。",
        createdAt: Date.now(),
        id: createMessageId(),
        role: "user",
      };
      const historyMessages = [...messages.slice(0, index + 1), continuePrompt];
      const nextMessages = messages.map((item) =>
        item.id === message.id
          ? {
              ...item,
              content: initialContent,
              generationDuration: undefined,
              inputTokens: undefined,
              interrupted: false,
              isReasoning: false,
              isStreaming: true,
              outputTokens: undefined,
              reasoningDuration: undefined,
              tokenUsageSource: undefined,
              totalTokens: undefined,
            }
          : item,
      );

      set({ messages: nextMessages });
      setOpenMenuMessageId(null);

      const streamedMessage = await streamAssistantMessage(
        historyMessages,
        message.id,
        modelConfig,
        { initialContent },
      );
      const savedMessages = nextMessages.map((item) => {
        if (item.id !== message.id) return item;
        const hasPreviousUsage = previousUsage.totalTokens > 0;
        let completedMessage: Message = {
          ...item,
          ...streamedMessage,
          ...(hasPreviousUsage
            ? {
                inputTokens: previousUsage.inputTokens + (streamedMessage.inputTokens || 0),
                outputTokens: previousUsage.outputTokens + (streamedMessage.outputTokens || 0),
                tokenUsageSource:
                  previousUsage.tokenUsageSource === "provider" &&
                  streamedMessage.tokenUsageSource === "provider"
                    ? "provider"
                    : "estimated",
                totalTokens: previousUsage.totalTokens + (streamedMessage.totalTokens || 0),
              }
            : {}),
        };
        if (completedMessage.variants && completedMessage.activeVariantId) {
          const activeVariant = toMessageVariant(
            completedMessage,
            completedMessage.activeVariantId,
          );
          completedMessage = {
            ...completedMessage,
            variants: completedMessage.variants.map((variant) =>
              variant.id === activeVariant.id ? activeVariant : variant,
            ),
          };
        }
        return completedMessage;
      });
      if (useSessionStore.getState().activeSessionId === targetSessionId) {
        set({ messages: savedMessages });
      }

      const sessionStore = useSessionStore.getState();
      await sessionStore.persistSessionMessages(targetSessionId, savedMessages);
    },

    regenerateMessage: async (message, mode = "replace") => {
      const { isLoading, messages, streamAssistantMessage } = get();
      if (isLoading) {
        toast.error("请等待当前回复完成");
        return;
      }

      const index = messages.findIndex((item) => item.id === message.id);
      if (index < 0) return;

      const { availableModels, selectedModelKey, setOpenMenuMessageId, webSearchEnabled } =
        useUIStore.getState();
      const selectedModel = availableModels.find((m) => getModelKey(m) === selectedModelKey);

      let modelConfig: ConfiguredModel | undefined;
      if (message.role === "model") {
        const originalModel = availableModels.find(
          (m) => m.id === message.model && m.provider === message.provider,
        );
        modelConfig = selectedModel || originalModel;
      } else {
        modelConfig = selectedModel;
      }

      if (!modelConfig) {
        toast.error("请先配置可用模型");
        return;
      }

      const targetId = createMessageId();
      const sessionStore = useSessionStore.getState();
      const targetSessionId = sessionStore.activeSessionId;
      if (!targetSessionId) return;

      if (message.role === "user") {
        const followingReply = messages[index + 1];
        if (followingReply?.role === "model") {
          return get().regenerateMessage(followingReply, mode);
        }

        const historyMessages = messages.slice(0, index + 1);
        const modelMessage: Message = {
          content: "",
          createdAt: Date.now(),
          id: targetId,
          isStreaming: true,
          model: modelConfig.id,
          provider: modelConfig.provider,
          role: "model",
        };
        set({ messages: [...historyMessages, modelMessage] });
        setOpenMenuMessageId(null);

        const streamedMessage = await streamAssistantMessage(
          historyMessages,
          targetId,
          modelConfig,
          { webSearchEnabled },
        );
        const latestUserRetryMessage = get().messages.find((item) => item.id === targetId);
        const savedMessages = [
          ...historyMessages,
          { ...modelMessage, ...(latestUserRetryMessage || {}), ...streamedMessage },
        ];
        if (useSessionStore.getState().activeSessionId === targetSessionId) {
          set({ messages: savedMessages });
        }
        await sessionStore.persistSessionMessages(targetSessionId, savedMessages);
        return;
      }

      const historyMessages = messages.slice(0, index);
      const promptIndex = (() => {
        for (let i = index - 1; i >= 0; i -= 1) {
          if (messages[i].role === "user") return i;
        }
        return -1;
      })();

      if (promptIndex < 0) {
        toast.error("找不到可用于重新生成的用户消息");
        return;
      }

      const regenerateHistoryMessages = messages.slice(0, promptIndex + 1);
      const activeVariantId = message.activeVariantId || createMessageId();
      const activeVariant = toMessageVariant(message, activeVariantId);
      const storedVariants = message.variants || [];
      const hasStoredActiveVariant = storedVariants.some(
        (variant) => variant.id === activeVariantId,
      );
      const existingVariants = hasStoredActiveVariant
        ? storedVariants.map((variant) =>
            variant.id === activeVariantId ? activeVariant : variant,
          )
        : [...storedVariants, activeVariant];
      const trackVariants = mode === "preserve" || (message.variants?.length || 0) > 1;
      const nextVariantId = mode === "preserve" ? createMessageId() : activeVariantId;
      const replacedVariantIndex = existingVariants.findIndex(
        (variant) => variant.id === activeVariantId,
      );
      const retainedVariants = trackVariants
        ? mode === "preserve"
          ? existingVariants
          : existingVariants.filter((variant) => variant.id !== activeVariantId)
        : undefined;
      const nextModelMessage: Message = {
        ...message,
        activeVariantId: trackVariants ? nextVariantId : undefined,
        content: "",
        createdAt: Date.now(),
        id: message.id,
        generationDuration: undefined,
        inputTokens: undefined,
        interrupted: false,
        isReasoning: false,
        isStreaming: true,
        model: modelConfig.id,
        outputTokens: undefined,
        provider: modelConfig.provider,
        reasoning: undefined,
        reasoningDuration: undefined,
        segments: undefined,
        tokenUsageSource: undefined,
        totalTokens: undefined,
        variants: retainedVariants,
        webSearch: undefined,
      };
      const nextMessages = [...messages.slice(0, index), nextModelMessage];

      set({ messages: nextMessages });
      setOpenMenuMessageId(null);

      const streamedMessage = await streamAssistantMessage(
        regenerateHistoryMessages,
        nextModelMessage.id,
        modelConfig,
        { webSearchEnabled },
      );
      const latestRetryMessage = get().messages.find((item) => item.id === nextModelMessage.id);
      let completedMessage: Message = {
        ...nextModelMessage,
        ...(latestRetryMessage || {}),
        ...streamedMessage,
      };
      if (trackVariants) {
        const completedVariant = toMessageVariant(completedMessage, nextVariantId);
        const completedVariants = [...(retainedVariants || [])];
        const insertAt =
          mode === "replace" && replacedVariantIndex >= 0
            ? Math.min(replacedVariantIndex, completedVariants.length)
            : completedVariants.length;
        completedVariants.splice(insertAt, 0, completedVariant);
        completedMessage = {
          ...completedMessage,
          activeVariantId: nextVariantId,
          variants: completedVariants,
        };
      }
      const savedMessages = [...nextMessages.slice(0, -1), completedMessage];
      if (useSessionStore.getState().activeSessionId === targetSessionId) {
        set({ messages: savedMessages });
      }
      await sessionStore.persistSessionMessages(targetSessionId, savedMessages);
    },

    selectMessageVariant: async (messageId, variantId) => {
      const { isLoading, messages } = get();
      if (isLoading) return;

      const messageIndex = messages.findIndex((message) => message.id === messageId);
      const message = messages[messageIndex];
      const variant = message?.variants?.find((item) => item.id === variantId);
      if (!message || !variant) return;

      const nextMessages = messages.map((item, index) =>
        index === messageIndex ? applyMessageVariant(item, variant) : item,
      );
      set({ messages: nextMessages });

      const sessionId = useSessionStore.getState().activeSessionId;
      if (sessionId) {
        await useSessionStore.getState().persistSessionMessages(sessionId, nextMessages);
      }
    },

    startEditing: (message) => {
      if (message.isStreaming) {
        toast.error("生成中不能编辑");
        return;
      }
      set({ editingMessageId: message.id, editingContent: message.content });
      useUIStore.getState().setOpenMenuMessageId(null);
    },

    saveEditing: () => {
      const { editingMessageId, editingContent, messages } = get();
      if (!editingMessageId) return;
      if (!editingContent.trim()) {
        toast.error("消息内容不能为空");
        return;
      }

      const nextMessages = messages.map((message) => {
        if (message.id !== editingMessageId) return message;
        const nextMessage = { ...message, content: editingContent.trim() };
        if (!nextMessage.variants || !nextMessage.activeVariantId) return nextMessage;
        const activeVariant = toMessageVariant(nextMessage, nextMessage.activeVariantId);
        return {
          ...nextMessage,
          variants: nextMessage.variants.map((variant) =>
            variant.id === activeVariant.id ? activeVariant : variant,
          ),
        };
      });
      set({ messages: nextMessages, editingMessageId: null, editingContent: "" });

      const sessionStore = useSessionStore.getState();
      if (sessionStore.activeSessionId)
        void sessionStore.persistSessionMessages(sessionStore.activeSessionId, nextMessages);
      toast.success("消息已更新");
    },

    cancelEditing: () => set({ editingMessageId: null, editingContent: "" }),

    deleteMessage: (id) => {
      const { messages, editingMessageId } = get();
      const nextMessages = messages.filter((m) => m.id !== id);
      const updates: Partial<ChatState> = { messages: nextMessages };
      if (editingMessageId === id) {
        updates.editingMessageId = null;
        updates.editingContent = "";
      }
      set(updates);

      useUIStore.getState().removeFromSelection([id]);
      useUIStore.getState().removeFromCollapsed([id]);

      const sessionStore = useSessionStore.getState();
      if (sessionStore.activeSessionId)
        void sessionStore.persistSessionMessages(sessionStore.activeSessionId, nextMessages);
      toast.success("消息已删除");
    },

    copyMessage: (message) => {
      copyText(message.content, "消息已复制");
    },

    copyConversation: () => {
      const { messages } = get();
      const text = messages
        .filter((m) => m.content.trim())
        .map((m) => `${m.role === "user" ? "用户" : m.model || "AI"}：\n${m.content}`)
        .join("\n\n");
      copyText(text, "对话已复制");
    },

    copySelectedMessages: () => {
      const { messages } = get();
      const { selectedMessageIds } = useUIStore.getState();
      const text = messages
        .filter((m) => selectedMessageIds.includes(m.id))
        .map((m) => `${m.role === "user" ? "用户" : m.model || "AI"}：\n${m.content}`)
        .join("\n\n");
      copyText(text, "已复制选中消息");
    },

    deleteSelectedMessages: () => {
      const { messages } = get();
      const uiStore = useUIStore.getState();
      const { selectedMessageIds } = uiStore;

      if (selectedMessageIds.length === 0) {
        toast.error("请先选择消息");
        return;
      }

      const nextMessages = messages.filter((m) => !selectedMessageIds.includes(m.id));
      set({ messages: nextMessages });
      uiStore.removeFromCollapsed(selectedMessageIds);
      uiStore.exitMultiSelect();

      const sessionStore = useSessionStore.getState();
      if (sessionStore.activeSessionId)
        void sessionStore.persistSessionMessages(sessionStore.activeSessionId, nextMessages);
      toast.success("已删除选中消息");
    },
  })),
);
