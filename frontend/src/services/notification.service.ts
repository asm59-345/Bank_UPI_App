// ═══════════════════════════════════════════════════════
//  Notification Service
// ═══════════════════════════════════════════════════════

import api from '@/lib/api';
import type { Notification } from '@/types/transaction.types';

export const notificationService = {
  getNotifications: async (params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<{ notifications: Notification[]; total: number }> => {
    const response = await api.get('/notifications', { params });
    return response.data.data || response.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await api.get('/notifications/unread-count');
    return response.data.data?.unreadCount ?? 0;
  },

  markAsRead: async (notificationIds?: string[]): Promise<void> => {
    await api.put('/notifications/read', { notificationIds });
  },
};
