/**
 * Connections API — send / respond to connection requests
 */

import api from './client';

export const connectionsApi = {
  sendRequest: async (targetUserId: string): Promise<{ message: string }> => {
    const res = await api.post(`/connections/request/${targetUserId}`);
    return res.data;
  },
};
