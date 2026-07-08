'use client';

import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

import { NOT_IMPLEMENTED_TOAST, THINKING_TEXTS } from '@/lib/chat/constants';
import { createMessageId, extractThinkingFromText, getModelKey } from '@/lib/chat/helpers';
import type { ChatStreamEvent, ConfiguredModel, Message } from '@/lib/chat/types';
import { cn } from '@/lib/utils';

import { ChatInput } from './ChatInput';
import { MessageItem } from './MessageItem';
import { SelectionFooterBar } from './SelectionFooterBar';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { WelcomePanel } from './WelcomePanel';

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 380;

const clampSidebarWidth = (width: number) =>
  Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);

export default function ChatApp() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<ConfiguredModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [selectedModelKey, setSelectedModelKey] = useState('');
  const [modelSearchKeyword, setModelSearchKeyword] = useState('');
  const [loadingText, setLoadingText] = useState(THINKING_TEXTS[0]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const [collapsedMessageIds, setCollapsedMessageIds] = useState<string[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedModel = availableModels.find((model) => getModelKey(model) === selectedModelKey);
  const showWelcome = messages.length === 0 && !multiSelectMode;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    const loadModels = async () => {
      try {
        const response = await fetch('/api/models', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load models');
        const data = await response.json();
        const models = Array.isArray(data.models) ? data.models : [];

        if (isMounted) {
          setAvailableModels(models);
          setSelectedModelKey(models[0] ? getModelKey(models[0]) : '');
        }
      } catch (error) {
        console.error('Model config error:', error);
        if (isMounted) {
          setAvailableModels([]);
          setSelectedModelKey('');
        }
      } finally {
        if (isMounted) setIsLoadingModels(false);
      }
    };

    loadModels();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoading) return;

    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % THINKING_TEXTS.length;
      setLoadingText(THINKING_TEXTS[i]);
    }, 4200);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizingSidebar]);

  const handleSidebarResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizingSidebar(true);

    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      setSidebarWidth(clampSidebarWidth(startWidth + moveEvent.clientX - startX));
    };

    const handlePointerUp = () => {
      setIsResizingSidebar(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const streamAssistantMessage = async (
    historyMessages: Message[],
    modelMessageId: string,
    modelConfig: ConfiguredModel,
  ) => {
    try {
      setLoadingText((current) => {
        const index = THINKING_TEXTS.indexOf(current);
        return THINKING_TEXTS[(index + 1) % THINKING_TEXTS.length];
      });
      setIsLoading(true);

      const response = await fetch('/api/chat', {
        body: JSON.stringify({
          messages: historyMessages.map((message) => ({
            content: message.content,
            role: message.role,
          })),
          model: modelConfig.id,
          provider: modelConfig.provider,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
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
      let plainContent = '';
      let eventReasoning = '';
      let reasoningStartedAt: number | undefined;
      let reasoningDuration: number | undefined;

      const beginReasoning = () => {
        reasoningStartedAt = reasoningStartedAt || Date.now();
      };

      const endReasoning = () => {
        if (reasoningStartedAt && !reasoningDuration) {
          reasoningDuration = Date.now() - reasoningStartedAt;
        }
      };

      const updateStreamingMessage = (isReasoning?: boolean) => {
        const extracted = extractThinkingFromText(plainContent);
        const reasoning = `${eventReasoning}${extracted.reasoning}`;

        setMessages((prev) =>
          prev.map((message) =>
            message.id === modelMessageId
              ? {
                  ...message,
                  content: extracted.content,
                  isReasoning: Boolean(isReasoning || extracted.hasOpenThinking),
                  reasoning,
                  reasoningDuration,
                }
              : message,
          ),
        );
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
          if (event.type === 'reasoning' && event.text) {
            appendReasoning(event.text);
            return;
          }

          if (event.type === 'content' && event.text) {
            appendContent(event.text);
            return;
          }
        } catch {
          // Fall back to rendering non-JSON chunks as normal content.
        }

        appendContent(line);
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
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            handleStreamLine(line);
          }
        }
      }

      if (isStructuredStream && buffer) {
        handleStreamLine(buffer);
      }

      if (reasoningStartedAt && !reasoningDuration) {
        endReasoning();
        updateStreamingMessage(false);
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('生成失败，请稍后重试');
      setMessages((prev) =>
        prev.map((message) =>
          message.id === modelMessageId
            ? {
                ...message,
                content: 'Sorry, I encountered an error. Please try again.',
                isReasoning: false,
              }
            : message,
        ),
      );
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === modelMessageId
            ? { ...message, isReasoning: false, isStreaming: false }
            : message,
        ),
      );
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !selectedModel) return;

    const userMessage: Message = { content: input.trim(), id: createMessageId(), role: 'user' };
    const modelMessageId = createMessageId();
    const modelMessage: Message = {
      content: '',
      id: modelMessageId,
      isStreaming: true,
      model: selectedModel.id,
      provider: selectedModel.provider,
      role: 'model',
    };
    const nextMessages = [...messages, userMessage, modelMessage];

    setMessages(nextMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    await streamAssistantMessage([...messages, userMessage], modelMessageId, selectedModel);
  };

  const getMessageModel = (message: Message) => {
    if (message.role !== 'model') return selectedModel;

    return (
      availableModels.find(
        (model) => model.id === message.model && model.provider === message.provider,
      ) || selectedModel
    );
  };

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

  const copyMessage = (message: Message) => {
    copyText(message.content, '消息已复制');
  };

  const copyConversation = () => {
    const text = messages
      .filter((message) => message.content.trim())
      .map((message) => `${message.role === 'user' ? '用户' : message.model || 'AI'}：\n${message.content}`)
      .join('\n\n');

    copyText(text, '对话已复制');
  };

  const deleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== id));
    setSelectedMessageIds((prev) => prev.filter((messageId) => messageId !== id));
    setCollapsedMessageIds((prev) => prev.filter((messageId) => messageId !== id));
    if (editingMessageId === id) {
      setEditingMessageId(null);
      setEditingContent('');
    }
    toast.success('消息已删除');
  };

  const startEditingMessage = (message: Message) => {
    if (message.isStreaming) {
      toast.error('生成中不能编辑');
      return;
    }

    setEditingMessageId(message.id);
    setEditingContent(message.content);
    setOpenMenuMessageId(null);
  };

  const saveEditingMessage = () => {
    if (!editingMessageId) return;
    if (!editingContent.trim()) {
      toast.error('消息内容不能为空');
      return;
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.id === editingMessageId ? { ...message, content: editingContent.trim() } : message,
      ),
    );
    setEditingMessageId(null);
    setEditingContent('');
    toast.success('消息已更新');
  };

  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const toggleCollapseMessage = (id: string) => {
    setCollapsedMessageIds((prev) =>
      prev.includes(id) ? prev.filter((messageId) => messageId !== id) : [...prev, id],
    );
    setOpenMenuMessageId(null);
  };

  const enableMultiSelect = (id: string) => {
    setMultiSelectMode(true);
    setSelectionAnchorId(id);
    setSelectedMessageIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setOpenMenuMessageId(null);
  };

  const toggleSelectedMessage = (id: string, shiftKey?: boolean) => {
    if (shiftKey && selectionAnchorId) {
      const anchorIndex = messages.findIndex((message) => message.id === selectionAnchorId);
      const targetIndex = messages.findIndex((message) => message.id === id);

      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [from, to] =
          anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        const rangeIds = messages.slice(from, to + 1).map((message) => message.id);
        setSelectedMessageIds((prev) => [...new Set([...prev, ...rangeIds])]);
        setSelectionAnchorId(id);
        return;
      }
    }

    setSelectedMessageIds((prev) =>
      prev.includes(id) ? prev.filter((messageId) => messageId !== id) : [...prev, id],
    );
    setSelectionAnchorId(id);
  };

  function exitMultiSelect() {
    setMultiSelectMode(false);
    setSelectedMessageIds([]);
    setSelectionAnchorId(undefined);
  }

  useEffect(() => {
    if (!multiSelectMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exitMultiSelect();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [multiSelectMode]);

  const copySelectedMessages = () => {
    const text = messages
      .filter((message) => selectedMessageIds.includes(message.id))
      .map((message) => `${message.role === 'user' ? '用户' : message.model || 'AI'}：\n${message.content}`)
      .join('\n\n');

    copyText(text, '已复制选中消息');
  };

  const deleteSelectedMessages = () => {
    if (selectedMessageIds.length === 0) {
      toast.error('请先选择消息');
      return;
    }

    setMessages((prev) => prev.filter((message) => !selectedMessageIds.includes(message.id)));
    setCollapsedMessageIds((prev) => prev.filter((id) => !selectedMessageIds.includes(id)));
    exitMultiSelect();
    toast.success('已删除选中消息');
  };

  const regenerateMessage = async (message: Message, deleteCurrent = false) => {
    if (isLoading) {
      toast.error('请等待当前回复完成');
      return;
    }

    const index = messages.findIndex((item) => item.id === message.id);
    if (index < 0) return;

    const modelConfig = getMessageModel(message);
    if (!modelConfig) {
      toast.error('请先配置可用模型');
      return;
    }

    const targetId = createMessageId();

    if (message.role === 'user') {
      const historyMessages = messages.slice(0, index + 1);
      const modelMessage: Message = {
        content: '',
        id: targetId,
        isStreaming: true,
        model: modelConfig.id,
        provider: modelConfig.provider,
        role: 'model',
      };

      setMessages([...historyMessages, modelMessage]);
      setOpenMenuMessageId(null);
      await streamAssistantMessage(historyMessages, targetId, modelConfig);
      return;
    }

    const historyMessages = messages.slice(0, index);
    const nextModelMessage: Message = {
      ...message,
      content: '',
      id: deleteCurrent ? targetId : message.id,
      isReasoning: false,
      isStreaming: true,
      model: modelConfig.id,
      provider: modelConfig.provider,
      reasoning: undefined,
      reasoningDuration: undefined,
    };

    if (deleteCurrent) {
      setMessages([...historyMessages, nextModelMessage]);
    } else {
      setMessages((prev) => [...prev.slice(0, index), nextModelMessage]);
    }

    setOpenMenuMessageId(null);
    await streamAssistantMessage(historyMessages, nextModelMessage.id, modelConfig);
  };

  const menuUnavailable = () => {
    setOpenMenuMessageId(null);
    toast(NOT_IMPLEMENTED_TOAST);
  };

  const handleNewChat = () => {
    setMessages([]);
    exitMultiSelect();
    setEditingMessageId(null);
    setEditingContent('');
    toast.success('已新建会话');
  };

  return (
    <div
      className={cn(
        'flex h-screen w-screen overflow-hidden bg-[#f8f8f8] p-2 font-sans text-gray-900 antialiased',
        isResizingSidebar && 'cursor-col-resize select-none',
      )}
    >
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'text-sm',
          duration: 2200,
          style: {
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.12)',
          },
        }}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        isResizing={isResizingSidebar}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={handleNewChat}
        onUnavailable={() => toast(NOT_IMPLEMENTED_TOAST)}
        width={sidebarWidth}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e5e5e5] bg-white shadow-none">
        {isSidebarOpen && (
          <div
            aria-label="调整侧栏宽度"
            className="group absolute inset-y-0 left-0 z-30 w-3 -translate-x-1/2 touch-none cursor-col-resize"
            onPointerDown={handleSidebarResizePointerDown}
            role="separator"
          >
            <div
              className={cn(
                'absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-transparent transition-colors duration-150 group-hover:bg-gray-300',
                isResizingSidebar && 'bg-primary/50',
              )}
            />
          </div>
        )}

        <TopHeader
          copyConversation={copyConversation}
          isSidebarOpen={isSidebarOpen}
          onMore={() => toast(NOT_IMPLEMENTED_TOAST)}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />

        <div
          className={cn(
            'flex flex-1 flex-col items-center overflow-y-auto px-4 md:px-8',
            showWelcome ? 'justify-center pb-8 pt-0' : 'pb-40 pt-6',
          )}
        >
          {showWelcome ? (
            <WelcomePanel>
              <ChatInput
                availableModels={availableModels}
                input={input}
                isLoading={isLoading}
                isLoadingModels={isLoadingModels}
                modelSearchKeyword={modelSearchKeyword}
                onAttachment={() => toast(NOT_IMPLEMENTED_TOAST)}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onMic={() => toast(NOT_IMPLEMENTED_TOAST)}
                onSend={sendMessage}
                placement="center"
                selectedModel={selectedModel}
                selectedModelKey={selectedModelKey}
                setModelSearchKeyword={setModelSearchKeyword}
                setSelectedModelKey={setSelectedModelKey}
                textareaRef={textareaRef}
              />
            </WelcomePanel>
          ) : (
            <div className="flex w-full max-w-[840px] flex-col gap-8">
              {messages.map((message) => (
                <MessageItem
                  cancelEditingMessage={cancelEditingMessage}
                  collapsed={collapsedMessageIds.includes(message.id)}
                  copyMessage={copyMessage}
                  deleteMessage={deleteMessage}
                  editingContent={editingContent}
                  editingMessageId={editingMessageId}
                  enableMultiSelect={enableMultiSelect}
                  getMessageModel={getMessageModel}
                  isSelected={selectedMessageIds.includes(message.id)}
                  key={message.id}
                  loadingText={loadingText}
                  menuUnavailable={menuUnavailable}
                  message={message}
                  multiSelectMode={multiSelectMode}
                  openMenuMessageId={openMenuMessageId}
                  regenerateMessage={regenerateMessage}
                  saveEditingMessage={saveEditingMessage}
                  selectedModel={selectedModel}
                  setEditingContent={setEditingContent}
                  setOpenMenuMessageId={setOpenMenuMessageId}
                  startEditingMessage={startEditingMessage}
                  toggleCollapseMessage={toggleCollapseMessage}
                  toggleSelectedMessage={toggleSelectedMessage}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {showWelcome ? null : multiSelectMode ? (
          <SelectionFooterBar
            onCopy={copySelectedMessages}
            onDelete={deleteSelectedMessages}
            onExit={exitMultiSelect}
            selectedCount={selectedMessageIds.length}
          />
        ) : (
          <ChatInput
            availableModels={availableModels}
            input={input}
            isLoading={isLoading}
            isLoadingModels={isLoadingModels}
            modelSearchKeyword={modelSearchKeyword}
            onAttachment={() => toast(NOT_IMPLEMENTED_TOAST)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onMic={() => toast(NOT_IMPLEMENTED_TOAST)}
            onSend={sendMessage}
            selectedModel={selectedModel}
            selectedModelKey={selectedModelKey}
            setModelSearchKeyword={setModelSearchKeyword}
            setSelectedModelKey={setSelectedModelKey}
            textareaRef={textareaRef}
          />
        )}
      </main>
    </div>
  );
}
