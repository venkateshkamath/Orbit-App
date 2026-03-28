import React, { createContext, useContext } from 'react';
import { useForegroundLocation, type ForegroundLocationFix } from '../hooks/useForegroundLocation';

type LocationContextValue = {
  fix: ForegroundLocationFix | null;
  permissionDenied: boolean;
  error: string | null;
  isTracking: boolean;
  requestPermissionAgain: () => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const value = useForegroundLocation();
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useLocationContext must be used within LocationProvider');
  }
  return ctx;
}
