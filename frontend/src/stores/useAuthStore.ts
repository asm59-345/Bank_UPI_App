// ═══════════════════════════════════════════════════════
//  Auth Store — Zustand
// ═══════════════════════════════════════════════════════

import { create } from 'zustand';
import type { User } from '@/types/auth.types';
import { authService } from '@/services/auth.service';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const data = await authService.login({ email, password });
      localStorage.setItem('payflow_token', data.token);
      localStorage.setItem('payflow_user', JSON.stringify(data.user));
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (name: string, email: string, password: string) => {
    set({ isLoading: true });
    try {
      const data = await authService.register({ name, email, password });
      localStorage.setItem('payflow_token', data.token);
      localStorage.setItem('payflow_user', JSON.stringify(data.user));
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // Continue logout even if API fails
    } finally {
      localStorage.removeItem('payflow_token');
      localStorage.removeItem('payflow_user');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
    }
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('payflow_token');
    const userStr = localStorage.getItem('payflow_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ user, token, isAuthenticated: true });
      } catch {
        localStorage.removeItem('payflow_token');
        localStorage.removeItem('payflow_user');
      }
    }
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
