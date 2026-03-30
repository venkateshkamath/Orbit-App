import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useAuthStore } from '../stores';

/**
 * When the user reaches the main app (tabs), grab a fresh GPS fix once and push it to the API.
 * Avoids stale discovery/map after logout → travel → login (or cold start in a new place).
 */
export function SessionLocationSync() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let cancelled = false;

    void (async () => {
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        let status = existing.status;
        if (status !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync();
          status = req.status;
        }
        if (status !== 'granted' || cancelled) return;

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        const { latitude, longitude } = location.coords;
        await useAuthStore.getState().updateLocation(latitude, longitude);
      } catch {
        // Watch-based sync in LocationProvider may still run later.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return null;
}
