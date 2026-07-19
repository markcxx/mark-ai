"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import toast, { Toaster } from "react-hot-toast";

import { NOT_IMPLEMENTED_TOAST, THINKING_TEXTS } from "@/lib/chat/constants";
import {
  deleteChatSession,
  loadChatSession,
  renameChatSession,
  startNewChat,
} from "@/lib/chat/client/chat-controller";
import { getModelKey } from "@/lib/chat/helpers";
import { useChatAttachments } from "@/hooks/use-chat-attachments";
import { useConversationScroll } from "@/hooks/use-conversation-scroll";
import { useSidebarResize } from "@/hooks/use-sidebar-resize";
import { PRIMARY_COLOR_VALUES } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/useChatStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";
import { PluginCenterDrawer } from "@/components/tools/PluginCenterDrawer";

import { ChatInput } from "./ChatInput";
import { ChatMiniMap } from "./ChatMiniMap";
import { ExportDialog, type ExportMode } from "./ExportDialog";
import { HtmlPreviewContext } from "./HtmlPreviewContext";
import { HtmlPreviewPanel } from "./HtmlPreviewPanel";
import type { HtmlPreviewPayload } from "./htmlPreviewUtils";
import { MessageItem } from "./MessageItem";
import { SelectToHereButton } from "./SelectToHereButton";
import { SelectionFooterBar } from "./SelectionFooterBar";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";
import { WelcomePanel } from "./WelcomePanel";

function MessageSkeletonList() {
  const lineWidths = ["100%", "88%", "64%"];

  return (
    <div className="mt-6 flex h-full w-full max-w-[840px] flex-col gap-9 px-3">
      <div className="flex w-full flex-col items-end gap-2 pl-[25%]">
        {lineWidths.map((width, index) => (
          <div
            className="h-4 animate-pulse rounded-md bg-gray-200/80 dark:bg-gray-700/80"
            key={width}
            style={{ width: index === lineWidths.length - 1 ? "56%" : width }}
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
  const { setTheme } = useTheme();
  const generalSettings = useSettingsStore((s) => s.general);
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  // UI Store
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const isResizingSidebar = useUIStore((s) => s.isResizingSidebar);
  const openMenuMessageId = useUIStore((s) => s.openMenuMessageId);
  const collapsedMessageIds = useUIStore((s) => s.collapsedMessageIds);
  const multiSelectMode = useUIStore((s) => s.multiSelectMode);
  const selectedMessageIds = useUIStore((s) => s.selectedMessageIds);
  const availableModels = useUIStore((s) => s.availableModels);
  const providerNames = useUIStore((s) => s.providerNames);
  const isLoadingModels = useUIStore((s) => s.isLoadingModels);
  const selectedModelKey = useUIStore((s) => s.selectedModelKey);
  const modelSearchKeyword = useUIStore((s) => s.modelSearchKeyword);
  const wideChatMode = useUIStore((s) => s.wideChatMode);
  const webSearchEnabled = useUIStore((s) => s.webSearchEnabled);
  const pluginCenterOpen = useUIStore((s) => s.pluginCenterOpen);

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
  const pendingAttachments = useChatStore((s) => s.pendingAttachments);

  const {
    activeMessageId: activeMiniMapMessageId,
    handleScroll: handleMessagesScroll,
    messagesEndRef,
    messagesScrollRef,
    resetScrollIntent,
    scrollToBottom,
  } = useConversationScroll(generalSettings.autoScroll);
  const { attachmentUploading, fileInputRef, handleAttachmentFiles, removeAttachment } =
    useChatAttachments();
  const handleSidebarResizePointerDown = useSidebarResize(sidebarWidth);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectionLayoutMode, setSelectionLayoutMode] = useState(false);
  const [activeHtmlPreview, setActiveHtmlPreview] = useState<HtmlPreviewPayload | null>(null);
  const [htmlPreviewFullscreen, setHtmlPreviewFullscreen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportDialogMode, setExportDialogMode] = useState<ExportMode>("image");

  useEffect(() => {
    const guestDraft = window.localStorage.getItem("markai:guest-draft")?.trim();
    if (!guestDraft || useChatStore.getState().input) return;
    useChatStore.getState().setInput(guestDraft);
    window.localStorage.removeItem("markai:guest-draft");
  }, []);

  // Derived
  const selectedModel = availableModels.find((m) => getModelKey(m) === selectedModelKey);
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const showWelcome = messages.length === 0 && !multiSelectMode;
  const mobileSidebarOffset = `min(${sidebarWidth}px, 86vw)`;

  const handleLoadSession = useCallback(
    async (sessionId: string, options: { history?: "push" | "replace" | "none" } = {}) => {
      setActiveHtmlPreview(null);
      setHtmlPreviewFullscreen(false);
      resetScrollIntent();
      const loaded = await loadChatSession(sessionId, options);
      if (loaded) {
        await useToolStore
          .getState()
          .setActiveSession(sessionId)
          .catch(() => {
            toast.error("加载会话工具失败");
          });
      }
    },
    [resetScrollIntent],
  );

  const handleNewChat = useCallback(
    (history: "push" | "replace" | "none" = "push") => {
      setActiveHtmlPreview(null);
      setHtmlPreviewFullscreen(false);
      resetScrollIntent();
      useToolStore.getState().resetForNewChat();
      startNewChat(history);
    },
    [resetScrollIntent],
  );

  // PLACEHOLDER_EFFECTS

  useEffect(() => {
    if (!settingsLoaded) return;
    const root = document.documentElement;
    root.dataset.primaryColor = generalSettings.primaryColor;
    if (generalSettings.primaryColor === "black") {
      root.style.removeProperty("--color-primary");
      root.style.removeProperty("--color-primary-container");
    } else {
      root.style.setProperty("--color-primary", PRIMARY_COLOR_VALUES[generalSettings.primaryColor]);
      root.style.setProperty(
        "--color-primary-container",
        PRIMARY_COLOR_VALUES[generalSettings.primaryColor],
      );
    }
    root.style.setProperty("--chat-font-size", `${generalSettings.chatFontSize}px`);
    root.dataset.density = generalSettings.density;
    root.dataset.reduceMotion = generalSettings.reduceMotion ? "true" : "false";
    setTheme(generalSettings.themeMode);
    useUIStore.getState().setWebSearchEnabled(generalSettings.defaultWebSearch);
    useUIStore.getState().setWideChatMode(generalSettings.wideChatMode);
    useUIStore.getState().setSidebarWidth(generalSettings.sidebarWidth);
  }, [generalSettings, setTheme, settingsLoaded]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);
  useEffect(() => {
    if (!isLoadingActiveSession) scrollToBottom();
  }, [isLoadingActiveSession, scrollToBottom]);

  // Keep the boot splash visible until all startup data has settled and rendered.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const uiStore = useUIStore.getState();

        // Chat state lives in Zustand and survives route-level remounts. Avoid
        // rerunning the full boot sequence if the URL changed after startup.
        if (uiStore.isAppReady) {
          const sessionStore = useSessionStore.getState();
          if (initialSessionId && sessionStore.activeSessionId !== initialSessionId) {
            await handleLoadSession(initialSessionId, { history: "none" });
          }
          return;
        }

        const totalTasks = initialSessionId ? 4 : 3;
        let completedTasks = 0;
        const finishTask = (message: string) => {
          completedTasks += 1;
          useUIStore
            .getState()
            .setBootProgress(12 + Math.round((completedTasks / totalTasks) * 76), message);
        };

        uiStore.setBootProgress(12, "正在加载模型与会话…");
        await Promise.all([
          useSettingsStore
            .getState()
            .loadSettings()
            .then(() => finishTask("个性化设置已加载")),
          uiStore.loadModels().then(() => finishTask("模型配置已加载")),
          (async () => {
            await useSessionStore.getState().loadSessions();
            finishTask("会话历史已加载");
            if (initialSessionId) {
              useUIStore.getState().setBootProgress(72, "正在恢复当前会话…");
              await handleLoadSession(initialSessionId, { history: "none" });
              finishTask("当前会话已恢复");
            }
          })(),
        ]);
      } finally {
        if (!cancelled) {
          useUIStore.getState().setBootProgress(94, "正在渲染界面…");
          window.requestAnimationFrame(() => {
            if (!cancelled) {
              useUIStore.getState().setBootProgress(100, "加载完成");
              useUIStore.getState().setAppReady(true);
            }
          });
        }
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [initialSessionId, handleLoadSession]);

  // Mobile uses the sidebar as a temporary drawer instead of a persistent column.
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const syncMobileViewport = () => {
      const mobile = query.matches;
      setIsMobileViewport(mobile);
      if (mobile) useUIStore.getState().setSidebarOpen(false);
    };

    syncMobileViewport();
    query.addEventListener("change", syncMobileViewport);
    return () => query.removeEventListener("change", syncMobileViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport || !isSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileViewport, isSidebarOpen]);

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
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prev;
      document.body.style.userSelect = prevSelect;
    };
  }, [isResizingSidebar]);

  // Multi-select escape key
  useEffect(() => {
    if (!multiSelectMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") useUIStore.getState().exitMultiSelect();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
        window.location.pathname.split("/").filter(Boolean)[0] || "",
      );
      if (nextSessionId) {
        handleLoadSession(nextSessionId, { history: "none" });
        return;
      }
      handleNewChat("none");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [handleLoadSession, handleNewChat]);

  // Handlers
  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    useChatStore.getState().setInput(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const shouldSend =
      generalSettings.sendShortcut === "enter"
        ? event.key === "Enter" && !event.shiftKey
        : event.key === "Enter" && (event.ctrlKey || event.metaKey);
    if (shouldSend) {
      event.preventDefault();
      if (attachmentUploading) return;
      useChatStore.getState().sendMessage();
    }
  };

  const handleSend = () => {
    if (isLoading) {
      useChatStore.getState().abortStreaming();
      return;
    }
    useChatStore.getState().sendMessage();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const openExportDialog = (mode: ExportMode) => {
    if (messages.length === 0) {
      toast.error("没有可导出的消息");
      return;
    }
    setExportDialogMode(mode);
    setExportDialogOpen(true);
  };

  const getMessageModel = (message: { role: string; model?: string; provider?: string }) => {
    if (message.role !== "model") return selectedModel;
    return (
      availableModels.find((m) => m.id === message.model && m.provider === message.provider) ||
      selectedModel
    );
  };

  const openHtmlPreview = useCallback((preview: HtmlPreviewPayload) => {
    setActiveHtmlPreview(preview);
    setHtmlPreviewFullscreen(false);
    useUIStore.getState().setSidebarOpen(false);
  }, []);

  const closeHtmlPreview = useCallback(() => {
    setActiveHtmlPreview(null);
    setHtmlPreviewFullscreen(false);
    if (!isMobileViewport) useUIStore.getState().setSidebarOpen(true);
  }, [isMobileViewport]);

  // PLACEHOLDER_RENDER

  return (
    <div
      className={cn(
        "flex h-dvh w-screen overflow-hidden bg-[var(--chat-app-bg)] p-0 font-sans text-gray-900 antialiased dark:text-gray-100 md:p-2",
        isResizingSidebar && "cursor-col-resize select-none",
      )}
    >
      <Toaster
        position="top-center"
        toastOptions={{
          className: "text-sm",
          duration: 2200,
          style: {
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            boxShadow: "0 12px 36px rgba(0,0,0,0.12)",
          },
        }}
      />
      <input
        accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.csv,.docx,.xlsx,.pptx"
        className="hidden"
        multiple
        onChange={handleAttachmentFiles}
        ref={fileInputRef}
        type="file"
      />

      <Sidebar
        activeSessionId={activeSessionId}
        isOpen={isSidebarOpen}
        isResizing={isResizingSidebar}
        isLoadingSessions={isLoadingSessions}
        loadingSessionIds={loadingSessionIds}
        onClose={() => useUIStore.getState().setSidebarOpen(false)}
        onDeleteSession={(id) => void deleteChatSession(id)}
        onNewChat={() => {
          handleNewChat();
          if (isMobileViewport) useUIStore.getState().setSidebarOpen(false);
        }}
        onRenameSession={(id) => void renameChatSession(id)}
        onSelectSession={(id) => {
          void handleLoadSession(id);
          if (isMobileViewport) useUIStore.getState().setSidebarOpen(false);
        }}
        onToggleFavorite={(id, favorite) =>
          useSessionStore.getState().updateSessionFavorite(id, favorite)
        }
        onUpdateSessionTitle={(id, title) =>
          useSessionStore.getState().updateSessionTitle(id, title)
        }
        sessions={sessions}
        width={sidebarWidth}
      />

      {isMobileViewport && isSidebarOpen && (
        <button
          aria-label="收起历史会话"
          className="fixed inset-y-0 right-0 z-30 bg-transparent"
          onClick={() => useUIStore.getState().setSidebarOpen(false)}
          style={{ left: mobileSidebarOffset }}
          type="button"
        />
      )}

      <HtmlPreviewContext.Provider
        value={{
          activePreview: activeHtmlPreview,
          closePreview: closeHtmlPreview,
          openPreview: openHtmlPreview,
        }}
      >
        <div
          className={cn(
            "grid min-w-0 flex-1 transition-[grid-template-columns,gap,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:duration-300 md:ease-out",
            activeHtmlPreview && (htmlPreviewFullscreen || isMobileViewport) ? "gap-0" : "gap-2",
          )}
          style={{
            gridTemplateColumns: activeHtmlPreview
              ? htmlPreviewFullscreen || isMobileViewport
                ? "minmax(0, 0fr) minmax(0, 1fr)"
                : "minmax(0, 1fr) minmax(360px, 48%)"
              : "minmax(0, 1fr)",
            transform:
              isMobileViewport && isSidebarOpen ? `translateX(${mobileSidebarOffset})` : undefined,
          }}
        >
          <main
            className={cn(
              "relative flex min-w-0 flex-col overflow-hidden border-0 bg-[var(--chat-panel-bg)] shadow-none transition-[opacity,border-color] duration-300 ease-out dark:border-gray-700 md:rounded-xl md:border md:border-[#e5e5e5]",
              activeHtmlPreview && (htmlPreviewFullscreen || isMobileViewport)
                ? "pointer-events-none border-transparent opacity-0"
                : "opacity-100",
            )}
          >
            {isSidebarOpen && (
              <div
                aria-label="调整侧栏宽度"
                className="group absolute inset-y-0 left-0 z-30 hidden w-3 -translate-x-1/2 touch-none cursor-col-resize md:block"
                onPointerDown={handleSidebarResizePointerDown}
                role="separator"
              >
                <div
                  className={cn(
                    "absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-transparent transition-colors duration-150 group-hover:bg-gray-300 dark:group-hover:bg-gray-600",
                    isResizingSidebar && "bg-primary/50",
                  )}
                />
              </div>
            )}

            <TopHeader
              activeSession={activeSession}
              copyConversation={() => useChatStore.getState().copyConversation()}
              copySessionId={() => {
                if (!activeSessionId) {
                  toast.error("当前没有会话 ID");
                  return;
                }
                void navigator.clipboard.writeText(activeSessionId);
                toast.success("会话 ID 已复制");
              }}
              deleteSession={() => {
                if (!activeSessionId) {
                  toast.error("当前没有可删除的会话");
                  return;
                }
                void deleteChatSession(activeSessionId);
              }}
              exportSessionImage={() => openExportDialog("image")}
              exportSessionJson={() => openExportDialog("json")}
              isFavorite={Boolean(activeSession?.favorite)}
              isSidebarOpen={isSidebarOpen}
              isWideChatMode={wideChatMode}
              onOpenSidebar={() => useUIStore.getState().setSidebarOpen(true)}
              smartRenameSession={() => {
                if (!activeSessionId) {
                  toast.error("当前没有可重命名的会话");
                  return;
                }
                void renameChatSession(activeSessionId);
              }}
              toggleFavorite={() => {
                if (!activeSessionId) {
                  toast.error("当前没有可收藏的会话");
                  return;
                }
                void useSessionStore
                  .getState()
                  .updateSessionFavorite(activeSessionId, !activeSession?.favorite);
              }}
              toggleWideChatMode={() => {
                useUIStore.getState().setWideChatMode(!wideChatMode);
                useSettingsStore.getState().updateGeneral({ wideChatMode: !wideChatMode });
              }}
              updateSessionTitle={(title) => {
                if (!activeSessionId) {
                  toast.error("当前没有可重命名的会话");
                  return;
                }
                void useSessionStore.getState().updateSessionTitle(activeSessionId, title);
              }}
            />

            <div
              ref={messagesScrollRef}
              className={cn(
                "flex flex-1 flex-col items-center overflow-y-auto px-3 md:px-8",
                showWelcome
                  ? "justify-center pb-6 pt-0 md:pb-8"
                  : "pb-[calc(11rem+env(safe-area-inset-bottom))] pt-4 md:pb-40 md:pt-6",
              )}
              onScroll={handleMessagesScroll}
            >
              {isLoadingActiveSession ? (
                <MessageSkeletonList />
              ) : showWelcome ? (
                <WelcomePanel>
                  <ChatInput
                    availableModels={availableModels}
                    attachments={pendingAttachments}
                    attachmentUploading={attachmentUploading}
                    input={input}
                    isLoading={isLoading}
                    isLoadingModels={isLoadingModels}
                    modelSearchKeyword={modelSearchKeyword}
                    messages={messages}
                    onAttachment={() => fileInputRef.current?.click()}
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onMic={() => toast(NOT_IMPLEMENTED_TOAST)}
                    onRemoveAttachment={removeAttachment}
                    onSend={handleSend}
                    onToggleWebSearch={() => {
                      const enabled = !useUIStore.getState().webSearchEnabled;
                      useUIStore.getState().setWebSearchEnabled(enabled);
                      useSettingsStore.getState().updateGeneral({
                        defaultWebSearch: enabled,
                      });
                    }}
                    placement="center"
                    providerNames={providerNames}
                    selectedModel={selectedModel}
                    selectedModelKey={selectedModelKey}
                    setModelSearchKeyword={(kw) => useUIStore.getState().setModelSearchKeyword(kw)}
                    setSelectedModelKey={(key) => useUIStore.getState().setSelectedModelKey(key)}
                    textareaRef={textareaRef}
                    webSearchEnabled={webSearchEnabled}
                  />
                </WelcomePanel>
              ) : (
                <div
                  className={cn(
                    "flex w-full flex-col transition-[max-width,gap,padding] duration-300 ease-out",
                    selectionLayoutMode
                      ? "max-w-none"
                      : wideChatMode
                        ? "max-w-full px-1 md:px-3"
                        : "max-w-[840px]",
                    selectionLayoutMode
                      ? "gap-0"
                      : generalSettings.density === "compact"
                        ? "gap-5"
                        : generalSettings.density === "spacious"
                          ? "gap-10"
                          : "gap-8",
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
                      menuUnavailable={() => {
                        useUIStore.getState().setOpenMenuMessageId(null);
                        toast(NOT_IMPLEMENTED_TOAST);
                      }}
                      message={message}
                      multiSelectMode={multiSelectMode}
                      openMenuMessageId={openMenuMessageId}
                      regenerateMessage={(message, mode) =>
                        useChatStore.getState().regenerateMessage(message, mode)
                      }
                      saveEditingMessage={() => useChatStore.getState().saveEditing()}
                      selectMessageVariant={(messageId, variantId) =>
                        useChatStore.getState().selectMessageVariant(messageId, variantId)
                      }
                      selectedModel={selectedModel}
                      selectionLayoutMode={selectionLayoutMode}
                      setEditingContent={(c) => useChatStore.setState({ editingContent: c })}
                      setOpenMenuMessageId={(id) => useUIStore.getState().setOpenMenuMessageId(id)}
                      startEditingMessage={(m) => useChatStore.getState().startEditing(m)}
                      toggleCollapseMessage={(id) =>
                        useUIStore.getState().toggleCollapseMessage(id)
                      }
                      toggleSelectedMessage={(id, shift) =>
                        useUIStore.getState().toggleSelectedMessage(id, !!shift, messages)
                      }
                      translateMessage={(message, language) =>
                        useChatStore.getState().translateMessage(message, language)
                      }
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
                attachments={pendingAttachments}
                attachmentUploading={attachmentUploading}
                input={input}
                isLoading={isLoading}
                isLoadingModels={isLoadingModels}
                modelSearchKeyword={modelSearchKeyword}
                messages={messages}
                onAttachment={() => fileInputRef.current?.click()}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onMic={() => toast(NOT_IMPLEMENTED_TOAST)}
                onRemoveAttachment={removeAttachment}
                onSend={handleSend}
                onToggleWebSearch={() => {
                  const enabled = !useUIStore.getState().webSearchEnabled;
                  useUIStore.getState().setWebSearchEnabled(enabled);
                  useSettingsStore.getState().updateGeneral({
                    defaultWebSearch: enabled,
                  });
                }}
                providerNames={providerNames}
                selectedModel={selectedModel}
                selectedModelKey={selectedModelKey}
                setModelSearchKeyword={(kw) => useUIStore.getState().setModelSearchKeyword(kw)}
                setSelectedModelKey={(key) => useUIStore.getState().setSelectedModelKey(key)}
                textareaRef={textareaRef}
                webSearchEnabled={webSearchEnabled}
                wide={wideChatMode}
              />
            )}
          </main>

          {activeHtmlPreview && (
            <HtmlPreviewPanel
              fullscreen={htmlPreviewFullscreen}
              onClose={closeHtmlPreview}
              onFullscreenChange={setHtmlPreviewFullscreen}
              preview={activeHtmlPreview}
            />
          )}
        </div>
      </HtmlPreviewContext.Provider>

      {exportDialogOpen && (
        <ExportDialog
          initialMode={exportDialogMode}
          messages={messages}
          onClose={() => setExportDialogOpen(false)}
          open
          session={activeSession}
        />
      )}
      <PluginCenterDrawer
        onClose={() => useUIStore.getState().setPluginCenterOpen(false)}
        open={pluginCenterOpen}
      />
    </div>
  );
}
