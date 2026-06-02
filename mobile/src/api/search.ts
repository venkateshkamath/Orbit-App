import api from './client';
import type { LocationSearchResult, OrbitEvent, Post, PublicUser } from '../types';

export type OrbitSearchType = 'all' | 'catchups' | 'posts' | 'people' | 'places';

export type OrbitSearchResponse = {
  catchups: OrbitEvent[];
  posts: Post[];
  people: Array<PublicUser & { city?: string }>;
  places: Array<LocationSearchResult & { id?: string }>;
};

export type OrbitSearchOptions = {
  limit?: number;
  signal?: AbortSignal;
};

export const searchApi = {
  search(query: string, type: OrbitSearchType = 'all', options: OrbitSearchOptions = {}): Promise<OrbitSearchResponse> {
    return api
      .get('/search', {
        params: { q: query, type, limit: options.limit },
        signal: options.signal,
      })
      .then((r) => ({
        catchups: r.data.catchups ?? [],
        posts: r.data.posts ?? [],
        people: r.data.people ?? [],
        places: r.data.places ?? [],
      }));
  },
};
