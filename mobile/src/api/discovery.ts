/**
 * Discovery API endpoints
 */

import api from './client';
import { NearbyResponse, LikeResponse, Match, NearbyUser } from '../types';

export const discoveryApi = {
  getNearbyUsers: async (radius?: number): Promise<NearbyResponse> => {
    const params = radius ? { radius } : {};
    const response = await api.get('/discover/nearby/', { params });
    return response.data;
  },

  getNextUser: async (radius?: number): Promise<{ user: NearbyUser | null; radius: number }> => {
    const params = radius ? { radius } : {};
    const response = await api.get('/discover/next/', { params });
    return response.data;
  },

  likeUser: async (userId: string): Promise<LikeResponse> => {
    const response = await api.post(`/discover/like/${userId}/`);
    return response.data;
  },

  passUser: async (userId: string): Promise<void> => {
    await api.post(`/discover/pass/${userId}/`);
  },

  getMatches: async (): Promise<{ results: Match[] }> => {
    const response = await api.get('/discover/matches/');
    return response.data;
  },

  unmatch: async (matchId: string): Promise<void> => {
    await api.delete(`/discover/matches/${matchId}/`);
  },

  getLikesReceived: async (): Promise<any> => {
    const response = await api.get('/discover/likes-received/');
    return response.data;
  },
};

export default discoveryApi;
