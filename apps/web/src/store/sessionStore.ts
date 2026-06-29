// sessionStore — 会话列表状态管理
// 管理会话列表、当前会话 ID,对接后端 API
import { create } from 'zustand';
import { api } from '../lib/api';

export interface Conversation {
  id: string;
  title: string;
}

interface SessionState {
  conversations: Conversation[];
  currentSessionId: string | null;
  loadConversations: () => Promise<void>;
  newSession: (id: string, title: string) => void;
  deleteSession: (id: string) => Promise<void>;
  selectSession: (id: string) => void;
  setCurrentSessionId: (id: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  conversations: [],
  currentSessionId: null,

  loadConversations: async () => {
    try {
      const raw = await api.sessions.list();
      const items: Conversation[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      set({ conversations: items });
    } catch {
      /* ignore */
    }
  },

  newSession: (id, title) => {
    set((state) => ({
      conversations: [{ id, title }, ...state.conversations],
      currentSessionId: id,
    }));
  },

  deleteSession: async (id) => {
    try {
      await api.sessions.delete(id);
    } catch {
      /* ignore */
    }
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
    }));
  },

  selectSession: (id) => set({ currentSessionId: id }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
}));
