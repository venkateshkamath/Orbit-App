/**
 * Auth Store - Zustand state management for authentication
 * Uses platform-compatible storage (SecureStore on native, localStorage on web)
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import { User, AuthTokens } from '../types';
import { authApi } from '../api';

// Platform-compatible storage wrapper
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

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnboardingComplete: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
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

  login: async (email, password) => {
    try {
      const response = await authApi.login({ email, password });
      
      // Store tokens
      await storage.setItem('accessToken', response.tokens.access);
      await storage.setItem('refreshToken', response.tokens.refresh);
      
      set({
        user: response.user,
        isAuthenticated: true,
        isOnboardingComplete: response.user.interests.length > 0,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },

  register: async (email, username, password) => {
    try {
      const response = await authApi.register({
        email,
        username,
        password,
        password_confirm: password,
      });
      
      // Store tokens
      await storage.setItem('accessToken', response.tokens.access);
      await storage.setItem('refreshToken', response.tokens.refresh);
      
      set({
        user: response.user,
        isAuthenticated: true,
        isOnboardingComplete: false, // New users need to complete onboarding
      });
    } catch (error: any) {
      const errorData = error.response?.data;
      const message = errorData?.email?.[0] || 
                      errorData?.username?.[0] || 
                      errorData?.password?.[0] ||
                      'Registration failed';
      throw new Error(message);
    }
  },

  logout: async () => {
    // Clear state IMMEDIATELY and SYNCHRONOUSLY before any async operations
    set({ 
      user: null, 
      isAuthenticated: false,
      isOnboardingComplete: false,
      isLoading: false
    });
    
    // Then handle cleanup asynchronously
    try {
      const refreshToken = await storage.getItem('refreshToken');
      await authApi.logout(refreshToken || undefined);
    } catch (error) {
      // Ignore logout errors
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
        isOnboardingComplete: user.interests.length > 0,
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
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Update failed');
    }
  },

  updateLocation: async (latitude, longitude) => {
    try {
      await authApi.updateLocation(latitude, longitude);
      const { user } = get();
      if (user) {
        set({
          user: { ...user, latitude, longitude },
        });
      }
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  },

  setOnboardingComplete: (complete) => set({ isOnboardingComplete: complete }),
}));

export default useAuthStore;
