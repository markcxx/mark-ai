import toast from 'react-hot-toast';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import type { ChatSession, ConfiguredModel, Message } from '@/lib/chat/types';

interface SessionState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoadingSessions: boolean;
  isLoadingActiveSession: boolean;
  loadingSessionIds: string[];
}

interface SessionActions {
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string, options?: { history?: 'push' | 'replace' | 'none' }) => Promise<Message[] | undefined>;
  createSession: (initialMessage: string, model?: ConfiguredModel) => Promise<ChatSession>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string) => Promise<void>;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
  updateSessionFavorite: (sessionId: string, favorite: boolean) => Promise<void>;
  persistSessionMessages: (sessionId: string, messages: Message[]) => Promise<ChatSession | undefined>;
  generateSessionTitle: (sessionId: string, messages: Message[]) => Promise<void>;
  upsertSession: (session: ChatSession) => void;
  setActiveSessionId: (id: string | null) => void;
  setSessionLoading: (sessionId: string, loading: boolean) => void;
  resetActiveSession: () => void;
}

export type SessionStore = SessionState & SessionActions;

const navigateToSession = (sessionId: string, history: 'push' | 'replace' = 'push') => {
  const path = `/${encodeURIComponent(sessionId)}`;
  if (history === 'replace') {
    window.history.replaceState(null, '', path);
  } else {
    window.history.pushState(null, '', path);
  }
};

const navigateToNewChat = (history: 'push' | 'replace' | 'none' = 'push') => {
  if (history === 'none') return;
  if (history === 'replace') {
    window.history.replaceState(null, '', '/');
  } else {
    window.history.pushState(null, '', '/');
  }
};

export const useSessionStore = create<SessionStore>()(
  subscribeWithSelector((set, get) => ({
    sessions: [],
    activeSessionId: null,
    isLoadingSessions: true,
    isLoadingActiveSession: false,
    loadingSessionIds: [],

    upsertSession: (session) =>
      set((s) => ({
        sessions: [session, ...s.sessions.filter((item) => item.id !== session.id)].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        ),
      })),

    setActiveSessionId: (id) => set({ activeSessionId: id }),

    setSessionLoading: (sessionId, loading) =>
      set((s) => ({
        loadingSessionIds: loading
          ? s.loadingSessionIds.includes(sessionId)
            ? s.loadingSessionIds
            : [...s.loadingSessionIds, sessionId]
          : s.loadingSessionIds.filter((id) => id !== sessionId),
      })),

    resetActiveSession: () => set({ activeSessionId: null, isLoadingActiveSession: false }),

    loadSessions: async () => {
      try {
        const response = await fetch('/api/sessions', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load sessions');

        const data = await response.json();
        const nextSessions: ChatSession[] = Array.isArray(data.sessions) ? data.sessions : [];
        set({ sessions: nextSessions });
      } catch (error) {
        console.error('Sessions list error:', error);
        toast.error('加载历史会话失败');
      } finally {
        set({ isLoadingSessions: false });
      }
    },

    loadSession: async (sessionId, options = {}) => {
      try {
        set({ isLoadingActiveSession: true });
        const response = await fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load session');

        const data = await response.json();
        const messages: Message[] = Array.isArray(data.messages) ? data.messages : [];

        set({ activeSessionId: data.session?.id || sessionId });
        if (options.history !== 'none') {
          navigateToSession(data.session?.id || sessionId, options.history || 'push');
        }
        if (data.session) get().upsertSession(data.session);

        return messages;
      } catch (error) {
        console.error('Session load error:', error);
        toast.error('加载会话失败');
        return undefined;
      } finally {
        set({ isLoadingActiveSession: false });
      }
    },

    createSession: async (initialMessage, model) => {
      const response = await fetch('/api/sessions', {
        body: JSON.stringify({
          initialMessage,
          model: model?.id,
          provider: model?.provider,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to create session');

      const data = await response.json();
      const session = data.session as ChatSession;
      get().upsertSession(session);
      set({ activeSessionId: session.id });
      navigateToSession(session.id);
      return session;
    },

    deleteSession: async (sessionId) => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete session');

        get().setSessionLoading(sessionId, false);
        set((s) => ({
          sessions: s.sessions.filter((session) => session.id !== sessionId),
        }));

        if (get().activeSessionId === sessionId) {
          const [{ useChatStore }, { useUIStore }] = await Promise.all([
            import('./useChatStore'),
            import('./useUIStore'),
          ]);

          useChatStore.getState().reset();
          useUIStore.getState().exitMultiSelect();
          useUIStore.getState().setOpenMenuMessageId(null);
          set({ activeSessionId: null, isLoadingActiveSession: false });
          navigateToNewChat('replace');
        }

        toast.success('会话已删除');
      } catch (error) {
        console.error('Session delete error:', error);
        toast.error('删除会话失败');
      }
    },

    renameSession: async (sessionId) => {
      const { sessions, upsertSession, setSessionLoading, activeSessionId } = get();
      const session = sessions.find((item) => item.id === sessionId);
      if (session) upsertSession({ ...session, title: '...' });
      setSessionLoading(sessionId, true);

      try {
        let sourceMessages: Message[] | undefined;

        if (activeSessionId === sessionId) {
          // Caller should provide messages from chat store
          const { useChatStore } = await import('./useChatStore');
          sourceMessages = useChatStore.getState().messages;
        }

        if (!sourceMessages) {
          const response = await fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' });
          if (!response.ok) throw new Error('Failed to load session for title');
          const data = await response.json();
          sourceMessages = Array.isArray(data.messages) ? data.messages : [];
        }

        if (!sourceMessages || sourceMessages.length === 0) {
          toast.error('没有可命名的消息');
          if (session) upsertSession(session);
          return;
        }

        await get().generateSessionTitle(sessionId, sourceMessages);
      } catch (error) {
        console.error('Session rename error:', error);
        toast.error('自动命名失败');
        if (session) upsertSession(session);
      } finally {
        setSessionLoading(sessionId, false);
      }
    },

    updateSessionTitle: async (sessionId, title) => {
      get().setSessionLoading(sessionId, true);
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          body: JSON.stringify({ title }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        });
        if (!response.ok) throw new Error('Failed to update session title');

        const data = await response.json();
        if (data.session) get().upsertSession(data.session);
        toast.success('会话已重命名');
      } catch (error) {
        console.error('Session title update error:', error);
        toast.error('重命名失败');
      } finally {
        get().setSessionLoading(sessionId, false);
      }
    },

    updateSessionFavorite: async (sessionId, favorite) => {
      get().setSessionLoading(sessionId, true);
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          body: JSON.stringify({ favorite }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        });
        if (!response.ok) throw new Error('Failed to update session favorite');

        const data = await response.json();
        if (data.session) get().upsertSession(data.session);
        toast.success(favorite ? '已收藏会话' : '已取消收藏');
      } catch (error) {
        console.error('Session favorite update error:', error);
        toast.error('收藏状态更新失败');
      } finally {
        get().setSessionLoading(sessionId, false);
      }
    },

    persistSessionMessages: async (sessionId, messages) => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/messages`, {
          body: JSON.stringify({ messages }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PUT',
        });

        if (!response.ok) {
          const errorPayload = await response.text();
          let message = errorPayload || 'Failed to save messages';
          try {
            const parsed = JSON.parse(errorPayload);
            message = parsed.detail || parsed.error || message;
          } catch {
            // Keep raw text
          }
          throw new Error(message);
        }

        const data = await response.json();
        if (data.session) get().upsertSession(data.session);
        return data.session as ChatSession | undefined;
      } catch (error) {
        console.error('Session save error:', error);
        toast.error(
          error instanceof Error ? `保存会话失败：${error.message}` : '保存会话失败',
        );
        return undefined;
      }
    },

    generateSessionTitle: async (sessionId, messages) => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/title`, {
          body: JSON.stringify({ messages }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });

        if (!response.ok) throw new Error('Failed to generate title');

        const data = await response.json();
        if (data.session) get().upsertSession(data.session);
      } catch (error) {
        console.error('Session title error:', error);
      }
    },
  })),
);

export { navigateToNewChat };
