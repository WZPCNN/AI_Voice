// authStore — 认证状态管理
// 管理 JWT token、当前用户信息、登录/登出逻辑
// token 持久化到 localStorage,页面刷新后自动恢复
import { create } from 'zustand';
import { api } from '../lib/api';
import type { User } from '@ai-voice/shared';

const TOKEN_KEY = 'auth_token';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  loadMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  isAuthenticated: false, // 初始不认证，需要验证 token
  isLoading: !!localStorage.getItem(TOKEN_KEY), // 有 token 时需要验证

  login: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },

  loadMe: async () => {
    try {
      const user = await api.auth.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      localStorage.removeItem(TOKEN_KEY);
    }
  },
}));
