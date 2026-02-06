/**
 * API Configuration
 * Platform-compatible storage (SecureStore on native, localStorage on web)
 */

import axios from 'axios';
import { Platform } from 'react-native';

// Fallback to local IP if no environment variable is provided
const LOCAL_IP = '192.168.31.5';
const PROD_API_URL = process.env.EXPO_PUBLIC_API_URL;
const PROD_WS_URL = process.env.EXPO_PUBLIC_WS_URL;

// API URLs
export const API_BASE_URL = PROD_API_URL || (Platform.OS === 'web' 
  ? 'http://localhost:8000/api' 
  : `http://${LOCAL_IP}:8000/api`);
  
export const WS_BASE_URL = PROD_WS_URL || (Platform.OS === 'web' 
  ? 'ws://localhost:8000/ws' 
  : `ws://${LOCAL_IP}:8000/ws`);

// Platform-compatible storage wrapper
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      const SecureStore = require('expo-secure-store');
      return await SecureStore.getItemAsync(key);
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      const SecureStore = require('expo-secure-store');
      await SecureStore.setItemAsync(key, value);
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

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await storage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('Error getting token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await storage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
            refresh: refreshToken,
          });
          
          const { access } = response.data;
          await storage.setItem('accessToken', access);
          
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Clear tokens and redirect to login
        await storage.removeItem('accessToken');
        await storage.removeItem('refreshToken');
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
