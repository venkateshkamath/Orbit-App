/**
 * In-app / push-backed notifications list
 */

import api from './client';
import { AppNotification } from '../types';

export const notificationsApi = {
  list: async (): Promise<{ results: AppNotification[]; unread_count: number }> => {
    const response = await api.get('/notifications/');
    return {
      results: response.data.results ?? [],
      unread_count: response.data.unread_count ?? 0,
    };
  },

  markRead: async (id: string): Promise<void> => {
    await api.patch(`/notifications/${id}/read/`);
  },

  markAllRead: async (): Promise<void> => {
    await api.post('/notifications/read-all/');
  },
};

export default notificationsApi;
