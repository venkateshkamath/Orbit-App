import api from './client';
import type { OrbitEvent, NearbyEventsResponse, LocationSearchResult } from '../types';

export type EventCategoryOption = {
  id: string;
  name: string;
  icon?: string;
};

export type CatchupLocation = {
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  source: 'search' | 'gmaps' | 'manual';
};

export type CreateCatchupPayload = {
  name: string;
  location: CatchupLocation;
  dateTime: string;
  joinMode: 'open' | 'approval';
  maxPeople: number;
  categoryId: string | null;
  customCategory: string | null;
  description: string | null;
  photos: { uri: string; name: string; type: string }[];
  coverPhotoIndex: number;
};

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
      .get('/locations/search', { params: { q: query } })
      .then((r) => r.data)
      .catch(() => api.get('/events/location-search/', { params: { q: query } }).then((r) => r.data));
  },

  parseGoogleMaps(url: string): Promise<CatchupLocation> {
    return api.post('/locations/parse-gmaps', { url }).then((r) => ({
      ...r.data,
      source: 'gmaps',
    }));
  },

  getCategories(): Promise<EventCategoryOption[]> {
    return api.get('/categories').then((r) => r.data);
  },

  createCatchup(payload: CreateCatchupPayload): Promise<{ id: string; status: 'live'; createdAt: string; event: OrbitEvent }> {
    const fallbackToLegacyEvent = () => {
      const formData = new FormData();
      formData.append('title', payload.name);
      formData.append('description', payload.description || 'Catchup');
      formData.append('category', payload.categoryId || 'social');
      formData.append('start_at', payload.dateTime);
      formData.append('latitude', String(payload.location.lat));
      formData.append('longitude', String(payload.location.lng));
      formData.append('location_name', payload.location.name || payload.location.address);
      if (payload.photos[0]) {
        formData.append('image', payload.photos[0] as unknown as Blob);
      }
      return api.post('/events/', formData).then((r) => ({
        id: r.data.id,
        status: 'live' as const,
        createdAt: r.data.created_at,
        event: r.data,
      }));
    };

    if (payload.photos.length === 0) {
      return api
        .post('/catchups', {
          name: payload.name,
          location: payload.location,
          dateTime: payload.dateTime,
          joinMode: payload.joinMode,
          maxPeople: payload.maxPeople,
          categoryId: payload.categoryId,
          customCategory: payload.customCategory,
          description: payload.description,
          coverPhotoIndex: payload.coverPhotoIndex,
        })
        .then((r) => r.data)
        .catch((error) => {
          if (error?.response?.status === 404) return fallbackToLegacyEvent();
          throw error;
        });
    }

    const formData = new FormData();
    formData.append('name', payload.name);
    formData.append('location', JSON.stringify(payload.location));
    formData.append('dateTime', payload.dateTime);
    formData.append('joinMode', payload.joinMode);
    formData.append('maxPeople', String(payload.maxPeople));
    if (payload.categoryId) formData.append('categoryId', payload.categoryId);
    if (payload.customCategory) formData.append('customCategory', payload.customCategory);
    if (payload.description) formData.append('description', payload.description);
    formData.append('coverPhotoIndex', String(payload.coverPhotoIndex));
    payload.photos.forEach((photo) => {
      formData.append('photos', photo as unknown as Blob);
    });
    return api
      .post('/catchups', formData)
      .then((r) => r.data)
      .catch((error) => {
        if (error?.response?.status === 404) return fallbackToLegacyEvent();
        throw error;
      });
  },
};
