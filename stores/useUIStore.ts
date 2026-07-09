import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import type { ConfiguredModel, Message } from '@/lib/chat/types';
import { getModelKey } from '@/lib/chat/helpers';

interface UIState {
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
  isLoadingModels: boolean;
  selectedModelKey: string;
}

interface UIActions {
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
}

export type UIStore = UIState & UIActions;

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 380;

const clampSidebarWidth = (width: number) =>
  Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set, get) => ({
    isSidebarOpen: true,
    sidebarWidth: 260,
    isResizingSidebar: false,
    openMenuMessageId: null,
    collapsedMessageIds: [],
    multiSelectMode: false,
    selectedMessageIds: [],
    selectionAnchorId: undefined,
    wideChatMode: false,
    modelSearchKeyword: '',
    availableModels: [],
    isLoadingModels: true,
    selectedModelKey: '',

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
        const response = await fetch('/api/models', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load models');
        const data = await response.json();
        const models: ConfiguredModel[] = Array.isArray(data.models) ? data.models : [];
        set({
          availableModels: models,
          selectedModelKey: models[0] ? getModelKey(models[0]) : '',
          isLoadingModels: false,
        });
      } catch (error) {
        console.error('Model config error:', error);
        set({ availableModels: [], selectedModelKey: '', isLoadingModels: false });
      }
    },

    setSelectedModelKey: (key) => set({ selectedModelKey: key }),
    setWideChatMode: (wide) => set({ wideChatMode: wide }),
    setModelSearchKeyword: (keyword) => set({ modelSearchKeyword: keyword }),
  })),
);
