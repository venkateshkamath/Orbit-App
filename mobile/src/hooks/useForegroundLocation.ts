import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useAuthStore } from '../stores';

export type ForegroundLocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
};

const MIN_SYNC_INTERVAL_MS = 35_000;
const MIN_MOVE_METERS = 35;

function metersBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Requests foreground location, watches position while the app is active,
 * updates the server (throttled), and exposes the latest fix for UI.
 */
export function useForegroundLocation() {
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [fix, setFix] = useState<ForegroundLocationFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastSyncRef = useRef<{ at: number; lat: number; lng: number } | null>(null);

  const stopWatch = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    setIsTracking(false);
  }, []);

  const maybeSyncServer = useCallback((lat: number, lng: number) => {
    const now = Date.now();
    const prev = lastSyncRef.current;
    if (prev) {
      const dt = now - prev.at;
      const moved = metersBetween(
        { latitude: prev.lat, longitude: prev.lng },
        { latitude: lat, longitude: lng }
      );
      if (dt < MIN_SYNC_INTERVAL_MS && moved < MIN_MOVE_METERS) {
        return;
      }
    }
    lastSyncRef.current = { at: now, lat, lng };
    useAuthStore.getState().updateLocation(lat, lng);
  }, []);

  const startWatch = useCallback(async () => {
    try {
      setError(null);
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        setPermissionDenied(true);
        stopWatch();
        return;
      }
      setPermissionDenied(false);

      stopWatch();
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: Platform.OS === 'web' ? 6000 : 4000,
          distanceInterval: Platform.OS === 'web' ? 12 : 6,
        },
        (location) => {
          const c = location.coords;
          setFix({
            latitude: c.latitude,
            longitude: c.longitude,
            accuracy: c.accuracy ?? null,
            altitude: c.altitude ?? null,
            heading: c.heading ?? null,
            speed: c.speed ?? null,
            timestamp: location.timestamp,
          });
          maybeSyncServer(c.latitude, c.longitude);
        }
      );
      setIsTracking(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Location error');
      stopWatch();
    }
  }, [maybeSyncServer, stopWatch]);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        startWatch();
      } else {
        stopWatch();
      }
    };

    if (AppState.currentState === 'active') {
      startWatch();
    }

    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      sub.remove();
      stopWatch();
    };
  }, [startWatch, stopWatch]);

  const requestPermissionAgain = useCallback(async () => {
    setPermissionDenied(false);
    await startWatch();
  }, [startWatch]);

  return {
    fix,
    permissionDenied,
    error,
    requestPermissionAgain,
    isTracking,
  };
}
