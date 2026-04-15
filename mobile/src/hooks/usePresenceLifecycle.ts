import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { authApi } from '../api/auth';
import { useAuthStore } from '../stores';

const OFFLINE_GRACE_MS = 60_000;

export function usePresenceLifecycle(enabled: boolean) {
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastSentRef = useRef<boolean | null>(null);

  const clearOfflineTimer = useCallback(() => {
    if (!offlineTimerRef.current) return;
    clearTimeout(offlineTimerRef.current);
    offlineTimerRef.current = null;
  }, []);

  const pushPresence = useCallback(async (isOnline: boolean) => {
    if (!enabled || lastSentRef.current === isOnline) return;
    try {
      await authApi.updatePresence(isOnline);
      lastSentRef.current = isOnline;
      const { user, setUser } = useAuthStore.getState();
      if (user) {
        setUser({
          ...user,
          is_online: isOnline,
          last_seen: isOnline ? user.last_seen : new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('[presence] update failed:', e);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      clearOfflineTimer();
      lastSentRef.current = null;
      return;
    }

    void pushPresence(true);

    const onChange = (nextState: AppStateStatus) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = nextState;
      const isActive = nextState === 'active';

      if (isActive) {
        clearOfflineTimer();
        void pushPresence(true);
        return;
      }

      if (!wasActive) return;
      clearOfflineTimer();
      offlineTimerRef.current = setTimeout(() => {
        if (appStateRef.current !== 'active') {
          void pushPresence(false);
        }
      }, OFFLINE_GRACE_MS);
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => {
      sub.remove();
      clearOfflineTimer();
    };
  }, [clearOfflineTimer, enabled, pushPresence]);
}

export default usePresenceLifecycle;
