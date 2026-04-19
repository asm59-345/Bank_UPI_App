// ═══════════════════════════════════════════════════════
//  Toast Hook — Global Toast Notifications
// ═══════════════════════════════════════════════════════

import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2, 9);
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }));

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      set(state => ({
        toasts: state.toasts.filter(t => t.id !== id),
      }));
    }, 4000);
  },

  removeToast: (id: string) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }));
  },
}));
