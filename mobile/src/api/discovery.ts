/**
 * Discovery API endpoints
 */

import api from './client';
import {
  NearbyResponse,
  LikeResponse,
  Match,
  NearbyUser,
  LikeReceivedItem,
  PublicUser,
} from '../types';

/** Legacy `to_user_detail` + bad rows from cache — normalize for UI. */
function normalizeLikesReceivedResults(raw: unknown): LikeReceivedItem[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: LikeReceivedItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const fromRaw = row.from_user ?? row.to_user_detail;
    if (!fromRaw || typeof fromRaw !== 'object') continue;
    const from = fromRaw as Record<string, unknown>;
    if (typeof from.id !== 'string') continue;
    const id = row.id != null ? String(row.id) : '';
    if (!id) continue;
    out.push({
      id,
      from_user: from as unknown as PublicUser,
      created_at: typeof row.created_at === 'string' ? row.created_at : '',
    });
  }
  return out;
}

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

  getLikesReceived: async (): Promise<{ results: LikeReceivedItem[] }> => {
    const response = await api.get('/discover/likes-received/');
    return {
      results: normalizeLikesReceivedResults(response.data?.results),
    };
  },
};

export default discoveryApi;
