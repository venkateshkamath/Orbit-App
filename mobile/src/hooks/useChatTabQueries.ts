/**
 * Tab bar badge queries — kept separate from useOrbitApi to avoid circular imports
 * with expo-router tab layout during initial bundle evaluation.
 */

import { useQuery } from '@tanstack/react-query';
import { discoveryApi } from '../api/discovery';
import { notificationsApi } from '../api/notifications';
import { orbitKeys } from './orbitKeys';

export function useLikesReceivedForTab() {
  return useQuery({
    queryKey: orbitKeys.likesReceived(),
    queryFn: async () => {
      const res = await discoveryApi.getLikesReceived();
      return res.results ?? [];
    },
    staleTime: 20 * 1000,
  });
}

export function useNotificationsForTab() {
  return useQuery({
    queryKey: orbitKeys.notifications(),
    queryFn: () => notificationsApi.list(),
    staleTime: 20 * 1000,
  });
}
