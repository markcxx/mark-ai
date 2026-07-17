import toast from 'react-hot-toast';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import { THINKING_TEXTS } from '@/lib/chat/constants';
import { createMessageId, extractThinkingFromText, getModelKey } from '@/lib/chat/helpers';
import { estimateMessageTokens, estimateMessagesTokens, estimateTextTokens } from '@/lib/chat/metrics';
import type { ChatStreamEvent, ConfiguredModel, FileAttachment, Message, MessageSegment } from '@/lib/chat/types';
import { useSettingsStore } from './useSettingsStore';
import { useSessionStore } from './useSessionStore';
import { useUIStore } from './useUIStore';

type StreamedMessageResult = Pick<
  Message,
  'content' | 'isReasoning' | 'isStreaming' | 'reasoning' | 'reasoningDuration' | 'segments'
> & Pick<
  Message,
  'generationDuration' | 'inputTokens' | 'interrupted' | 'outputTokens' | 'totalTokens' | 'webSearch'
>;

type StreamOptions = {
  initialContent?: string;
  webSearchEnabled?: boolean;
};

const getTotalTokens = (inputTokens: number, outputTokens: number, totalTokens?: number) => {
  const estimatedTotal = inputTokens + outputTokens;
  if (!totalTokens) return estimatedTotal;
  return Math.max(totalTokens, estimatedTotal);
};

const getClientTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

const createSmoothTextController = (onChunk: (chunk: string) => void) => {
  let animationFrame: number | null = null;
  let carry = 0;
  let finishing = false;
  let lastFrameTime = 0;
  let queue = '';
  const finishResolvers: Array<() => void> = [];

  const settle = () => {
    while (finishResolvers.length > 0) finishResolvers.shift()?.();
  };

  const tick = (timestamp: number) => {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const elapsed = Math.min(timestamp - lastFrameTime, 64);
    lastFrameTime = timestamp;
    const queueAdjustedSpeed = queue.length * (finishing ? 10 : 5);
    const charsPerSecond = Math.min(1600, Math.max(finishing ? 120 : 48, queueAdjustedSpeed));
    carry += (elapsed * charsPerSecond) / 1000;

    const count = Math.min(queue.length, Math.floor(carry));
    if (count > 0) {
      const chunk = queue.slice(0, count);
      queue = queue.slice(count);
      carry -= count;
      onChunk(chunk);
    }

    if (queue.length > 0) {
      animationFrame = requestAnimationFrame(tick);
      return;
    }

    animationFrame = null;
    lastFrameTime = 0;
    carry = 0;
    settle();
  };

  const schedule = () => {
    if (animationFrame === null) animationFrame = requestAnimationFrame(tick);
  };

  return {
    finish: () => {
      finishing = true;
      if (!queue) return Promise.resolve();
      schedule();
      return new Promise<void>((resolve) => finishResolvers.push(resolve));
    },
    flush: () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
      lastFrameTime = 0;
      carry = 0;
      if (queue) {
        const remaining = queue;
        queue = '';
        onChunk(remaining);
      }
      settle();
    },
    push: (chunk: string) => {
      if (!chunk) return;
      queue += chunk;
      schedule();
    },
  };
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
  regenerateMessage: (message: Message, deleteCurrent?: boolean) => Promise<void>;
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

const copyText = async (text: string, successMessage = '已复制') => {
  if (!text.trim()) {
    toast.error('没有可复制的内容');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error('复制失败');
  }
};

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set, get) => ({
    messages: [],
    input: '',
    isLoading: false,
    loadingText: THINKING_TEXTS[0],
    editingMessageId: null,
    editingContent: '',
    abortController: null,
    pendingAttachments: [],

    setMessages: (messages) => set({ messages }),
    setInput: (input) => set({ input }),
    setLoadingText: (text) => set({ loadingText: text }),
    addPendingAttachment: (attachment) => set((state) => ({
      pendingAttachments: [...state.pendingAttachments, attachment],
    })),
    removePendingAttachment: (id) => set((state) => ({
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
        input: '',
        isLoading: false,
        editingMessageId: null,
        editingContent: '',
        abortController: null,
        pendingAttachments: [],
      });
    },

    streamAssistantMessage: async (historyMessages, modelMessageId, modelConfig, options = {}) => {
      const startedAt = Date.now();
      const settings = useSettingsStore.getState().general;
      const responseAnimation = settings.reduceMotion ? 'none' : settings.responseAnimation;
      let plainContent = options.initialContent || '';
      let inputTokens = estimateMessagesTokens(historyMessages);
      let outputTokens = 0;
      let totalTokens = inputTokens;
      const segments: MessageSegment[] = [];
      let currentReasoningStart: number | undefined;
      let currentThinkingSegment:
        | Extract<MessageSegment, { type: 'thinking' }>
        | undefined;

      const getAllReasoning = () =>
        segments
          .filter((s): s is Extract<MessageSegment, { type: 'thinking' }> => s.type === 'thinking')
          .map((s) => s.content)
          .join('');

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
          return { isLoading: true, loadingText: THINKING_TEXTS[(index + 1) % THINKING_TEXTS.length] };
        });

        const response = await fetch('/api/chat', {
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
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          let detail = errorText;
          try {
            const parsed = JSON.parse(errorText);
            detail = parsed?.detail || parsed?.error?.message || parsed?.error || errorText;
          } catch {
            // Use raw text fallback.
          }
          throw new Error(typeof detail === 'string' && detail.trim() ? detail : '模型请求失败');
        }
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const isStructuredStream = response.headers
          .get('content-type')
          ?.includes('application/x-ndjson');
        let done = false;
        let buffer = '';

        const isAnyThinkingActive = () =>
          segments.some((s) => s.type === 'thinking' && s.isActive);

        const updateStreamingMessage = () => {
          const extracted = extractThinkingFromText(plainContent);
          const eventReasoning = getAllReasoning();
          const reasoning = `${eventReasoning}${extracted.reasoning}`;
          const estimatedOutputTokens = estimateMessageTokens({
            content: extracted.content,
            reasoning,
          });
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
              .filter((s): s is Extract<MessageSegment, { type: 'content' }> => s.type === 'content')
              .reduce((sum, s) => sum + s.content.length, 0);
            const newPart = cleanContent.slice(prevContentLength);
            if (newPart) {
              const lastSeg = segments[segments.length - 1];
              if (lastSeg && lastSeg.type === 'content') {
                lastSeg.content = lastSeg.content + newPart;
              } else {
                segments.push({ type: 'content', content: newPart });
              }
            }
          }
          updateStreamingMessage();
        };

        const commitReasoning = (chunk: string) => {
          if (!currentThinkingSegment) {
            currentThinkingSegment = { type: 'thinking', content: '', isActive: true };
            segments.push(currentThinkingSegment);
            currentReasoningStart = Date.now();
          } else if (!currentThinkingSegment.isActive) {
            currentThinkingSegment.isActive = true;
            currentReasoningStart = Date.now();
          }
          currentThinkingSegment.content += chunk;
          updateStreamingMessage();
        };

        if (responseAnimation === 'smooth') {
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
          const trimmed = line.trim();
          if (!trimmed) return;
          try {
            const event = JSON.parse(trimmed) as ChatStreamEvent;
            if (event.type === 'usage') {
              inputTokens = event.inputTokens || inputTokens;
              outputTokens = event.outputTokens || outputTokens;
              totalTokens = getTotalTokens(inputTokens, outputTokens, event.totalTokens);
              updateStreamingMessage();
              return;
            }
            if (event.type === 'tool' && event.webSearch) {
              contentController?.flush();
              reasoningController?.flush();
              finishCurrentReasoning();
              currentThinkingSegment = undefined;
              const ws = event.webSearch;
              const existingIdx = segments.findIndex(
                (s) => s.type === 'tool' && s.webSearch.tool === ws.tool && s.webSearch.query === ws.query,
              );
              if (existingIdx >= 0) {
                (segments[existingIdx] as Extract<MessageSegment, { type: 'tool' }>).webSearch = ws;
              } else {
                segments.push({ type: 'tool', webSearch: ws });
              }
              updateStreamingMessage();
              return;
            }
            if (event.type === 'reasoning' && event.text) { appendReasoning(event.text); return; }
            if (event.type === 'content' && event.text) { appendContent(event.text); return; }
          } catch { /* non-JSON line */ }
          appendContent(line);
        };

        while (!done) {
          const { done: doneReading, value } = await reader.read();
          done = doneReading;
          if (value) {
            const chunk = decoder.decode(value, { stream: !done });
            if (!isStructuredStream) { appendContent(chunk); continue; }
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
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
          .filter((s): s is Extract<MessageSegment, { type: 'tool' }> => s.type === 'tool')
          .map((s) => s.webSearch);
        const reasoningDuration = segments
          .filter((s): s is Extract<MessageSegment, { type: 'thinking' }> => s.type === 'thinking')
          .reduce((sum, s) => sum + (s.duration || 0), 0) || undefined;
        const estimatedOutputTokens = estimateMessageTokens({
          content: extracted.content,
          reasoning,
        });
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
          totalTokens: finalTotalTokens,
          webSearch: allWebSearch.length > 0 ? allWebSearch : undefined,
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          contentController?.flush();
          reasoningController?.flush();
          finishCurrentReasoning();
          const extracted = extractThinkingFromText(plainContent);
          const abortReasoning = getAllReasoning();
          const reasoning = `${abortReasoning}${extracted.reasoning}` || undefined;
          const allWebSearch = segments
            .filter((s): s is Extract<MessageSegment, { type: 'tool' }> => s.type === 'tool')
            .map((s) => s.webSearch);
          const reasoningDuration = segments
            .filter((s): s is Extract<MessageSegment, { type: 'thinking' }> => s.type === 'thinking')
            .reduce((sum, s) => sum + (s.duration || 0), 0) || undefined;
          const estimatedOutputTokens = estimateMessageTokens({
            content: extracted.content || plainContent,
            reasoning,
          });
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
            totalTokens: finalTotalTokens,
            webSearch: allWebSearch.length > 0 ? allWebSearch : undefined,
          };
        }
        contentController?.flush();
        reasoningController?.flush();
        console.error('Chat error:', error);
        toast.error('生成失败，请稍后重试');
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === modelMessageId
              ? { ...m, content: 'Sorry, I encountered an error. Please try again.', isReasoning: false }
              : m,
          ),
        }));
        const errReasoning = getAllReasoning();
        return {
          content: 'Sorry, I encountered an error. Please try again.',
          generationDuration: Date.now() - startedAt,
          inputTokens,
          isReasoning: false,
          isStreaming: false,
          outputTokens: estimateTextTokens('Sorry, I encountered an error. Please try again.'),
          reasoning: errReasoning || undefined,
          segments: segments.length > 0 ? [...segments] : undefined,
          totalTokens: inputTokens + estimateTextTokens('Sorry, I encountered an error. Please try again.'),
        };
      } finally {
        set((s) => ({
          ...(s.abortController === controller
            ? { isLoading: false, abortController: null }
            : {}),
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

      const prompt = input.trim() || '请查看我上传的附件。';
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
        role: 'user',
        totalTokens: estimateMessageTokens({ content: prompt }),
      };
      const modelMessageId = createMessageId();
      const modelMessage: Message = {
        content: '',
        createdAt: now,
        id: modelMessageId,
        isStreaming: true,
        model: selectedModel.id,
        provider: selectedModel.provider,
        role: 'model',
      };

      set({
        abortController: sessionCreationController,
        input: '',
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
            console.error('Session create error:', error);
            set((state) => ({
              input: state.input || input,
              messages: state.messages.filter(
                (item) => item.id !== userMessage.id && item.id !== modelMessageId,
              ),
              pendingAttachments: state.pendingAttachments.length > 0
                ? state.pendingAttachments
                : pendingAttachments,
            }));
            if (!(error instanceof DOMException && error.name === 'AbortError')) {
              toast.error('创建会话失败');
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
      if (isLoading) { toast.error('请等待当前回复完成'); return; }
      if (message.role !== 'model') return;

      const targetSessionId = useSessionStore.getState().activeSessionId;
      if (!targetSessionId) return;

      const index = messages.findIndex((item) => item.id === message.id);
      if (index < 0) return;

      const { availableModels, selectedModelKey, setOpenMenuMessageId } = useUIStore.getState();
      const { getModelKey } = await import('@/lib/chat/helpers');
      const selectedModel = availableModels.find((m) => getModelKey(m) === selectedModelKey);
      const modelConfig = availableModels.find(
        (m) => m.id === message.model && m.provider === message.provider,
      ) || selectedModel;

      if (!modelConfig) { toast.error('请先配置可用模型'); return; }

      const baseContent = message.content.trimEnd();
      const initialContent = baseContent ? `${baseContent}\n\n` : '';
      const continuePrompt: Message = {
        content: '请从上次中断的位置继续，不要重复已经输出过的内容。',
        createdAt: Date.now(),
        id: createMessageId(),
        role: 'user',
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
      const savedMessages = nextMessages.map((item) =>
        item.id === message.id ? { ...item, ...streamedMessage } : item,
      );
      if (useSessionStore.getState().activeSessionId === targetSessionId) {
        set({ messages: savedMessages });
      }

      const sessionStore = useSessionStore.getState();
      await sessionStore.persistSessionMessages(targetSessionId, savedMessages);
    },

    regenerateMessage: async (message, deleteCurrent = false) => {
      const { isLoading, messages, streamAssistantMessage } = get();
      if (isLoading) { toast.error('请等待当前回复完成'); return; }

      const index = messages.findIndex((item) => item.id === message.id);
      if (index < 0) return;

      const { availableModels, selectedModelKey, setOpenMenuMessageId, webSearchEnabled } = useUIStore.getState();
      const selectedModel = availableModels.find((m) => getModelKey(m) === selectedModelKey);

      let modelConfig: ConfiguredModel | undefined;
      if (message.role === 'model') {
        const originalModel = availableModels.find(
          (m) => m.id === message.model && m.provider === message.provider,
        );
        modelConfig = selectedModel || originalModel;
      } else {
        modelConfig = selectedModel;
      }

      if (!modelConfig) { toast.error('请先配置可用模型'); return; }

      const targetId = createMessageId();
      const sessionStore = useSessionStore.getState();
      const targetSessionId = sessionStore.activeSessionId;
      if (!targetSessionId) return;

      if (message.role === 'user') {
        const historyMessages = messages.slice(0, index + 1);
        const modelMessage: Message = {
          content: '', createdAt: Date.now(), id: targetId, isStreaming: true,
          model: modelConfig.id, provider: modelConfig.provider, role: 'model',
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
          if (messages[i].role === 'user') return i;
        }
        return -1;
      })();

      if (promptIndex < 0) {
        toast.error('找不到可用于重新生成的用户消息');
        return;
      }

      const regenerateHistoryMessages = messages.slice(0, promptIndex + 1);
      const nextModelMessage: Message = {
        ...message, content: '', createdAt: Date.now(), id: deleteCurrent ? targetId : message.id,
        generationDuration: undefined, inputTokens: undefined, interrupted: false,
        isReasoning: false, isStreaming: true, model: modelConfig.id,
        outputTokens: undefined, provider: modelConfig.provider, reasoning: undefined,
        reasoningDuration: undefined, segments: undefined, totalTokens: undefined,
        webSearch: undefined,
      };
      const nextMessages = deleteCurrent
        ? [...historyMessages, nextModelMessage]
        : [...messages.slice(0, index), nextModelMessage];

      set({ messages: nextMessages });
      setOpenMenuMessageId(null);

      const streamedMessage = await streamAssistantMessage(
        regenerateHistoryMessages,
        nextModelMessage.id,
        modelConfig,
        { webSearchEnabled },
      );
      const latestRetryMessage = get().messages.find((item) => item.id === nextModelMessage.id);
      const savedMessages = [
        ...nextMessages.slice(0, -1),
        { ...nextModelMessage, ...(latestRetryMessage || {}), ...streamedMessage },
      ];
      if (useSessionStore.getState().activeSessionId === targetSessionId) {
        set({ messages: savedMessages });
      }
      await sessionStore.persistSessionMessages(targetSessionId, savedMessages);
    },

    startEditing: (message) => {
      if (message.isStreaming) { toast.error('生成中不能编辑'); return; }
      set({ editingMessageId: message.id, editingContent: message.content });
      useUIStore.getState().setOpenMenuMessageId(null);
    },

    saveEditing: () => {
      const { editingMessageId, editingContent, messages } = get();
      if (!editingMessageId) return;
      if (!editingContent.trim()) { toast.error('消息内容不能为空'); return; }

      const nextMessages = messages.map((m) =>
        m.id === editingMessageId ? { ...m, content: editingContent.trim() } : m,
      );
      set({ messages: nextMessages, editingMessageId: null, editingContent: '' });

      const sessionStore = useSessionStore.getState();
      if (sessionStore.activeSessionId) void sessionStore.persistSessionMessages(sessionStore.activeSessionId, nextMessages);
      toast.success('消息已更新');
    },

    cancelEditing: () => set({ editingMessageId: null, editingContent: '' }),

    deleteMessage: (id) => {
      const { messages, editingMessageId } = get();
      const nextMessages = messages.filter((m) => m.id !== id);
      const updates: Partial<ChatState> = { messages: nextMessages };
      if (editingMessageId === id) {
        updates.editingMessageId = null;
        updates.editingContent = '';
      }
      set(updates);

      useUIStore.getState().removeFromSelection([id]);
      useUIStore.getState().removeFromCollapsed([id]);

      const sessionStore = useSessionStore.getState();
      if (sessionStore.activeSessionId) void sessionStore.persistSessionMessages(sessionStore.activeSessionId, nextMessages);
      toast.success('消息已删除');
    },

    copyMessage: (message) => { copyText(message.content, '消息已复制'); },

    copyConversation: () => {
      const { messages } = get();
      const text = messages
        .filter((m) => m.content.trim())
        .map((m) => `${m.role === 'user' ? '用户' : m.model || 'AI'}：\n${m.content}`)
        .join('\n\n');
      copyText(text, '对话已复制');
    },

    copySelectedMessages: () => {
      const { messages } = get();
      const { selectedMessageIds } = useUIStore.getState();
      const text = messages
        .filter((m) => selectedMessageIds.includes(m.id))
        .map((m) => `${m.role === 'user' ? '用户' : m.model || 'AI'}：\n${m.content}`)
        .join('\n\n');
      copyText(text, '已复制选中消息');
    },

    deleteSelectedMessages: () => {
      const { messages } = get();
      const uiStore = useUIStore.getState();
      const { selectedMessageIds } = uiStore;

      if (selectedMessageIds.length === 0) { toast.error('请先选择消息'); return; }

      const nextMessages = messages.filter((m) => !selectedMessageIds.includes(m.id));
      set({ messages: nextMessages });
      uiStore.removeFromCollapsed(selectedMessageIds);
      uiStore.exitMultiSelect();

      const sessionStore = useSessionStore.getState();
      if (sessionStore.activeSessionId) void sessionStore.persistSessionMessages(sessionStore.activeSessionId, nextMessages);
      toast.success('已删除选中消息');
    },

  })),
);
