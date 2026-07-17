import toast from "react-hot-toast";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import { THINKING_TEXTS } from "@/lib/chat/constants";
import { createSmoothTextController, parseChatStreamLine } from "@/lib/chat/client/streaming";
import { createMessageId, extractThinkingFromText, getModelKey } from "@/lib/chat/helpers";
import { applyMessageVariant, toMessageVariant } from "@/lib/chat/message-variants";
import {
  estimateMessageTokens,
  estimateMessagesTokens,
  estimateTextTokens,
} from "@/lib/chat/metrics";
import type {
  ConfiguredModel,
  FileAttachment,
  Message,
  MessageSegment,
  RegenerateMode,
} from "@/lib/chat/types";
import { useSettingsStore } from "./useSettingsStore";
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

const getTotalTokens = (inputTokens: number, outputTokens: number, totalTokens?: number) =>
  totalTokens ?? inputTokens + outputTokens;

const getClientTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
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

    streamAssistantMessage: async (historyMessages, modelMessageId, modelConfig, options = {}) => {
      const startedAt = Date.now();
      const settings = useSettingsStore.getState().general;
      const responseAnimation = settings.reduceMotion ? "none" : settings.responseAnimation;
      let plainContent = options.initialContent || "";
      let inputTokens = estimateMessagesTokens(historyMessages);
      let outputTokens = 0;
      let totalTokens: number | undefined;
      let tokenUsageSource: Message["tokenUsageSource"] = "estimated";
      const segments: MessageSegment[] = [];
      let currentReasoningStart: number | undefined;
      let currentThinkingSegment: Extract<MessageSegment, { type: "thinking" }> | undefined;

      const getAllReasoning = () =>
        segments
          .filter((s): s is Extract<MessageSegment, { type: "thinking" }> => s.type === "thinking")
          .map((s) => s.content)
          .join("");

      const estimateGeneratedOutputTokens = () => {
        const generatedText = plainContent.slice(options.initialContent?.length || 0);
        const extracted = extractThinkingFromText(generatedText);
        return estimateMessageTokens({
          content: extracted.content,
          reasoning: `${getAllReasoning()}${extracted.reasoning}`,
        });
      };

      const finishCurrentReasoning = () => {
        const seg = currentThinkingSegment;
        if (seg && seg.isActive) {
          seg.isActive = false;
          if (currentReasoningStart) {
            seg.duration = (seg.duration || 0) + Date.now() - currentReasoningStart;
          }
          currentReasoningStart = undefined;
        }
      };

      const controller = new AbortController();
      let contentController: ReturnType<typeof createSmoothTextController> | undefined;
      let reasoningController: ReturnType<typeof createSmoothTextController> | undefined;
      set({ abortController: controller });

      try {
        set((s) => {
          const index = THINKING_TEXTS.indexOf(s.loadingText);
          return {
            isLoading: true,
            loadingText: THINKING_TEXTS[(index + 1) % THINKING_TEXTS.length],
          };
        });

        const response = await fetch("/api/chat", {
          body: JSON.stringify({
            messages: historyMessages.map((m) => ({
              attachments: m.attachments,
              content: m.content,
              role: m.role,
            })),
            model: modelConfig.id,
            provider: modelConfig.provider,
            timezone: getClientTimezone(),
            webSearchEnabled: Boolean(options.webSearchEnabled),
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          let detail = errorText;
          try {
            const parsed = JSON.parse(errorText);
            detail = parsed?.detail || parsed?.error?.message || parsed?.error || errorText;
          } catch {
            // Use raw text fallback.
          }
          throw new Error(typeof detail === "string" && detail.trim() ? detail : "模型请求失败");
        }
        if (!response.body) throw new Error("No response body");

        const removedContextMessages = Number(response.headers.get("X-MarkAI-Context-Removed"));
        const contextContentTruncated = response.headers.get("X-MarkAI-Context-Truncated") === "1";
        if (removedContextMessages > 0 || contextContentTruncated) {
          const details = [
            removedContextMessages > 0 ? `${removedContextMessages} 条较早消息` : "",
            contextContentTruncated ? "过长的附件或消息内容" : "",
          ].filter(Boolean);
          toast(`上下文已自动裁剪：${details.join("、")}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const isStructuredStream = response.headers
          .get("content-type")
          ?.includes("application/x-ndjson");
        let done = false;
        let buffer = "";

        const isAnyThinkingActive = () => segments.some((s) => s.type === "thinking" && s.isActive);

        const updateStreamingMessage = () => {
          const extracted = extractThinkingFromText(plainContent);
          const eventReasoning = getAllReasoning();
          const reasoning = `${eventReasoning}${extracted.reasoning}`;
          const estimatedOutputTokens = estimateGeneratedOutputTokens();
          const nextOutputTokens = outputTokens || estimatedOutputTokens;
          const nextTotalTokens = getTotalTokens(inputTokens, nextOutputTokens, totalTokens);
          const anyActive = isAnyThinkingActive() || extracted.hasOpenThinking;
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === modelMessageId
                ? {
                    ...m,
                    content: extracted.content,
                    inputTokens,
                    isReasoning: anyActive,
                    outputTokens: nextOutputTokens,
                    reasoning,
                    tokenUsageSource,
                    totalTokens: nextTotalTokens,
                    segments: [...segments],
                  }
                : m,
            ),
          }));
        };

        const commitContent = (chunk: string) => {
          plainContent += chunk;
          finishCurrentReasoning();
          const extracted = extractThinkingFromText(plainContent);
          const cleanContent = extracted.content;
          if (cleanContent) {
            const prevContentLength = segments
              .filter(
                (s): s is Extract<MessageSegment, { type: "content" }> => s.type === "content",
              )
              .reduce((sum, s) => sum + s.content.length, 0);
            const newPart = cleanContent.slice(prevContentLength);
            if (newPart) {
              const lastSeg = segments[segments.length - 1];
              if (lastSeg && lastSeg.type === "content") {
                lastSeg.content = lastSeg.content + newPart;
              } else {
                segments.push({ type: "content", content: newPart });
              }
            }
          }
          updateStreamingMessage();
        };

        const commitReasoning = (chunk: string) => {
          if (!currentThinkingSegment) {
            currentThinkingSegment = { type: "thinking", content: "", isActive: true };
            segments.push(currentThinkingSegment);
            currentReasoningStart = Date.now();
          } else if (!currentThinkingSegment.isActive) {
            currentThinkingSegment.isActive = true;
            currentReasoningStart = Date.now();
          }
          currentThinkingSegment.content += chunk;
          updateStreamingMessage();
        };

        if (responseAnimation === "smooth") {
          contentController = createSmoothTextController(commitContent);
          reasoningController = createSmoothTextController(commitReasoning);
        }

        const appendContent = (chunk: string) => {
          reasoningController?.flush();
          if (contentController) {
            contentController.push(chunk);
            return;
          }
          commitContent(chunk);
        };

        const appendReasoning = (chunk: string) => {
          contentController?.flush();
          if (reasoningController) {
            reasoningController.push(chunk);
            return;
          }
          commitReasoning(chunk);
        };

        const handleStreamLine = (line: string) => {
          const event = parseChatStreamLine(line);
          if (!event) return;
          if (event.type === "usage") {
            inputTokens = event.inputTokens ?? inputTokens;
            outputTokens = event.outputTokens ?? outputTokens;
            totalTokens = getTotalTokens(inputTokens, outputTokens, event.totalTokens);
            tokenUsageSource = event.tokenUsageSource ?? "estimated";
            updateStreamingMessage();
            return;
          }
          if (event.type === "tool" && event.webSearch) {
            contentController?.flush();
            reasoningController?.flush();
            finishCurrentReasoning();
            currentThinkingSegment = undefined;
            const ws = event.webSearch;
            const existingIdx = segments.findIndex(
              (s) =>
                s.type === "tool" && s.webSearch.tool === ws.tool && s.webSearch.query === ws.query,
            );
            if (existingIdx >= 0) {
              (segments[existingIdx] as Extract<MessageSegment, { type: "tool" }>).webSearch = ws;
            } else {
              segments.push({ type: "tool", webSearch: ws });
            }
            updateStreamingMessage();
            return;
          }
          if (event.type === "reasoning" && event.text) {
            appendReasoning(event.text);
            return;
          }
          if (event.type === "content" && event.text) appendContent(event.text);
        };

        while (!done) {
          const { done: doneReading, value } = await reader.read();
          done = doneReading;
          if (value) {
            const chunk = decoder.decode(value, { stream: !done });
            if (!isStructuredStream) {
              appendContent(chunk);
              continue;
            }
            buffer += chunk;
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) handleStreamLine(line);
          }
        }

        if (isStructuredStream && buffer) handleStreamLine(buffer);
        await reasoningController?.finish();
        await contentController?.finish();
        finishCurrentReasoning();

        const extracted = extractThinkingFromText(plainContent);
        const finalEventReasoning = getAllReasoning();
        const reasoning = `${finalEventReasoning}${extracted.reasoning}` || undefined;
        const allWebSearch = segments
          .filter((s): s is Extract<MessageSegment, { type: "tool" }> => s.type === "tool")
          .map((s) => s.webSearch);
        const reasoningDuration =
          segments
            .filter(
              (s): s is Extract<MessageSegment, { type: "thinking" }> => s.type === "thinking",
            )
            .reduce((sum, s) => sum + (s.duration || 0), 0) || undefined;
        const estimatedOutputTokens = estimateGeneratedOutputTokens();
        const finalOutputTokens = outputTokens || estimatedOutputTokens;
        const finalTotalTokens = getTotalTokens(inputTokens, finalOutputTokens, totalTokens);
        return {
          content: extracted.content,
          generationDuration: Date.now() - startedAt,
          inputTokens,
          isReasoning: false,
          isStreaming: false,
          outputTokens: finalOutputTokens,
          reasoning,
          reasoningDuration,
          segments: segments.length > 0 ? [...segments] : undefined,
          tokenUsageSource,
          totalTokens: finalTotalTokens,
          webSearch: allWebSearch.length > 0 ? allWebSearch : undefined,
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          contentController?.flush();
          reasoningController?.flush();
          finishCurrentReasoning();
          const extracted = extractThinkingFromText(plainContent);
          const abortReasoning = getAllReasoning();
          const reasoning = `${abortReasoning}${extracted.reasoning}` || undefined;
          const allWebSearch = segments
            .filter((s): s is Extract<MessageSegment, { type: "tool" }> => s.type === "tool")
            .map((s) => s.webSearch);
          const reasoningDuration =
            segments
              .filter(
                (s): s is Extract<MessageSegment, { type: "thinking" }> => s.type === "thinking",
              )
              .reduce((sum, s) => sum + (s.duration || 0), 0) || undefined;
          const estimatedOutputTokens = estimateGeneratedOutputTokens();
          const finalOutputTokens = outputTokens || estimatedOutputTokens;
          const finalTotalTokens = getTotalTokens(inputTokens, finalOutputTokens, totalTokens);
          return {
            content: extracted.content || plainContent,
            generationDuration: Date.now() - startedAt,
            inputTokens,
            interrupted: true,
            isReasoning: false,
            isStreaming: false,
            outputTokens: finalOutputTokens,
            reasoning,
            reasoningDuration,
            segments: segments.length > 0 ? [...segments] : undefined,
            tokenUsageSource,
            totalTokens: finalTotalTokens,
            webSearch: allWebSearch.length > 0 ? allWebSearch : undefined,
          };
        }
        contentController?.flush();
        reasoningController?.flush();
        console.error("Chat error:", error);
        toast.error("生成失败，请稍后重试");
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === modelMessageId
              ? {
                  ...m,
                  content: "Sorry, I encountered an error. Please try again.",
                  isReasoning: false,
                }
              : m,
          ),
        }));
        const errReasoning = getAllReasoning();
        return {
          content: "Sorry, I encountered an error. Please try again.",
          generationDuration: Date.now() - startedAt,
          inputTokens,
          isReasoning: false,
          isStreaming: false,
          outputTokens: estimateTextTokens("Sorry, I encountered an error. Please try again."),
          reasoning: errReasoning || undefined,
          segments: segments.length > 0 ? [...segments] : undefined,
          tokenUsageSource: "estimated",
          totalTokens:
            inputTokens + estimateTextTokens("Sorry, I encountered an error. Please try again."),
        };
      } finally {
        set((s) => ({
          ...(s.abortController === controller ? { isLoading: false, abortController: null } : {}),
          messages: s.messages.map((m) =>
            m.id === modelMessageId ? { ...m, isReasoning: false, isStreaming: false } : m,
          ),
        }));
      }
    },

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
