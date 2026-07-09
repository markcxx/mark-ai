'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

import { NOT_IMPLEMENTED_TOAST, THINKING_TEXTS } from '@/lib/chat/constants';
import { getModelKey } from '@/lib/chat/helpers';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/useChatStore';
import { useSessionStore, navigateToNewChat } from '@/stores/useSessionStore';
import { useUIStore } from '@/stores/useUIStore';

import { ChatInput } from './ChatInput';
import { ChatMiniMap } from './ChatMiniMap';
import { MessageItem } from './MessageItem';
import { SelectToHereButton } from './SelectToHereButton';
import { SelectionFooterBar } from './SelectionFooterBar';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { WelcomePanel } from './WelcomePanel';

const BOTTOM_SCROLL_THRESHOLD = 48;

function MessageSkeletonList() {
  const lineWidths = ['100%', '88%', '64%'];

  return (
    <div className="mt-6 flex h-full w-full max-w-[840px] flex-col gap-9 px-3">
      <div className="flex w-full flex-col items-end gap-2 pl-[25%]">
        {lineWidths.map((width, index) => (
          <div
            className="h-4 animate-pulse rounded-md bg-gray-200/80 dark:bg-gray-700/80"
            key={width}
            style={{ width: index === lineWidths.length - 1 ? '56%' : width }}
          />
        ))}
      </div>

      {Array.from({ length: 2 }).map((_, index) => (
        <div className="flex w-full gap-3" key={index}>
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-md bg-gray-200/80 dark:bg-gray-700/80" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-2">
              {lineWidths.map((width) => (
                <div
                  className="h-4 animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-700/70"
                  key={width}
                  style={{ width }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-16 animate-pulse rounded-md bg-gray-200/60 dark:bg-gray-700/60" />
              <div className="h-5 w-24 animate-pulse rounded-md bg-gray-200/60 dark:bg-gray-700/60" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChatApp({ initialSessionId }: { initialSessionId?: string }) {
  // UI Store
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const isResizingSidebar = useUIStore((s) => s.isResizingSidebar);
  const openMenuMessageId = useUIStore((s) => s.openMenuMessageId);
  const collapsedMessageIds = useUIStore((s) => s.collapsedMessageIds);
  const multiSelectMode = useUIStore((s) => s.multiSelectMode);
  const selectedMessageIds = useUIStore((s) => s.selectedMessageIds);
  const availableModels = useUIStore((s) => s.availableModels);
  const isLoadingModels = useUIStore((s) => s.isLoadingModels);
  const selectedModelKey = useUIStore((s) => s.selectedModelKey);
  const modelSearchKeyword = useUIStore((s) => s.modelSearchKeyword);
  const wideChatMode = useUIStore((s) => s.wideChatMode);

  // Session Store
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const isLoadingSessions = useSessionStore((s) => s.isLoadingSessions);
  const isLoadingActiveSession = useSessionStore((s) => s.isLoadingActiveSession);
  const loadingSessionIds = useSessionStore((s) => s.loadingSessionIds);

  // Chat Store
  const messages = useChatStore((s) => s.messages);
  const input = useChatStore((s) => s.input);
  const isLoading = useChatStore((s) => s.isLoading);
  const loadingText = useChatStore((s) => s.loadingText);
  const editingMessageId = useChatStore((s) => s.editingMessageId);
  const editingContent = useChatStore((s) => s.editingContent);

  // Refs
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userHasScrolledAwayRef = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectionLayoutMode, setSelectionLayoutMode] = useState(false);
  const [activeMiniMapMessageId, setActiveMiniMapMessageId] = useState<string | null>(null);

  // Derived
  const selectedModel = availableModels.find((m) => getModelKey(m) === selectedModelKey);
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const showWelcome = messages.length === 0 && !multiSelectMode;

  // Scroll helpers
  const scrollToBottom = useCallback((force = false) => {
    const container = messagesScrollRef.current;
    if (!container) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }
    if (!force && userHasScrolledAwayRef.current) return;
    isAutoScrollingRef.current = true;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
      requestAnimationFrame(() => { isAutoScrollingRef.current = false; });
    });
  }, []);

  const handleMessagesScroll = useCallback(() => {
    if (isAutoScrollingRef.current) return;
    const container = messagesScrollRef.current;
    if (!container) return;
    userHasScrolledAwayRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight > BOTTOM_SCROLL_THRESHOLD;

    const containerTop = container.getBoundingClientRect().top;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-message-id]'));
    let activeId: string | null = null;

    for (const node of nodes) {
      if (node.getBoundingClientRect().top - containerTop <= 96) {
        activeId = node.dataset.messageId || activeId;
      } else {
        break;
      }
    }

    if (!activeId && nodes[0]) activeId = nodes[0].dataset.messageId || null;
    setActiveMiniMapMessageId((current) => (current === activeId ? current : activeId));
  }, []);

  const handleLoadSession = useCallback(async (
    sessionId: string,
    options: { history?: 'push' | 'replace' | 'none' } = {},
  ) => {
    useChatStore.getState().abortStreaming();
    userHasScrolledAwayRef.current = false;
    const loadedMessages = await useSessionStore.getState().loadSession(sessionId, options);
    if (loadedMessages) {
      useChatStore.getState().setMessages(loadedMessages);
      useChatStore.setState({ editingMessageId: null, editingContent: '' });
      useUIStore.getState().exitMultiSelect();
      useUIStore.getState().setOpenMenuMessageId(null);
    }
  }, []);

  const handleNewChat = useCallback((history: 'push' | 'replace' | 'none' = 'push') => {
    userHasScrolledAwayRef.current = false;
    useChatStore.getState().reset();
    useSessionStore.getState().resetActiveSession();
    useUIStore.getState().exitMultiSelect();
    useUIStore.getState().setOpenMenuMessageId(null);
    navigateToNewChat(history);
  }, []);

  // PLACEHOLDER_EFFECTS

  // Auto-scroll on new messages
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (!isLoadingActiveSession) scrollToBottom(); }, [isLoadingActiveSession, scrollToBottom]);

  // Load models on mount
  useEffect(() => { useUIStore.getState().loadModels(); }, []);

  // Load sessions on mount
  useEffect(() => {
    useSessionStore.getState().loadSessions(initialSessionId);
  }, [initialSessionId]);

  // Loading text rotation
  useEffect(() => {
    if (!isLoading) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % THINKING_TEXTS.length;
      useChatStore.getState().setLoadingText(THINKING_TEXTS[i]);
    }, 4200);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Sidebar resize cursor
  useEffect(() => {
    if (!isResizingSidebar) return;
    const prev = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => { document.body.style.cursor = prev; document.body.style.userSelect = prevSelect; };
  }, [isResizingSidebar]);

  // Multi-select escape key
  useEffect(() => {
    if (!multiSelectMode) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') useUIStore.getState().exitMultiSelect(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [multiSelectMode]);

  // Keep the full-width selection layout briefly after exit so the row can animate closed.
  useEffect(() => {
    if (multiSelectMode) return;

    const timeout = window.setTimeout(() => setSelectionLayoutMode(false), 180);
    return () => window.clearTimeout(timeout);
  }, [multiSelectMode]);

  // Browser history popstate
  useEffect(() => {
    const handlePopState = () => {
      const nextSessionId = decodeURIComponent(
        window.location.pathname.split('/').filter(Boolean)[0] || '',
      );
      if (nextSessionId) {
        handleLoadSession(nextSessionId, { history: 'none' });
        return;
      }
      handleNewChat('none');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handleLoadSession, handleNewChat]);

  // Handlers
  const handleSidebarResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    useUIStore.getState().setIsResizingSidebar(true);
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      useUIStore.getState().setSidebarWidth(startWidth + e.clientX - startX);
    };
    const handlePointerUp = () => {
      useUIStore.getState().setIsResizingSidebar(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    useChatStore.getState().setInput(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      useChatStore.getState().sendMessage();
    }
  };

  const handleSend = () => {
    if (isLoading) {
      useChatStore.getState().abortStreaming();
      return;
    }
    useChatStore.getState().sendMessage();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const getMessageModel = (message: { role: string; model?: string; provider?: string }) => {
    if (message.role !== 'model') return selectedModel;
    return availableModels.find(
      (m) => m.id === message.model && m.provider === message.provider,
    ) || selectedModel;
  };

  // PLACEHOLDER_RENDER

  return (
    <div
      className={cn(
        'flex h-screen w-screen overflow-hidden bg-[var(--chat-app-bg)] p-2 font-sans text-gray-900 dark:text-gray-100 antialiased',
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
        activeSessionId={activeSessionId}
        isOpen={isSidebarOpen}
        isResizing={isResizingSidebar}
        isLoadingSessions={isLoadingSessions}
        loadingSessionIds={loadingSessionIds}
        onClose={() => useUIStore.getState().setSidebarOpen(false)}
        onDeleteSession={(id) => useSessionStore.getState().deleteSession(id)}
        onNewChat={handleNewChat}
        onRenameSession={(id) => useSessionStore.getState().renameSession(id)}
        onSelectSession={handleLoadSession}
        onToggleFavorite={(id, favorite) => useSessionStore.getState().updateSessionFavorite(id, favorite)}
        onUpdateSessionTitle={(id, title) => useSessionStore.getState().updateSessionTitle(id, title)}
        onUnavailable={() => toast(NOT_IMPLEMENTED_TOAST)}
        sessions={sessions}
        width={sidebarWidth}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e5e5e5] bg-[var(--chat-panel-bg)] shadow-none dark:border-gray-700">
        {isSidebarOpen && (
          <div
            aria-label="调整侧栏宽度"
            className="group absolute inset-y-0 left-0 z-30 w-3 -translate-x-1/2 touch-none cursor-col-resize"
            onPointerDown={handleSidebarResizePointerDown}
            role="separator"
          >
            <div
              className={cn(
                'absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-transparent transition-colors duration-150 group-hover:bg-gray-300 dark:group-hover:bg-gray-600',
                isResizingSidebar && 'bg-primary/50',
              )}
            />
          </div>
        )}

        <TopHeader
          activeSession={activeSession}
          copyConversation={() => useChatStore.getState().copyConversation()}
          copySessionId={() => {
            if (!activeSessionId) { toast.error('当前没有会话 ID'); return; }
            void navigator.clipboard.writeText(activeSessionId);
            toast.success('会话 ID 已复制');
          }}
          deleteSession={() => {
            if (!activeSessionId) { toast.error('当前没有可删除的会话'); return; }
            void useSessionStore.getState().deleteSession(activeSessionId);
          }}
          isFavorite={Boolean(activeSession?.favorite)}
          isSidebarOpen={isSidebarOpen}
          isWideChatMode={wideChatMode}
          onOpenSidebar={() => useUIStore.getState().setSidebarOpen(true)}
          smartRenameSession={() => {
            if (!activeSessionId) { toast.error('当前没有可重命名的会话'); return; }
            void useSessionStore.getState().renameSession(activeSessionId);
          }}
          toggleFavorite={() => {
            if (!activeSessionId) { toast.error('当前没有可收藏的会话'); return; }
            void useSessionStore.getState().updateSessionFavorite(
              activeSessionId,
              !activeSession?.favorite,
            );
          }}
          toggleWideChatMode={() => useUIStore.getState().setWideChatMode(!wideChatMode)}
          updateSessionTitle={(title) => {
            if (!activeSessionId) { toast.error('当前没有可重命名的会话'); return; }
            void useSessionStore.getState().updateSessionTitle(activeSessionId, title);
          }}
        />

        <div
          ref={messagesScrollRef}
          className={cn(
            'flex flex-1 flex-col items-center overflow-y-auto px-4 md:px-8',
            showWelcome ? 'justify-center pb-8 pt-0' : 'pb-40 pt-6',
          )}
          onScroll={handleMessagesScroll}
        >
          {isLoadingActiveSession ? (
            <MessageSkeletonList />
          ) : showWelcome ? (
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
                onSend={handleSend}
                placement="center"
                selectedModel={selectedModel}
                selectedModelKey={selectedModelKey}
                setModelSearchKeyword={(kw) => useUIStore.getState().setModelSearchKeyword(kw)}
                setSelectedModelKey={(key) => useUIStore.getState().setSelectedModelKey(key)}
                textareaRef={textareaRef}
              />
            </WelcomePanel>
          ) : (
            <div
              className={cn(
                'flex w-full flex-col transition-[max-width,gap] duration-200 ease-out',
                selectionLayoutMode
                  ? 'max-w-none gap-0'
                  : wideChatMode
                    ? 'max-w-[1120px] gap-8'
                    : 'max-w-[840px] gap-8',
              )}
            >
              {messages.map((message) => (
                <MessageItem
                  cancelEditingMessage={() => useChatStore.getState().cancelEditing()}
                  collapsed={collapsedMessageIds.includes(message.id)}
                  continueMessage={(m) => useChatStore.getState().continueMessage(m)}
                  copyMessage={(m) => useChatStore.getState().copyMessage(m)}
                  deleteMessage={(id) => useChatStore.getState().deleteMessage(id)}
                  editingContent={editingContent}
                  editingMessageId={editingMessageId}
                  enableMultiSelect={(id) => {
                    setSelectionLayoutMode(true);
                    window.requestAnimationFrame(() => {
                      useUIStore.getState().enableMultiSelect(id);
                    });
                  }}
                  getMessageModel={getMessageModel}
                  isSelected={selectedMessageIds.includes(message.id)}
                  key={message.id}
                  loadingText={loadingText}
                  menuUnavailable={() => { useUIStore.getState().setOpenMenuMessageId(null); toast(NOT_IMPLEMENTED_TOAST); }}
                  message={message}
                  multiSelectMode={multiSelectMode}
                  openMenuMessageId={openMenuMessageId}
                  regenerateMessage={(m, del) => useChatStore.getState().regenerateMessage(m, del)}
                  saveEditingMessage={() => useChatStore.getState().saveEditing()}
                  selectedModel={selectedModel}
                  selectionLayoutMode={selectionLayoutMode}
                  setEditingContent={(c) => useChatStore.setState({ editingContent: c })}
                  setOpenMenuMessageId={(id) => useUIStore.getState().setOpenMenuMessageId(id)}
                  startEditingMessage={(m) => useChatStore.getState().startEditing(m)}
                  toggleCollapseMessage={(id) => useUIStore.getState().toggleCollapseMessage(id)}
                  toggleSelectedMessage={(id, shift) => useUIStore.getState().toggleSelectedMessage(id, !!shift, messages)}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {!isLoadingActiveSession && !showWelcome && !multiSelectMode && (
          <ChatMiniMap
            activeMessageId={activeMiniMapMessageId || messages[0]?.id || null}
            messages={messages}
          />
        )}

        {multiSelectMode && !isLoadingActiveSession && !showWelcome && (
          <SelectToHereButton
            onSelectToHere={(id) => useUIStore.getState().selectToHere(id, messages)}
          />
        )}

        {isLoadingActiveSession || showWelcome ? null : multiSelectMode ? (
          <SelectionFooterBar
            onCopy={() => useChatStore.getState().copySelectedMessages()}
            onDelete={() => useChatStore.getState().deleteSelectedMessages()}
            onExit={() => useUIStore.getState().exitMultiSelect()}
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
            onSend={handleSend}
            selectedModel={selectedModel}
            selectedModelKey={selectedModelKey}
            setModelSearchKeyword={(kw) => useUIStore.getState().setModelSearchKeyword(kw)}
            setSelectedModelKey={(key) => useUIStore.getState().setSelectedModelKey(key)}
            textareaRef={textareaRef}
          />
        )}
      </main>
    </div>
  );
}
