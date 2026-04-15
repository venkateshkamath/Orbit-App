/**
 * Auth API endpoints (email OTP)
 */

import api from './client';
import { AuthResponse, User, Interest, PublicProfileResponse, SearchUserResult } from '../types';

export interface OtpSendResponse {
  message: string;
  expires_in: number;
  debug_otp?: string;
}

export const authApi = {
  requestOtp: async (data: {
    email: string;
    purpose: 'signup' | 'login';
    username?: string;
    date_of_birth?: string;
  }): Promise<OtpSendResponse> => {
    const response = await api.post('/auth/otp/send/', data);
    return response.data;
  },

  verifyOtp: async (data: {
    email: string;
    code: string;
    purpose: 'signup' | 'login';
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/otp/verify/', data);
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

  registerExpoPushToken: async (token: string): Promise<void> => {
    await api.post('/users/me/expo-push-token/', { token });
  },

  updatePresence: async (isOnline: boolean): Promise<void> => {
    await api.post('/users/me/presence/', { is_online: isOnline });
  },

  getPublicProfile: async (userId: string): Promise<PublicProfileResponse> => {
    const response = await api.get(`/users/${userId}/profile/`);
    return response.data;
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },

  uploadAvatar: async (uri: string): Promise<User> => {
    const formData = new FormData();

    const filename = uri.split('/').pop() || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    if (typeof window !== 'undefined' && uri.startsWith('blob:')) {
      const response = await fetch(uri);
      const blob = await response.blob();
      formData.append('avatar', blob, filename);
    } else {
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
    if (response.data.results) {
      return response.data.results;
    }
    return response.data;
  },

  searchUsers: async (q: string): Promise<SearchUserResult[]> => {
    const response = await api.get('/users/search', { params: { q } });
    return response.data.results ?? [];
  },
};

export default authApi;
