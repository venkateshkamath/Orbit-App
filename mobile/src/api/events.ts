import api from './client';
import type { OrbitEvent, NearbyEventsResponse, LocationSearchResult } from '../types';

export const eventsApi = {
  getNearby(lat: number, lng: number, radius = 5000): Promise<NearbyEventsResponse> {
    return api.get('/events/nearby/', { params: { lat, lng, radius } }).then((r) => r.data);
  },

  getFeed(): Promise<{ count: number; results: OrbitEvent[] }> {
    return api.get('/events/feed/').then((r) => r.data);
  },

  create(formData: FormData): Promise<OrbitEvent> {
    return api
      .post('/events/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },

  getOne(id: string): Promise<OrbitEvent> {
    return api.get(`/events/${id}/`).then((r) => r.data);
  },

  join(id: string): Promise<{ event: OrbitEvent; conversation_id: string }> {
    return api.post(`/events/${id}/join/`).then((r) => r.data);
  },

  remove(id: string): Promise<void> {
    return api.delete(`/events/${id}/`).then(() => undefined);
  },

  searchLocation(query: string): Promise<LocationSearchResult[]> {
    return api
      .get('/events/location-search/', { params: { q: query } })
      .then((r) => r.data);
  },
};
