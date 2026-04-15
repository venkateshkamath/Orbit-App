/**
 * API Configuration
 * Platform-compatible storage (SecureStore on native, localStorage on web)
 */

import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Metro / Expo exposes the machine LAN IP in a few places; physical devices need it (not 127.0.0.1).
 */
function resolveLocalIp(): string {
  const tryHost = (raw: string | undefined) => {
    if (!raw) return null;
    const host = raw.split(':')[0]?.trim();
    if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
    return null;
  };

  const fromHostUri = tryHost(Constants.expoConfig?.hostUri);
  if (fromHostUri) return fromHostUri;

  const manifest = Constants.manifest as Record<string, unknown> | null;
  const debuggerHost =
    (manifest?.debuggerHost as string) ||
    (Constants.manifest2 as { extra?: { expoClient?: { debuggerHost?: string } } } | null)?.extra?.expoClient
      ?.debuggerHost;

  const fromDebugger = tryHost(debuggerHost);
  if (fromDebugger) return fromDebugger;

  return '127.0.0.1';
}

// Fallback to the active Expo host IP for native development.
const LOCAL_IP = resolveLocalIp();
const PROD_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim();
const PROD_WS_URL = process.env.EXPO_PUBLIC_WS_URL?.trim();

/**
 * WebSocket must hit the same host:port as the REST API. If only EXPO_PUBLIC_API_URL is set
 * (common on physical devices), derive ws:// or wss:// from it instead of using Metro's IP
 * (which often mismatches and breaks realtime chat).
 */
function deriveWsBaseUrl(): string {
  if (PROD_WS_URL) {
    return PROD_WS_URL.replace(/\/$/, '');
  }
  if (PROD_API_URL) {
    try {
      const u = new URL(PROD_API_URL);
      const wsScheme = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsScheme}//${u.host}/ws`;
    } catch {
      /* fall through */
    }
  }
  if (Platform.OS === 'web') {
    return 'ws://localhost:8000/ws';
  }
  return `ws://${LOCAL_IP}:8000/ws`;
}

// API URLs
export const API_BASE_URL =
  PROD_API_URL ||
  (Platform.OS === 'web' ? 'http://localhost:8000/api' : `http://${LOCAL_IP}:8000/api`);

export const WS_BASE_URL = deriveWsBaseUrl();

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
  timeout: 60000, // 60s — image uploads to Cloudinary need more than 10s
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

/** Access token for WebSocket auth (same store as axios interceptor). */
export async function getStoredAccessToken(): Promise<string | null> {
  try {
    return await storage.getItem('accessToken');
  } catch {
    return null;
  }
}

export default api;
