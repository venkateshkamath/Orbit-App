/**
 * Auth API endpoints
 */

import api from './client';
import { AuthResponse, User, Interest } from '../types';

export const authApi = {
  register: async (data: {
    email: string;
    username: string;
    password: string;
    password_confirm: string;
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/register/', data);
    return response.data;
  },

  login: async (data: { email: string; password: string }): Promise<AuthResponse> => {
    const response = await api.post('/auth/login/', data);
    return response.data;
  },

  logout: async (refresh?: string): Promise<void> => {
    await api.post('/auth/logout/', { refresh });
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get('/users/me/');
    return response.data;
  },

  updateProfile: async (data: Partial<User> & { interest_ids?: string[] }): Promise<User> => {
    const response = await api.patch('/users/me/', data);
    return response.data;
  },

  updateLocation: async (latitude: number, longitude: number): Promise<void> => {
    await api.post('/users/me/location/', { latitude, longitude });
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },


  uploadAvatar: async (uri: string): Promise<User> => {
    const formData = new FormData();
    
    // Extract filename from URI
    const filename = uri.split('/').pop() || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    // Platform-specific file handling
    if (typeof window !== 'undefined' && uri.startsWith('blob:')) {
      // Web: Fetch the blob and append as File
      const response = await fetch(uri);
      const blob = await response.blob();
      formData.append('avatar', blob, filename);
    } else {
      // Mobile: Use URI object
      // @ts-ignore - React Native FormData accepts this format
      formData.append('avatar', {
        uri,
        name: filename,
        type,
      });
    }
    
    const response = await api.patch('/users/me/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },


  removeAvatar: async (): Promise<User> => {
    const response = await api.delete('/users/me/avatar/');
    return response.data;
  },

  getInterests: async (): Promise<Interest[]> => {
    const response = await api.get('/auth/interests/');
    // Handle paginated response
    if (response.data.results) {
      return response.data.results;
    }
    return response.data;
  },
};

export default authApi;
