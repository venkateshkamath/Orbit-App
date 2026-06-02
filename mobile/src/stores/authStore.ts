/**
 * Auth Store - Zustand state management for authentication
 * Uses platform-compatible storage (SecureStore on native, localStorage on web)
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import { User, AuthResponse } from '../types';
import { authApi } from '../api';
import { formatApiError } from '../utils/apiErrors';

const storage = {
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      const SecureStore = require('expo-secure-store');
      await SecureStore.setItemAsync(key, value);
    }
  },
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      const SecureStore = require('expo-secure-store');
      return await SecureStore.getItemAsync(key);
    }
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      const SecureStore = require('expo-secure-store');
      await SecureStore.deleteItemAsync(key);
    }
  },
};

async function persistSession(response: AuthResponse) {
  await storage.setItem('accessToken', response.tokens.access);
  await storage.setItem('refreshToken', response.tokens.refresh);
  return { user: response.user, isAuthenticated: true as const, isOnboardingComplete: true };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnboardingComplete: boolean;

  setUser: (user: User | null) => void;
  requestSignupOtp: (email: string, name: string, dateOfBirth: string) => Promise<{
    expires_in: number;
    debug_otp?: string;
  }>;
  verifySignupOtp: (email: string, code: string) => Promise<void>;
  requestLoginOtp: (email: string) => Promise<{ expires_in: number; debug_otp?: string }>;
  verifyLoginOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateProfile: (data: Partial<User> & { interest_ids?: string[] }) => Promise<void>;
  updateLocation: (latitude: number, longitude: number) => Promise<void>;
  setOnboardingComplete: (complete: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isOnboardingComplete: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  requestSignupOtp: async (email, name, dateOfBirth) => {
    try {
      return await authApi.requestOtp({
        email,
        purpose: 'signup',
        username: name.trim(),
        date_of_birth: dateOfBirth.trim(),
      });
    } catch (error: unknown) {
      throw new Error(formatApiError(error));
    }
  },

  verifySignupOtp: async (email, code) => {
    try {
      const response = await authApi.verifyOtp({ email, code, purpose: 'signup' });
      const next = await persistSession(response);
      set(next);
    } catch (error: unknown) {
      throw new Error(formatApiError(error));
    }
  },

  requestLoginOtp: async (email) => {
    try {
      return await authApi.requestOtp({ email, purpose: 'login' });
    } catch (error: unknown) {
      throw new Error(formatApiError(error));
    }
  },

  verifyLoginOtp: async (email, code) => {
    try {
      const response = await authApi.verifyOtp({ email, code, purpose: 'login' });
      const next = await persistSession(response);
      set(next);
    } catch (error: unknown) {
      throw new Error(formatApiError(error));
    }
  },

  logout: async () => {
    set({
      user: null,
      isAuthenticated: false,
      isOnboardingComplete: false,
      isLoading: false,
    });

    try {
      const refreshToken = await storage.getItem('refreshToken');
      await authApi.logout(refreshToken || undefined);
    } catch (error) {
      console.log('Logout API error (ignored):', error);
    } finally {
      await storage.removeItem('accessToken');
      await storage.removeItem('refreshToken');
    }
  },

  loadUser: async () => {
    try {
      const token = await storage.getItem('accessToken');

      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const user = await authApi.getProfile();
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        isOnboardingComplete: true,
      });
    } catch (error) {
      await storage.removeItem('accessToken');
      await storage.removeItem('refreshToken');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateProfile: async (data) => {
    try {
      const updatedUser = await authApi.updateProfile(data);
      set({ user: updatedUser });
    } catch (error: unknown) {
      throw new Error(formatApiError(error));
    }
  },

  updateLocation: async (latitude, longitude) => {
    try {
      const result = await authApi.updateLocation(latitude, longitude);
      const { user } = get();
      if (user) {
        set({
          user: {
            ...user,
            latitude,
            longitude,
            // Update city if the backend derived one (only set when previously empty)
            ...(result.city ? { city: result.city } : {}),
          },
        });
      }
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  },

  setOnboardingComplete: (complete) => set({ isOnboardingComplete: complete }),
}));

export default useAuthStore;
