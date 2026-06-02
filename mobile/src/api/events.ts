import api, { API_BASE_URL, getStoredAccessToken } from './client';
import type { OrbitEvent, NearbyEventsResponse, LocationSearchResult } from '../types';

export type CatchupFeedFilter = 'near' | 'today' | 'week' | 'popular';

export type PaginatedCatchupsResponse = {
  count: number;
  results: OrbitEvent[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    has_more: boolean;
  };
};

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

export type ExistingCatchupPhoto = { url: string; public_id: string | null };
export type UpdateCatchupPayload = Partial<CreateCatchupPayload> & {
  existingPhotos?: ExistingCatchupPhoto[];
};

function appendPhoto(formData: FormData, field: string, photo: { uri: string; name: string; type: string }) {
  formData.append(field, {
    uri: photo.uri,
    name: photo.name,
    type: photo.type,
  } as unknown as Blob);
}

async function sendMultipart<T>(method: 'POST' | 'PUT', path: string, formData: FormData): Promise<T> {
  const token = await getStoredAccessToken();
  const url = `${API_BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    method,
    headers: token ? { Accept: 'application/json', Authorization: `Bearer ${token}` } : { Accept: 'application/json' },
    body: formData,
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw {
      response: {
        status: response.status,
        data,
      },
    };
  }

  return data as T;
}

export const eventsApi = {
  getNearby(lat: number, lng: number, radius = 5000): Promise<NearbyEventsResponse> {
    return api.get('/events/nearby/', { params: { lat, lng, radius } }).then((r) => r.data);
  },

  getFeed(params?: { filter?: CatchupFeedFilter; page?: number; limit?: number; start?: string; end?: string }): Promise<PaginatedCatchupsResponse> {
    return api.get('/events/feed/', { params }).then((r) => r.data);
  },

  create(formData: FormData): Promise<OrbitEvent> {
    return sendMultipart<OrbitEvent>('POST', '/events/', formData);
  },

  getOne(id: string): Promise<OrbitEvent> {
    return api
      .get(`/catchups/${id}`)
      .then((r) => r.data)
      .catch((error) => {
        if (error?.response?.status === 404) return api.get(`/events/${id}/`).then((r) => r.data);
        throw error;
      });
  },

  join(id: string): Promise<{ event: OrbitEvent; conversation_id: string }> {
    return api.post(`/events/${id}/join/`).then((r) => r.data);
  },

  joinCatchup(id: string): Promise<{ event: OrbitEvent; conversation_id: string }> {
    return api.post(`/catchups/${id}/join`).then((r) => r.data);
  },

  leaveCatchup(id: string): Promise<{ event: OrbitEvent; conversation_id: string | null }> {
    return api.delete(`/catchups/${id}/join`).then((r) => r.data);
  },

  remove(id: string): Promise<void> {
    return api.delete(`/events/${id}/`).then(() => undefined);
  },

  deleteCatchup(id: string): Promise<{ deleted: true }> {
    return api.delete(`/catchups/${id}`).then((r) => r.data);
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
        appendPhoto(formData, 'image', payload.photos[0]);
      }
      return sendMultipart<OrbitEvent>('POST', '/events/', formData).then((event) => ({
        id: event.id,
        status: 'live' as const,
        createdAt: event.created_at,
        event,
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
    payload.photos.forEach((photo) => appendPhoto(formData, 'photos', photo));
    return sendMultipart<{ id: string; status: 'live'; createdAt: string; event: OrbitEvent }>('POST', '/catchups', formData)
      .catch((error) => {
        if (error?.response?.status === 404) return fallbackToLegacyEvent();
        throw error;
      });
  },

  updateCatchup(id: string, payload: UpdateCatchupPayload): Promise<{ id: string; status: 'live' | 'cancelled'; updatedAt: string; event: OrbitEvent }> {
    const hasPhotos = Array.isArray(payload.photos) && payload.photos.length > 0;
    if (!hasPhotos) {
      return api.put(`/catchups/${id}`, {
        name: payload.name,
        location: payload.location,
        dateTime: payload.dateTime,
        joinMode: payload.joinMode,
        maxPeople: payload.maxPeople,
        categoryId: payload.categoryId,
        customCategory: payload.customCategory,
        description: payload.description,
        coverPhotoIndex: payload.coverPhotoIndex,
        existingPhotos: payload.existingPhotos,
      }).then((r) => r.data);
    }

    const formData = new FormData();
    if (payload.name != null) formData.append('name', payload.name);
    if (payload.location) formData.append('location', JSON.stringify(payload.location));
    if (payload.dateTime != null) formData.append('dateTime', payload.dateTime);
    if (payload.joinMode != null) formData.append('joinMode', payload.joinMode);
    if (payload.maxPeople != null) formData.append('maxPeople', String(payload.maxPeople));
    if (payload.categoryId != null) formData.append('categoryId', payload.categoryId);
    if (payload.customCategory != null) formData.append('customCategory', payload.customCategory);
    if (payload.description != null) formData.append('description', payload.description);
    if (payload.coverPhotoIndex != null) formData.append('coverPhotoIndex', String(payload.coverPhotoIndex));
    if (payload.existingPhotos != null) formData.append('existingPhotos', JSON.stringify(payload.existingPhotos));
    payload.photos?.forEach((photo) => appendPhoto(formData, 'photos', photo));
    return sendMultipart<{ id: string; status: 'live' | 'cancelled'; updatedAt: string; event: OrbitEvent }>('PUT', `/catchups/${id}`, formData);
  },
};
