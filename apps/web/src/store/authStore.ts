// authStore — 认证状态管理
// 管理 JWT token、当前用户信息、登录/登出逻辑
// token 持久化到 localStorage,页面刷新后自动恢复
import { create } from 'zustand';
import { api } from '../lib/api';
import type { User } from '@agent-platform/shared';

const TOKEN_KEY = 'auth_token';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  loadMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),

  login: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadMe: async () => {
    try {
      const user = await api.auth.me();
      set({ user });
    } catch {
      set({ token: null, user: null, isAuthenticated: false });
      localStorage.removeItem(TOKEN_KEY);
    }
  },
}));
