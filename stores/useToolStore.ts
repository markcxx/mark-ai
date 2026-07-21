import { create } from "zustand";

import type { BuiltinToolCatalogItem } from "@/lib/tools/types";

type ToolStore = {
  activeSessionId: string | null;
  catalog: BuiltinToolCatalogItem[];
  draftEnabledToolIds: string[];
  enabledToolIds: string[];
  isCatalogLoading: boolean;
  isSessionToolsLoading: boolean;
  installTool: (toolId: string) => Promise<void>;
  loadCatalog: (force?: boolean) => Promise<void>;
  persistDraftToSession: (sessionId: string) => Promise<void>;
  resetForNewChat: () => void;
  setActiveSession: (sessionId: string | null) => Promise<void>;
  toggleTool: (toolId: string) => Promise<void>;
  uninstallTool: (toolId: string) => Promise<void>;
};

let catalogPromise: Promise<void> | null = null;
let sessionRequestId = 0;

const putSessionTools = async (sessionId: string, toolIds: string[]) => {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/tools`, {
    body: JSON.stringify({ toolIds }),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
  if (!response.ok) throw new Error("更新会话工具失败");
  const data = await response.json();
  return Array.isArray(data.toolIds) ? (data.toolIds as string[]) : toolIds;
};

export const useToolStore = create<ToolStore>((set, get) => ({
  activeSessionId: null,
  catalog: [],
  draftEnabledToolIds: [],
  enabledToolIds: [],
  isCatalogLoading: false,
  isSessionToolsLoading: false,

  loadCatalog: async (force = false) => {
    if (catalogPromise && !force) return catalogPromise;
    set({ isCatalogLoading: true });
    catalogPromise = (async () => {
      try {
        const response = await fetch("/api/tools", { cache: "no-store" });
        if (!response.ok) throw new Error("加载工具失败");
        const data = await response.json();
        set({ catalog: Array.isArray(data.tools) ? data.tools : [] });
      } finally {
        set({ isCatalogLoading: false });
        catalogPromise = null;
      }
    })();
    return catalogPromise;
  },

  installTool: async (toolId) => {
    const response = await fetch(`/api/tools/${encodeURIComponent(toolId)}`, { method: "POST" });
    if (!response.ok) throw new Error("安装工具失败");
    set((state) => ({
      catalog: state.catalog.map((tool) =>
        tool.id === toolId ? { ...tool, installed: true } : tool,
      ),
    }));
  },

  uninstallTool: async (toolId) => {
    const response = await fetch(`/api/tools/${encodeURIComponent(toolId)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("卸载工具失败");
    set((state) => ({
      catalog: state.catalog.map((tool) =>
        tool.id === toolId ? { ...tool, installed: false } : tool,
      ),
      draftEnabledToolIds: state.draftEnabledToolIds.filter((id) => id !== toolId),
      enabledToolIds: state.enabledToolIds.filter((id) => id !== toolId),
    }));
  },

  setActiveSession: async (sessionId) => {
    const requestId = ++sessionRequestId;
    if (!sessionId) {
      set((state) => ({
        activeSessionId: null,
        enabledToolIds: state.draftEnabledToolIds,
        isSessionToolsLoading: false,
      }));
      return;
    }

    set({ activeSessionId: sessionId, enabledToolIds: [], isSessionToolsLoading: true });
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/tools`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("加载会话工具失败");
      const data = await response.json();
      if (requestId !== sessionRequestId) return;
      set({ enabledToolIds: Array.isArray(data.toolIds) ? data.toolIds : [] });
    } finally {
      if (requestId === sessionRequestId) set({ isSessionToolsLoading: false });
    }
  },

  toggleTool: async (toolId) => {
    const state = get();
    const tool = state.catalog.find((item) => item.id === toolId);
    if (!tool?.installed || tool.status !== "available") return;

    const previous = state.enabledToolIds;
    const next = previous.includes(toolId)
      ? previous.filter((id) => id !== toolId)
      : [...previous, toolId];
    set({ enabledToolIds: next });

    if (!state.activeSessionId) {
      set({ draftEnabledToolIds: next });
      return;
    }

    try {
      const saved = await putSessionTools(state.activeSessionId, next);
      if (get().activeSessionId === state.activeSessionId) set({ enabledToolIds: saved });
    } catch (error) {
      if (get().activeSessionId === state.activeSessionId) set({ enabledToolIds: previous });
      throw error;
    }
  },

  persistDraftToSession: async (sessionId) => {
    const draft = get().draftEnabledToolIds;
    const saved = await putSessionTools(sessionId, draft);
    sessionRequestId += 1;
    set({
      activeSessionId: sessionId,
      draftEnabledToolIds: [],
      enabledToolIds: saved,
      isSessionToolsLoading: false,
    });
  },

  resetForNewChat: () => {
    sessionRequestId += 1;
    set({
      activeSessionId: null,
      draftEnabledToolIds: [],
      enabledToolIds: [],
      isSessionToolsLoading: false,
    });
  },
}));
