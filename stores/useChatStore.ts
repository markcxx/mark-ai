import toast from 'react-hot-toast';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import { THINKING_TEXTS } from '@/lib/chat/constants';
import { createMessageId, extractThinkingFromText } from '@/lib/chat/helpers';
import { estimateMessageTokens, estimateMessagesTokens, estimateTextTokens } from '@/lib/chat/metrics';
import type { ChatStreamEvent, ConfiguredModel, Message } from '@/lib/chat/types';
import { useSessionStore } from './useSessionStore';
import { useUIStore } from './useUIStore';

type StreamedMessageResult = Pick<
  Message,
  'content' | 'isReasoning' | 'isStreaming' | 'reasoning' | 'reasoningDuration'
> & Pick<
  Message,
  'generationDuration' | 'inputTokens' | 'interrupted' | 'outputTokens' | 'totalTokens'
>;

type StreamOptions = {
  initialContent?: string;
};

const getTotalTokens = (inputTokens: number, outputTokens: number, totalTokens?: number) => {
  const estimatedTotal = inputTokens + outputTokens;
  if (!totalTokens) return estimatedTotal;
  return Math.max(totalTokens, estimatedTotal);
};

interface ChatState {
  messages: Message[];
  input: string;
  isLoading: boolean;
  loadingText: string;
  editingMessageId: string | null;
  editingContent: string;
  abortController: AbortController | null;
}

interface ChatActions {
  setMessages: (messages: Message[]) => void;
  setInput: (input: string) => void;
  setLoadingText: (text: string) => void;
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

    setMessages: (messages) => set({ messages }),
    setInput: (input) => set({ input }),
    setLoadingText: (text) => set({ loadingText: text }),

    abortStreaming: () => {
      const { abortController } = get();
      if (abortController) {
        abortController.abort();
        set({ abortController: null, isLoading: false });
      }
    },

    reset: () =>
      set({
        messages: [],
        input: '',
        isLoading: false,
        editingMessageId: null,
        editingContent: '',
        abortController: null,
      }),

    streamAssistantMessage: async (historyMessages, modelMessageId, modelConfig, options = {}) => {
      const startedAt = Date.now();
      let plainContent = options.initialContent || '';
      let eventReasoning = '';
      let inputTokens = estimateMessagesTokens(historyMessages);
      let outputTokens = 0;
      let totalTokens = inputTokens;
      let reasoningDuration: number | undefined;

      const controller = new AbortController();
      set({ abortController: controller });

      try {
        set((s) => {
          const index = THINKING_TEXTS.indexOf(s.loadingText);
          return { isLoading: true, loadingText: THINKING_TEXTS[(index + 1) % THINKING_TEXTS.length] };
        });

        const response = await fetch('/api/chat', {
          body: JSON.stringify({
            messages: historyMessages.map((m) => ({ content: m.content, role: m.role })),
            model: modelConfig.id,
            provider: modelConfig.provider,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          signal: controller.signal,
        });

        if (!response.ok) throw new Error('Network response was not ok');
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const isStructuredStream = response.headers
          .get('content-type')
          ?.includes('application/x-ndjson');
        let done = false;
        let buffer = '';
        let reasoningStartedAt: number | undefined;

        const beginReasoning = () => { reasoningStartedAt = reasoningStartedAt || Date.now(); };
        const endReasoning = () => {
          if (reasoningStartedAt && !reasoningDuration) {
            reasoningDuration = Date.now() - reasoningStartedAt;
          }
        };

        const updateStreamingMessage = (isReasoning?: boolean) => {
          const extracted = extractThinkingFromText(plainContent);
          const reasoning = `${eventReasoning}${extracted.reasoning}`;
          const estimatedOutputTokens = estimateMessageTokens({
            content: extracted.content,
            reasoning,
          });
          const nextOutputTokens = outputTokens || estimatedOutputTokens;
          const nextTotalTokens = getTotalTokens(inputTokens, nextOutputTokens, totalTokens);
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === modelMessageId
                ? {
                    ...m,
                    content: extracted.content,
                    inputTokens,
                    isReasoning: Boolean(isReasoning || extracted.hasOpenThinking),
                    outputTokens: nextOutputTokens,
                    reasoning,
                    reasoningDuration,
                    totalTokens: nextTotalTokens,
                  }
                : m,
            ),
          }));
        };

        const appendContent = (chunk: string) => {
          plainContent += chunk;
          const extracted = extractThinkingFromText(plainContent);
          if (extracted.reasoning) beginReasoning();
          if (eventReasoning && reasoningStartedAt && !reasoningDuration) endReasoning();
          if (extracted.reasoning && !extracted.hasOpenThinking) endReasoning();
          updateStreamingMessage(extracted.hasOpenThinking);
        };

        const appendReasoning = (chunk: string) => {
          beginReasoning();
          eventReasoning += chunk;
          updateStreamingMessage(true);
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
              updateStreamingMessage(false);
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
        if (reasoningStartedAt && !reasoningDuration) { endReasoning(); updateStreamingMessage(false); }

        const extracted = extractThinkingFromText(plainContent);
        const reasoning = `${eventReasoning}${extracted.reasoning}` || undefined;
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
          totalTokens: finalTotalTokens,
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          const extracted = extractThinkingFromText(plainContent);
          const reasoning = `${eventReasoning}${extracted.reasoning}` || undefined;
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
            totalTokens: finalTotalTokens,
          };
        }
        console.error('Chat error:', error);
        toast.error('生成失败，请稍后重试');
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === modelMessageId
              ? { ...m, content: 'Sorry, I encountered an error. Please try again.', isReasoning: false }
              : m,
          ),
        }));
        return {
          content: 'Sorry, I encountered an error. Please try again.',
          generationDuration: Date.now() - startedAt,
          inputTokens,
          isReasoning: false,
          isStreaming: false,
          outputTokens: estimateTextTokens('Sorry, I encountered an error. Please try again.'),
          reasoning: eventReasoning || undefined,
          reasoningDuration,
          totalTokens: inputTokens + estimateTextTokens('Sorry, I encountered an error. Please try again.'),
        };
      } finally {
        set((s) => ({
          isLoading: false,
          abortController: null,
          messages: s.messages.map((m) =>
            m.id === modelMessageId ? { ...m, isReasoning: false, isStreaming: false } : m,
          ),
        }));
      }
    },

    sendMessage: async () => {
      const { input, isLoading, messages, streamAssistantMessage } = get();
      const { availableModels, selectedModelKey } = useUIStore.getState();
      const { getModelKey } = await import('@/lib/chat/helpers');
      const selectedModel = availableModels.find((m) => getModelKey(m) === selectedModelKey);

      if (!input.trim() || isLoading || !selectedModel) return;

      const prompt = input.trim();
      const sessionStore = useSessionStore.getState();
      let targetSessionId = sessionStore.activeSessionId;
      let createdSession = false;
      let startedStream = false;

      set({ isLoading: true });

      try {
        if (!targetSessionId) {
          try {
            const session = await sessionStore.createSession(prompt, selectedModel);
            targetSessionId = session.id;
            createdSession = true;
            sessionStore.setSessionLoading(session.id, true);
          } catch (error) {
            console.error('Session create error:', error);
            toast.error('创建会话失败');
            return;
          }
        }
        if (!targetSessionId) return;

        const now = Date.now();
        const userMessage: Message = {
          content: prompt,
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

        set({ messages: [...messages, userMessage, modelMessage], input: '' });

        startedStream = true;
        const streamedMessage = await streamAssistantMessage(
          [...messages, userMessage],
          modelMessageId,
          selectedModel,
        );
        const savedMessages = [...messages, userMessage, { ...modelMessage, ...streamedMessage }];
        set({ messages: savedMessages });

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
      set({ messages: savedMessages });

      const sessionStore = useSessionStore.getState();
      if (sessionStore.activeSessionId) {
        await sessionStore.persistSessionMessages(sessionStore.activeSessionId, savedMessages);
      }
    },

    regenerateMessage: async (message, deleteCurrent = false) => {
      const { isLoading, messages, streamAssistantMessage } = get();
      if (isLoading) { toast.error('请等待当前回复完成'); return; }

      const index = messages.findIndex((item) => item.id === message.id);
      if (index < 0) return;

      const { availableModels, selectedModelKey, setOpenMenuMessageId } = useUIStore.getState();
      const { getModelKey } = await import('@/lib/chat/helpers');
      const selectedModel = availableModels.find((m) => getModelKey(m) === selectedModelKey);

      let modelConfig: ConfiguredModel | undefined;
      if (message.role === 'model') {
        modelConfig = availableModels.find(
          (m) => m.id === message.model && m.provider === message.provider,
        ) || selectedModel;
      } else {
        modelConfig = selectedModel;
      }

      if (!modelConfig) { toast.error('请先配置可用模型'); return; }

      const targetId = createMessageId();
      const sessionStore = useSessionStore.getState();

      if (message.role === 'user') {
        const historyMessages = messages.slice(0, index + 1);
        const modelMessage: Message = {
          content: '', createdAt: Date.now(), id: targetId, isStreaming: true,
          model: modelConfig.id, provider: modelConfig.provider, role: 'model',
        };
        set({ messages: [...historyMessages, modelMessage] });
        setOpenMenuMessageId(null);

        const streamedMessage = await streamAssistantMessage(historyMessages, targetId, modelConfig);
        const savedMessages = [...historyMessages, { ...modelMessage, ...streamedMessage }];
        set({ messages: savedMessages });
        if (sessionStore.activeSessionId) await sessionStore.persistSessionMessages(sessionStore.activeSessionId, savedMessages);
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
        reasoningDuration: undefined, totalTokens: undefined,
      };
      const nextMessages = deleteCurrent
        ? [...historyMessages, nextModelMessage]
        : [...messages.slice(0, index), nextModelMessage];

      set({ messages: nextMessages });
      setOpenMenuMessageId(null);

      const streamedMessage = await streamAssistantMessage(regenerateHistoryMessages, nextModelMessage.id, modelConfig);
      const savedMessages = [...nextMessages.slice(0, -1), { ...nextModelMessage, ...streamedMessage }];
      set({ messages: savedMessages });
      if (sessionStore.activeSessionId) await sessionStore.persistSessionMessages(sessionStore.activeSessionId, savedMessages);
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
