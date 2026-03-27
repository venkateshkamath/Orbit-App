/** Stable query keys for TanStack Query */

export const orbitKeys = {
  feed: (interestId?: string) => ['orbit', 'feed', interestId ?? 'all'] as const,
  postComments: (postId: string) => ['orbit', 'posts', postId, 'comments'] as const,
  discoverNext: (radius: number, latKey: string | number, lngKey: string | number) =>
    ['orbit', 'discover', 'next', radius, latKey, lngKey] as const,
  discoverNearby: (radius: number, latKey: string | number, lngKey: string | number) =>
    ['orbit', 'discover', 'nearby', radius, latKey, lngKey] as const,
  matches: () => ['orbit', 'discover', 'matches'] as const,
  interests: () => ['orbit', 'auth', 'interests'] as const,
  conversations: () => ['orbit', 'chat', 'conversations'] as const,
  conversation: (id: string) => ['orbit', 'chat', 'conversation', id] as const,
  messages: (id: string) => ['orbit', 'chat', 'messages', id] as const,
};

export function locationKeyPart(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null) return { latKey: 'none' as const, lngKey: 'none' as const };
  return {
    latKey: Math.round(lat * 1e4),
    lngKey: Math.round(lng * 1e4),
  };
}
