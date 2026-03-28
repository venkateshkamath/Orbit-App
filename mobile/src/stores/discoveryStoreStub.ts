/**
 * Stub for removed discovery Zustand store. If this runs, Metro is likely serving a stale bundle.
 * Run: npx expo start -c
 */
import { useCallback } from 'react';

export function useDiscoveryStore() {
  if (__DEV__) {
    console.warn(
      '[ORBIT] useDiscoveryStore was removed. Clear cache: npx expo start -c. Use src/hooks/useOrbitApi instead.'
    );
  }

  return {
    nearbyUsers: [] as never[],
    matches: [] as never[],
    isLoading: false,
    currentRadius: 10,
    error: null as string | null,
    fetchNearbyUsers: useCallback(async () => {}, []),
    getNextUser: useCallback(async () => null, []),
    fetchMatches: useCallback(async () => {}, []),
    likeUser: useCallback(
      async () => ({ is_match: false, message: '', match: null as null }),
      []
    ),
    passUser: useCallback(async () => {}, []),
    unmatch: useCallback(async () => {}, []),
    setRadius: useCallback((_r: number) => {}, []),
    clearError: useCallback(() => {}, []),
  };
}
