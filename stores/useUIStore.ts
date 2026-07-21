import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type { ConfiguredModel, Message } from "@/lib/chat/types";
import { getModelKey } from "@/lib/chat/helpers";

interface UIState {
  isAppReady: boolean;
  bootMessage: string;
  bootProgress: number;
  isSidebarOpen: boolean;
  sidebarWidth: number;
  isResizingSidebar: boolean;
  openMenuMessageId: string | null;
  collapsedMessageIds: string[];
  multiSelectMode: boolean;
  selectedMessageIds: string[];
  selectionAnchorId: string | undefined;
  wideChatMode: boolean;
  modelSearchKeyword: string;
  availableModels: ConfiguredModel[];
  providerNames: Record<string, string>;
  isLoadingModels: boolean;
  selectedModelKey: string;
  webSearchEnabled: boolean;
  pluginCenterOpen: boolean;
}

interface UIActions {
  setAppReady: (ready: boolean) => void;
  setBootProgress: (progress: number, message: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setIsResizingSidebar: (resizing: boolean) => void;
  setOpenMenuMessageId: (id: string | null) => void;
  toggleCollapseMessage: (id: string) => void;
  enableMultiSelect: (id: string) => void;
  toggleSelectedMessage: (id: string, shiftKey: boolean, messages: Message[]) => void;
  selectToHere: (targetId: string | undefined, messages: Message[]) => void;
  setWideChatMode: (wide: boolean) => void;
  exitMultiSelect: () => void;
  removeFromSelection: (ids: string[]) => void;
  removeFromCollapsed: (ids: string[]) => void;
  loadModels: () => Promise<void>;
  setSelectedModelKey: (key: string) => void;
  setModelSearchKeyword: (keyword: string) => void;
  setWebSearchEnabled: (enabled: boolean) => void;
  toggleWebSearch: () => void;
  setPluginCenterOpen: (open: boolean) => void;
}

export type UIStore = UIState & UIActions;

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 380;
const SELECTED_MODEL_STORAGE_KEY = "markai:selected-model";

const clampSidebarWidth = (width: number) =>
  Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set, get) => ({
    isAppReady: false,
    bootMessage: "正在启动 MarkAI…",
    bootProgress: 8,
    isSidebarOpen: true,
    sidebarWidth: 260,
    isResizingSidebar: false,
    openMenuMessageId: null,
    collapsedMessageIds: [],
    multiSelectMode: false,
    selectedMessageIds: [],
    selectionAnchorId: undefined,
    wideChatMode: false,
    modelSearchKeyword: "",
    availableModels: [],
    providerNames: {},
    isLoadingModels: true,
    selectedModelKey: "",
    webSearchEnabled: false,
    pluginCenterOpen: false,

    setAppReady: (ready) => set({ isAppReady: ready }),
    setBootProgress: (progress, message) =>
      set((state) => ({
        bootMessage: message,
        bootProgress: Math.max(state.bootProgress, Math.min(100, Math.max(0, progress))),
      })),
    toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
    setSidebarOpen: (open) => set({ isSidebarOpen: open }),
    setSidebarWidth: (width) => set({ sidebarWidth: clampSidebarWidth(width) }),
    setIsResizingSidebar: (resizing) => set({ isResizingSidebar: resizing }),
    setOpenMenuMessageId: (id) => set({ openMenuMessageId: id }),

    toggleCollapseMessage: (id) =>
      set((s) => ({
        collapsedMessageIds: s.collapsedMessageIds.includes(id)
          ? s.collapsedMessageIds.filter((mid) => mid !== id)
          : [...s.collapsedMessageIds, id],
        openMenuMessageId: null,
      })),

    enableMultiSelect: (id) =>
      set((s) => ({
        multiSelectMode: true,
        selectionAnchorId: id,
        selectedMessageIds: s.selectedMessageIds.includes(id)
          ? s.selectedMessageIds
          : [...s.selectedMessageIds, id],
        openMenuMessageId: null,
      })),

    toggleSelectedMessage: (id, shiftKey, messages) => {
      const { selectionAnchorId } = get();

      if (shiftKey && selectionAnchorId) {
        const anchorIndex = messages.findIndex((m) => m.id === selectionAnchorId);
        const targetIndex = messages.findIndex((m) => m.id === id);

        if (anchorIndex >= 0 && targetIndex >= 0) {
          const [from, to] =
            anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
          const rangeIds = messages.slice(from, to + 1).map((m) => m.id);
          set((s) => ({
            selectedMessageIds: [...new Set([...s.selectedMessageIds, ...rangeIds])],
            selectionAnchorId: id,
          }));
          return;
        }
      }

      set((s) => ({
        selectedMessageIds: s.selectedMessageIds.includes(id)
          ? s.selectedMessageIds.filter((mid) => mid !== id)
          : [...s.selectedMessageIds, id],
        selectionAnchorId: id,
      }));
    },

    selectToHere: (targetId, messages) => {
      const { selectionAnchorId } = get();
      const anchorId = targetId || selectionAnchorId || messages.at(-1)?.id;
      if (!anchorId) return;

      const anchorIndex = messages.findIndex((m) => m.id === anchorId);
      if (anchorIndex < 0) return;

      set({
        selectedMessageIds: messages.slice(0, anchorIndex + 1).map((m) => m.id),
        selectionAnchorId: anchorId,
      });
    },

    exitMultiSelect: () =>
      set({ multiSelectMode: false, selectedMessageIds: [], selectionAnchorId: undefined }),

    removeFromSelection: (ids) =>
      set((s) => ({
        selectedMessageIds: s.selectedMessageIds.filter((mid) => !ids.includes(mid)),
      })),

    removeFromCollapsed: (ids) =>
      set((s) => ({
        collapsedMessageIds: s.collapsedMessageIds.filter((mid) => !ids.includes(mid)),
      })),

    loadModels: async () => {
      try {
        const response = await fetch("/api/models", { cache: "no-store" });
        if (response.status === 401) {
          const callbackUrl = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
          throw new Error("请先登录");
        }
        if (!response.ok) throw new Error("加载模型列表失败");
        const data = await response.json();
        const models: ConfiguredModel[] = Array.isArray(data.models) ? data.models : [];
        const providerNames: Record<string, string> =
          data.providerNames && typeof data.providerNames === "object" ? data.providerNames : {};
        const currentModelKey = get().selectedModelKey;
        const savedModelKey =
          data.selectedModel?.id && data.selectedModel?.provider
            ? getModelKey(data.selectedModel)
            : "";
        let localModelKey = "";
        try {
          localModelKey = window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY) || "";
        } catch {
          // Storage can be unavailable in private or restricted browser contexts.
        }
        const isAvailable = (key: string) =>
          Boolean(key && models.some((model) => getModelKey(model) === key));
        const selectedModelKey =
          [currentModelKey, savedModelKey, localModelKey].find(isAvailable) ||
          (models[0] ? getModelKey(models[0]) : "");
        set({
          availableModels: models,
          providerNames,
          selectedModelKey,
          isLoadingModels: false,
        });
      } catch (error) {
        console.error("Model config error:", error);
        set({
          availableModels: [],
          providerNames: {},
          selectedModelKey: "",
          isLoadingModels: false,
        });
      }
    },

    setSelectedModelKey: (key) => {
      const model = get().availableModels.find((item) => getModelKey(item) === key);
      if (!model) return;

      set({ selectedModelKey: key });
      try {
        window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, key);
      } catch {
        // Database persistence remains the primary signed-in storage.
      }

      void fetch("/api/models", {
        body: JSON.stringify({ id: model.id, provider: model.provider }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      })
        .then((response) => {
          if (!response.ok) throw new Error("保存默认模型失败");
        })
        .catch((error) => {
          console.error("Model preference save error:", error);
        });
    },
    setWideChatMode: (wide) => set({ wideChatMode: wide }),
    setModelSearchKeyword: (keyword) => set({ modelSearchKeyword: keyword }),
    setWebSearchEnabled: (enabled) => set({ webSearchEnabled: enabled }),
    toggleWebSearch: () => set((s) => ({ webSearchEnabled: !s.webSearchEnabled })),
    setPluginCenterOpen: (open) => set({ pluginCenterOpen: open }),
  })),
);
