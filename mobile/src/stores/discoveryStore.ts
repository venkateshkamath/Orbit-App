/**
 * Discovery Store - State management for nearby users and matching
 */

import { create } from 'zustand';
import { NearbyUser, Match } from '../types';
import { discoveryApi } from '../api';

interface DiscoveryState {
  nearbyUsers: NearbyUser[];
  matches: Match[];
  isLoading: boolean;
  currentRadius: number;
  error: string | null;
  
  // Actions
  fetchNearbyUsers: (radius?: number) => Promise<void>;
  fetchMatches: () => Promise<void>;
  likeUser: (userId: string) => Promise<{ isMatch: boolean; match?: Match }>;
  passUser: (userId: string) => Promise<void>;
  unmatch: (matchId: string) => Promise<void>;
  setRadius: (radius: number) => void;
  clearError: () => void;
}

export const useDiscoveryStore = create<DiscoveryState>((set, get) => ({
  nearbyUsers: [],
  matches: [],
  isLoading: false,
  currentRadius: 10,
  error: null,

  fetchNearbyUsers: async (radius) => {
    set({ isLoading: true, error: null });
    try {
      const response = await discoveryApi.getNearbyUsers(radius || get().currentRadius);
      set({
        nearbyUsers: response.users,
        currentRadius: response.radius,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch nearby users',
        isLoading: false,
      });
    }
  },

  fetchMatches: async () => {
    try {
      const response = await discoveryApi.getMatches();
      set({ matches: response.results || [] });
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    }
  },

  likeUser: async (userId) => {
    try {
      const response = await discoveryApi.likeUser(userId);
      
      // Remove user from nearby list
      set((state) => ({
        nearbyUsers: state.nearbyUsers.filter((u) => u.id !== userId),
      }));
      
      if (response.is_match && response.match) {
        // Add to matches
        set((state) => ({
          matches: [response.match!, ...state.matches],
        }));
        return { isMatch: true, match: response.match };
      }
      
      return { isMatch: false };
    } catch (error) {
      console.error('Failed to like user:', error);
      return { isMatch: false };
    }
  },

  passUser: async (userId) => {
    try {
      await discoveryApi.passUser(userId);
      set((state) => ({
        nearbyUsers: state.nearbyUsers.filter((u) => u.id !== userId),
      }));
    } catch (error) {
      console.error('Failed to pass user:', error);
    }
  },

  unmatch: async (matchId) => {
    try {
      await discoveryApi.unmatch(matchId);
      set((state) => ({
        matches: state.matches.filter((m) => m.id !== matchId),
      }));
    } catch (error) {
      console.error('Failed to unmatch:', error);
    }
  },

  setRadius: (radius) => set({ currentRadius: radius }),
  clearError: () => set({ error: null }),
}));

export default useDiscoveryStore;
